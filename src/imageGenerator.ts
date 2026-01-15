import fs from 'node:fs';
import path from 'node:path';
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';
import { getOpenAIClient } from './openaiClient';
import { CONFIG, ImageSize } from './config';

export type GeneratedImage = {
  path: string;
  prompt: string;
  url: string | null;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FALLBACK_SIZES: ImageSize[] = ['1024x1024', '512x512', '256x256'];
const SIGNED_URL_TTL_MS = 60 * 60 * 1000;

let storageClient: Storage | null = null;

function uniqueSizes(primary: ImageSize): ImageSize[] {
  return Array.from(new Set([primary, ...FALLBACK_SIZES]));
}

function getStorageClient(): Storage {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
}

function buildObjectPath(fileName: string): string {
  const rawPrefix = CONFIG.storage.gcsPrefix ?? '';
  const prefix = rawPrefix.replace(/^\/+|\/+$/g, '');
  return prefix ? `${prefix}/${fileName}` : fileName;
}

function buildPublicGcsUrl(bucketName: string, objectPath: string): string {
  const encodedPath = objectPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://storage.googleapis.com/${bucketName}/${encodedPath}`;
}

async function uploadToGcs(filePath: string, fileName: string): Promise<string | null> {
  const bucketName = CONFIG.storage.gcsBucket;
  if (!bucketName) return null;

  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);
  const objectPath = buildObjectPath(fileName);

  await bucket.upload(filePath, {
    destination: objectPath,
    resumable: false,
    metadata: {
      contentType: 'image/png',
      cacheControl: 'public, max-age=31536000',
    },
  });

  const file = bucket.file(objectPath);

  if (CONFIG.storage.gcsPublic) {
    await file.makePublic();
    return buildPublicGcsUrl(bucketName, objectPath);
  }

  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_TTL_MS,
  });

  return signedUrl;
}

async function writeImageFile(image: { b64_json?: string | null; url?: string | null }, filePath: string): Promise<number> {
  if (image.b64_json) {
    const buffer = Buffer.from(image.b64_json, 'base64');
    fs.writeFileSync(filePath, buffer);
    return buffer.length;
  }

  if (image.url) {
    const response = await fetch(image.url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);
    return buffer.length;
  }

  throw new Error('OpenAI image response missing url/b64_json');
}

function buildOverlaySvg(params: { width: number; height: number; text: string }): Buffer {
  const lines = params.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return Buffer.from('');
  }

  const width = params.width;
  const height = params.height;
  const fontSize = Math.round(width * 0.05);
  const lineHeight = Math.round(fontSize * 1.25);
  const padding = Math.round(width * 0.06);
  const blockHeight = lineHeight * lines.length + padding;
  const startY = height - blockHeight;
  const textStartY = startY + padding * 0.6 + fontSize;
  const centerX = width / 2;

  const tspans = lines
    .map((line, index) => {
      const y = textStartY + lineHeight * index;
      return `<tspan x="${centerX}" y="${y}">${line}</tspan>`;
    })
    .join('');

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${startY}" width="${width}" height="${blockHeight}" fill="rgba(0,0,0,0.45)" />
      <text x="${centerX}" y="${textStartY}" text-anchor="middle" font-size="${fontSize}" font-weight="700"
        font-family="Noto Sans JP, Hiragino Kaku Gothic ProN, Yu Gothic, Meiryo, sans-serif" fill="#ffffff">
        ${tspans}
      </text>
    </svg>
  `;

  return Buffer.from(svg);
}

async function applyTextOverlay(filePath: string, text: string): Promise<void> {
  if (!text.trim()) return;

  const originalBuffer = await fs.promises.readFile(filePath);
  const image = sharp(originalBuffer);
  const meta = await image.metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  const overlaySvg = buildOverlaySvg({ width, height, text });
  if (!overlaySvg.length) return;

  const outputBuffer = await image
    .composite([{ input: overlaySvg, top: 0, left: 0 }])
    .png()
    .toBuffer();

  if (outputBuffer.length > MAX_IMAGE_BYTES) {
    return;
  }

  await fs.promises.writeFile(filePath, outputBuffer);
}

export async function generateImage(params: {
  figureName: string;
  quote: string;
  subtheme: string;
}): Promise<GeneratedImage> {
  const openai = getOpenAIClient();
  const prompt = `Create a poster-style illustration about literature and wisdom. Use symbolic elements like books, ink, quills, parchment, libraries, or warm light. Avoid realistic portraits or any identifiable person. No text, no logos, no violence. Atmosphere should be calm and educational. Inspired by the theme: ${CONFIG.theme}. Subtheme: ${params.subtheme}.`;

  const imageDir = path.join('data', 'images');
  fs.mkdirSync(imageDir, { recursive: true });

  const sizes = uniqueSizes(CONFIG.openai.imageSize);
  for (let i = 0; i < sizes.length; i += 1) {
    const size = sizes[i];
    const result = await openai.images.generate({
      model: CONFIG.openai.imageModel,
      prompt,
      size,
    });

    const image = result.data?.[0];
    if (!image) {
      throw new Error('OpenAI returned no image data');
    }

    const fileName = `post_${Date.now()}_${size.replace('x', '_')}.png`;
    const filePath = path.join(imageDir, fileName);
    const bytes = await writeImageFile(image, filePath);

    if (bytes <= MAX_IMAGE_BYTES) {
      if (CONFIG.imageOverlay.enabled) {
        await applyTextOverlay(filePath, CONFIG.imageOverlay.text);
      }
      const url = await uploadToGcs(filePath, fileName);
      return { path: filePath, prompt, url };
    }

    fs.unlinkSync(filePath);
  }

  throw new Error('Generated image exceeds 5MB limit. Try smaller size.');
}

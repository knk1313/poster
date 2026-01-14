import fs from 'node:fs';
import path from 'node:path';
import { Storage } from '@google-cloud/storage';
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
      const url = await uploadToGcs(filePath, fileName);
      return { path: filePath, prompt, url };
    }

    fs.unlinkSync(filePath);
  }

  throw new Error('Generated image exceeds 5MB limit. Try smaller size.');
}

import { CONFIG } from './config';
import fs from 'node:fs/promises';
import path from 'node:path';

function extractTwitterError(err: any): Record<string, unknown> {
  return {
    name: err?.name,
    message: err?.message,
    code: err?.code,
    status: err?.status,
    data: err?.data,
    errors: err?.errors,
    rateLimit: err?.rateLimit,
  };
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.bmp':
      return 'image/bmp';
    case '.tif':
    case '.tiff':
      return 'image/tiff';
    default:
      return 'application/octet-stream';
  }
}

async function uploadMediaToX(filePath: string, token: string): Promise<string> {
  const stats = await fs.stat(filePath);
  const maxBytes = 5 * 1024 * 1024;
  if (stats.size > maxBytes) {
    throw new Error(`Image file is too large (${stats.size} bytes). Max is ${maxBytes}.`);
  }
  const mimeType = getMimeType(filePath);
  const file = await fs.readFile(filePath);
  const payload = {
    media: file.toString('base64'),
    media_category: 'tweet_image',
    media_type: mimeType,
    shared: false,
  };

  const res = await fetch('https://api.x.com/2/media/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(
      `Media upload failed with code ${res.status}: ${JSON.stringify(data)}`,
    );
    (error as any).data = data;
    (error as any).status = res.status;
    throw error;
  }

  const mediaId = data?.data?.id;
  if (!mediaId) {
    throw new Error('Media upload succeeded but no id returned');
  }

  return mediaId;
}

export async function postToX(postText: string, imagePath?: string | null): Promise<string> {
  try {
    const token = CONFIG.x.oauth2AccessToken;
    if (!token) {
      throw new Error('X OAuth2 access token is not set in environment variables');
    }

    let mediaIds: string[] | undefined;
    if (imagePath) {
      const mediaId = await uploadMediaToX(imagePath, token);
      mediaIds = [mediaId];
    }

    const res = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        mediaIds ? { text: postText, media: { media_ids: mediaIds } } : { text: postText },
      ),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(`Request failed with code ${res.status}`);
      (error as any).data = data;
      (error as any).status = res.status;
      throw error;
    }

    const tweetId = data?.data?.id;
    if (!tweetId) {
      throw new Error('Tweet posted but no id returned');
    }

    return tweetId;
  } catch (err: any) {
    console.error('[postToX] Failed to post', extractTwitterError(err));
    throw err;
  }
}

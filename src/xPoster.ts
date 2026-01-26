import { CONFIG } from './config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

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

let cachedAccessToken = '';
let cachedRefreshToken = '';
let cachedAccessExpiresAt: number | null = null;
let cachedSecretClient: SecretManagerServiceClient | null = null;
let refreshTokenLoaded = false;

function initTokenCache(): void {
  if (!cachedAccessToken) {
    cachedAccessToken = CONFIG.x.oauth2AccessToken.trim();
  }
  if (!cachedRefreshToken) {
    cachedRefreshToken = CONFIG.x.refreshToken.trim();
  }
  if (cachedAccessExpiresAt === null) {
    cachedAccessExpiresAt = CONFIG.x.accessTokenExpiresAt ?? null;
  }
}

function shouldRefreshToken(): boolean {
  if (!cachedAccessExpiresAt) return false;
  return Date.now() + 60_000 >= cachedAccessExpiresAt;
}

function getSecretClient(): SecretManagerServiceClient {
  if (!cachedSecretClient) {
    cachedSecretClient = new SecretManagerServiceClient();
  }
  return cachedSecretClient;
}

function resolveSecretName(secretName: string): string {
  if (secretName.startsWith('projects/')) return secretName;
  const projectId = process.env.GCP_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? '';
  if (!projectId) {
    throw new Error('GCP project id is not set for Secret Manager');
  }
  return `projects/${projectId}/secrets/${secretName}`;
}

async function loadRefreshTokenFromSecret(): Promise<string> {
  const secretName = CONFIG.x.refreshTokenSecret.trim();
  if (!secretName) return '';
  const name = `${resolveSecretName(secretName)}/versions/latest`;
  const client = getSecretClient();
  const [version] = await client.accessSecretVersion({ name });
  const data = version?.payload?.data?.toString('utf8') ?? '';
  return data.trim();
}

async function ensureRefreshToken(): Promise<void> {
  if (refreshTokenLoaded) return;
  refreshTokenLoaded = true;
  try {
    const token = await loadRefreshTokenFromSecret();
    if (token && token !== cachedRefreshToken) {
      cachedRefreshToken = token;
      console.log('[postToX] Loaded refresh token from Secret Manager');
    }
  } catch (err: any) {
    console.error(
      '[postToX] Failed to load refresh token from Secret Manager',
      extractTwitterError(err),
    );
  }
}

async function persistRefreshToken(token: string): Promise<void> {
  const secretName = CONFIG.x.refreshTokenSecret.trim();
  if (!secretName) return;
  const parent = resolveSecretName(secretName);
  const client = getSecretClient();
  await client.addSecretVersion({
    parent,
    payload: {
      data: Buffer.from(token, 'utf8'),
    },
  });
  console.log('[postToX] Refresh token stored in Secret Manager');
}

async function refreshAccessToken(): Promise<string> {
  initTokenCache();
  await ensureRefreshToken();
  if (!cachedRefreshToken) {
    throw new Error('X refresh token is not set in environment variables');
  }

  const params = new URLSearchParams();
  params.set('refresh_token', cachedRefreshToken);
  params.set('grant_type', 'refresh_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (CONFIG.x.clientId && CONFIG.x.clientSecret) {
    const basic = Buffer.from(`${CONFIG.x.clientId}:${CONFIG.x.clientSecret}`).toString(
      'base64',
    );
    headers.Authorization = `Basic ${basic}`;
  } else if (CONFIG.x.clientId) {
    params.set('client_id', CONFIG.x.clientId);
  }

  const res = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers,
    body: params.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(
      `Token refresh failed with code ${res.status}: ${JSON.stringify(data)}`,
    );
    (error as any).data = data;
    (error as any).status = res.status;
    throw error;
  }

  const newAccessToken = data?.access_token;
  if (!newAccessToken) {
    throw new Error('Token refresh succeeded but no access_token returned');
  }

  cachedAccessToken = String(newAccessToken);
  if (data?.refresh_token) {
    cachedRefreshToken = String(data.refresh_token);
    try {
      await persistRefreshToken(cachedRefreshToken);
    } catch (err: any) {
      console.error(
        '[postToX] Failed to store refresh token in Secret Manager',
        extractTwitterError(err),
      );
      console.warn('[postToX] Refresh token rotated. Update X_REFRESH_TOKEN manually.');
    }
  }
  if (typeof data?.expires_in === 'number') {
    cachedAccessExpiresAt = Date.now() + data.expires_in * 1000;
  }

  console.log('[postToX] Access token refreshed');
  return cachedAccessToken;
}

async function getAccessToken(): Promise<string> {
  initTokenCache();
  if (!cachedAccessToken) {
    return refreshAccessToken();
  }
  if (shouldRefreshToken() && cachedRefreshToken) {
    return refreshAccessToken();
  }
  return cachedAccessToken;
}

async function fetchWithAuth(url: string, init: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);
  let res = await fetch(url, { ...init, headers });
  if (res.status === 401 && cachedRefreshToken) {
    const refreshedToken = await refreshAccessToken();
    const retryHeaders = new Headers(init.headers ?? {});
    retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
    res = await fetch(url, { ...init, headers: retryHeaders });
  }
  return res;
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

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function loadImageBytes(source: string): Promise<{ data: Buffer; mimeType: string }> {
  const maxBytes = 5 * 1024 * 1024;
  if (isHttpUrl(source)) {
    const res = await fetch(source);
    if (!res.ok) {
      throw new Error(`Failed to fetch image URL (${res.status})`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > maxBytes) {
      throw new Error(`Image download is too large (${buffer.length} bytes). Max is ${maxBytes}.`);
    }
    const urlPath = new URL(source).pathname;
    const mimeType = contentType.startsWith('image/')
      ? contentType
      : getMimeType(urlPath || 'image.png');
    return { data: buffer, mimeType };
  }

  const stats = await fs.stat(source);
  if (stats.size > maxBytes) {
    throw new Error(`Image file is too large (${stats.size} bytes). Max is ${maxBytes}.`);
  }
  const mimeType = getMimeType(source);
  const file = await fs.readFile(source);
  return { data: file, mimeType };
}

async function uploadMediaToX(source: string): Promise<string> {
  const { data, mimeType } = await loadImageBytes(source);
  const payload = {
    media: data.toString('base64'),
    media_category: 'tweet_image',
    media_type: mimeType,
    shared: false,
  };

  const res = await fetchWithAuth('https://api.x.com/2/media/upload', {
    method: 'POST',
    headers: {
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
    let mediaIds: string[] | undefined;
    if (imagePath) {
      const mediaId = await uploadMediaToX(imagePath);
      mediaIds = [mediaId];
    }

    const res = await fetchWithAuth('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
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

import { CONFIG } from './config';
import path from 'node:path';

const GRAPH_BASE = 'https://graph.facebook.com';

export type InstagramPostResult = {
  containerId: string;
  postId: string;
};

function buildImageUrl(imagePath: string): string {
  const base = CONFIG.instagram.publicBaseUrl;
  if (!base) {
    throw new Error('PUBLIC_BASE_URL is not set. Instagram requires a public image URL.');
  }

  const fileName = path.basename(imagePath);
  const normalizedBase = base.replace(/\/$/, '');
  return `${normalizedBase}/images/${encodeURIComponent(fileName)}`;
}

function buildCaption(caption: string): string {
  const trimmed = caption.trim();
  if (trimmed.length <= 2200) return trimmed;
  return `${trimmed.slice(0, 2197).trimEnd()}...`;
}

async function postForm(url: string, params: Record<string, string>): Promise<any> {
  const body = new URLSearchParams(params);
  const res = await fetch(url, { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, data }));
  }
  return data;
}

async function getJson(url: string): Promise<any> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(JSON.stringify({ status: res.status, data }));
  }
  return data;
}

async function waitForContainer(containerId: string, accessToken: string, apiVersion: string): Promise<void> {
  const fields = 'status_code';
  const url = `${GRAPH_BASE}/${apiVersion}/${containerId}?fields=${fields}&access_token=${accessToken}`;

  for (let i = 0; i < 10; i += 1) {
    const data = await getJson(url);
    const status = data.status_code;
    if (status === 'FINISHED') return;
    if (status === 'ERROR') {
      throw new Error(`Instagram container error: ${JSON.stringify(data)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error('Instagram container processing timeout');
}

export async function postToInstagram(
  caption: string,
  imagePath: string,
  imageUrl?: string | null,
): Promise<InstagramPostResult> {
  const accessToken = CONFIG.instagram.accessToken;
  const userId = CONFIG.instagram.userId;
  const apiVersion = CONFIG.instagram.apiVersion;

  if (!accessToken || !userId) {
    throw new Error('IG_ACCESS_TOKEN or IG_USER_ID is not set');
  }

  const resolvedImageUrl = imageUrl?.trim() || buildImageUrl(imagePath);
  const finalCaption = buildCaption(caption);

  const createUrl = `${GRAPH_BASE}/${apiVersion}/${userId}/media`;
  const containerData = await postForm(createUrl, {
    image_url: resolvedImageUrl,
    caption: finalCaption,
    access_token: accessToken,
  });

  const containerId = containerData.id;
  if (!containerId) {
    throw new Error(`Instagram container id missing: ${JSON.stringify(containerData)}`);
  }

  await waitForContainer(containerId, accessToken, apiVersion);

  const publishUrl = `${GRAPH_BASE}/${apiVersion}/${userId}/media_publish`;
  const publishData = await postForm(publishUrl, {
    creation_id: containerId,
    access_token: accessToken,
  });

  const postId = publishData.id;
  if (!postId) {
    throw new Error(`Instagram publish id missing: ${JSON.stringify(publishData)}`);
  }

  return { containerId, postId };
}

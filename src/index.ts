import 'dotenv/config';
import { CONFIG } from './config';
import { createAndPost, createDraft, postLatestDraft } from './workflow';

function isAuthorized(req: any): boolean {
  if (!CONFIG.cronSecret) return true;
  const headerSecret = req.headers?.['x-cron-secret'];
  const querySecret = req.query?.secret;
  return headerSecret === CONFIG.cronSecret || querySecret === CONFIG.cronSecret;
}

function ensureMethod(req: any, res: any): boolean {
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'POST') {
    return true;
  }
  res.status(405).json({ ok: false, error: 'Method not allowed' });
  return false;
}

async function handleRequest(action: () => Promise<unknown>, res: any): Promise<void> {
  try {
    const result = await action();
    res.status(200).json({ ok: true, result });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    res.status(500).json({ ok: false, error: message });
  }
}

export const scheduledPost = async (req: any, res: any): Promise<void> => {
  if (!ensureMethod(req, res)) return;
  if (!isAuthorized(req)) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  await handleRequest(() => createAndPost(), res);
};

export const generateDraft = async (req: any, res: any): Promise<void> => {
  if (!ensureMethod(req, res)) return;
  if (!isAuthorized(req)) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  await handleRequest(() => createDraft(), res);
};

export const postDraft = async (req: any, res: any): Promise<void> => {
  if (!ensureMethod(req, res)) return;
  if (!isAuthorized(req)) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  await handleRequest(() => postLatestDraft(), res);
};

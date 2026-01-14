import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { URL } from 'node:url';
import { CONFIG } from './config';
import { createAndPost, createDraft, postLatestDraft } from './workflow';

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function isAuthorized(req: http.IncomingMessage, url: URL): boolean {
  if (!CONFIG.cronSecret) return true;
  const headerSecret = req.headers['x-cron-secret'];
  const querySecret = url.searchParams.get('secret');
  return headerSecret === CONFIG.cronSecret || querySecret === CONFIG.cronSecret;
}

async function serveImage(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean> {
  if (!url.pathname.startsWith('/images/')) return false;
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method not allowed');
    return true;
  }

  const fileName = path.basename(url.pathname);
  const filePath = path.join('data', 'images', fileName);

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }

  return true;
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url || '/', 'http://localhost');

  if (await serveImage(req, res, url)) return;

  if (method !== 'GET' && method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  if (!isAuthorized(req, url)) {
    sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    return;
  }

  try {
    if (url.pathname === '/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === '/scheduled') {
      const result = await createAndPost();
      sendJson(res, 200, { ok: true, result });
      return;
    }

    if (url.pathname === '/generate') {
      const result = await createDraft();
      sendJson(res, 200, { ok: true, result });
      return;
    }

    if (url.pathname === '/post') {
      const result = await postLatestDraft();
      sendJson(res, 200, { ok: true, result });
      return;
    }

    sendJson(res, 404, { ok: false, error: 'Not found' });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    sendJson(res, 500, { ok: false, error: message });
  }
}

const port = Number(process.env.PORT ?? 8080);
const server = http.createServer((req, res) => {
  void handle(req, res);
});

server.listen(port, () => {
  console.log(`Local server listening on http://localhost:${port}`);
});

import { Pool } from 'pg';
import { CONFIG } from './config';

export type PostRecord = {
  id: number;
  created_at: string;
  scheduled_for: string | null;
  subtheme: string;
  figure_name: string;
  quote: string;
  source: string;
  short_explain: string;
  trivia: string;
  hashtags: string;
  post_text: string;
  image_prompt: string;
  image_path: string;
  image_url: string | null;
  status: string;
  tweet_id: string | null;
  error: string | null;
  ig_container_id: string | null;
  ig_post_id: string | null;
};

let pool: Pool | null = null;
let initPromise: Promise<void> | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!CONFIG.databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }
    pool = new Pool({ connectionString: CONFIG.databaseUrl });
  }
  return pool;
}

async function initDb(): Promise<void> {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL,
      scheduled_for TIMESTAMPTZ,
      subtheme TEXT NOT NULL,
      figure_name TEXT NOT NULL,
      quote TEXT NOT NULL,
      source TEXT NOT NULL,
      short_explain TEXT NOT NULL,
      trivia TEXT NOT NULL,
      hashtags TEXT NOT NULL,
      post_text TEXT NOT NULL,
      image_prompt TEXT NOT NULL,
      image_path TEXT NOT NULL,
      image_url TEXT,
      status TEXT NOT NULL,
      tweet_id TEXT,
      error TEXT,
      ig_container_id TEXT,
      ig_post_id TEXT
    );

    ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS ig_container_id TEXT;
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS ig_post_id TEXT;

    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
    CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
  `);
}

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initDb();
  }
  await initPromise;
}

export async function insertPostDraft(input: Omit<PostRecord, 'id'>): Promise<number> {
  await ensureInitialized();
  const db = getPool();
  const result = await db.query<{ id: number }>(
    `
      INSERT INTO posts (
        created_at,
        scheduled_for,
        subtheme,
        figure_name,
        quote,
        source,
        short_explain,
        trivia,
        hashtags,
        post_text,
        image_prompt,
        image_path,
        image_url,
        status,
        tweet_id,
        error,
        ig_container_id,
        ig_post_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
      ) RETURNING id
    `,
    [
      input.created_at,
      input.scheduled_for,
      input.subtheme,
      input.figure_name,
      input.quote,
      input.source,
      input.short_explain,
      input.trivia,
      input.hashtags,
      input.post_text,
      input.image_prompt,
      input.image_path,
      input.image_url,
      input.status,
      input.tweet_id,
      input.error,
      input.ig_container_id,
      input.ig_post_id,
    ],
  );

  return result.rows[0]?.id ?? 0;
}

export async function markPostPosted(id: number, igPostId: string, igContainerId: string): Promise<void> {
  await ensureInitialized();
  const db = getPool();
  await db.query(
    `UPDATE posts SET status = $1, ig_post_id = $2, ig_container_id = $3, error = NULL WHERE id = $4`,
    ['posted', igPostId, igContainerId, id],
  );
}

export async function markPostFailed(id: number, error: string): Promise<void> {
  await ensureInitialized();
  const db = getPool();
  await db.query(`UPDATE posts SET status = $1, error = $2 WHERE id = $3`, [
    'failed',
    error,
    id,
  ]);
}

export async function getLatestDraft(): Promise<PostRecord | undefined> {
  await ensureInitialized();
  const db = getPool();
  const result = await db.query<PostRecord>(
    `SELECT * FROM posts WHERE status = $1 ORDER BY created_at DESC LIMIT 1`,
    ['draft'],
  );
  return result.rows[0] ?? undefined;
}

export async function getRecentPosts(days: number, limit = 50): Promise<PostRecord[]> {
  await ensureInitialized();
  const db = getPool();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.query<PostRecord>(
    `SELECT * FROM posts WHERE created_at >= $1 ORDER BY created_at DESC LIMIT $2`,
    [since, limit],
  );
  return result.rows;
}

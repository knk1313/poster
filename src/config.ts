export type ImageSize =
  | '1024x1024'
  | 'auto'
  | '1536x1024'
  | '1024x1536'
  | '256x256'
  | '512x512'
  | '1792x1024'
  | '1024x1792';

type OpenAIConfig = {
  apiKey: string;
  model: string;
  imageModel: string;
  imageSize: ImageSize;
};

type InstagramConfig = {
  accessToken: string;
  userId: string;
  apiVersion: string;
  publicBaseUrl: string;
};

type StorageConfig = {
  gcsBucket: string;
  gcsPublic: boolean;
  gcsPrefix: string;
};

function normalizeHashtags(raw: string): string[] {
  const tags = raw
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));

  return Array.from(new Set(tags));
}

const imageSizeEnv = process.env.OPENAI_IMAGE_SIZE;
const allowedImageSizes: ImageSize[] = [
  '1024x1024',
  'auto',
  '1536x1024',
  '1024x1536',
  '256x256',
  '512x512',
  '1792x1024',
  '1024x1792',
];

const imageSize = allowedImageSizes.includes(imageSizeEnv as ImageSize)
  ? (imageSizeEnv as ImageSize)
  : '1024x1024';

export const CONFIG = {
  theme: process.env.THEME ?? '世界の偉人と名言',
  subtheme: process.env.SUBTHEME ?? '文学',
  fixedHashtags: normalizeHashtags(process.env.FIXED_HASHTAGS ?? '#名言 #今日の偉人'),
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    imageModel: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1',
    imageSize,
  } satisfies OpenAIConfig,
  instagram: {
    accessToken: process.env.IG_ACCESS_TOKEN ?? '',
    userId: process.env.IG_USER_ID ?? '',
    apiVersion: process.env.IG_API_VERSION ?? 'v20.0',
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
  } satisfies InstagramConfig,
  databaseUrl: process.env.DATABASE_URL ?? '',
  storage: {
    gcsBucket: process.env.GCS_BUCKET ?? '',
    gcsPublic: (process.env.GCS_PUBLIC ?? '').toLowerCase() === 'true',
    gcsPrefix: process.env.GCS_PREFIX ?? 'images',
  } satisfies StorageConfig,
  duplicateDays: Number(process.env.DUPLICATE_DAYS ?? 30),
  cronSecret: process.env.CRON_SECRET ?? '',
};

export function getFixedHashtags(): string[] {
  return CONFIG.fixedHashtags;
}

export function normalizeExtraHashtags(tags: string[]): string[] {
  const normalized = normalizeHashtags(tags.join(' '));
  const merged = Array.from(new Set([...CONFIG.fixedHashtags, ...normalized]));
  return merged.slice(0, 4);
}

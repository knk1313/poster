import { buildTweet } from './buildTweet';
import { CONFIG, normalizeExtraHashtags } from './config';
import {
  getLatestDraft,
  getRecentPosts,
  insertPostDraft,
  markPostFailed,
  markPostPosted,
  markPostTweeted,
  PostRecord,
} from './db';
import { generateImage } from './imageGenerator';
import { containsNgWords, generatePostContent } from './textGenerator';
import { postToInstagram } from './instagramPoster';
import { postToX } from './xPoster';

const MAX_GENERATION_ATTEMPTS = 3;

function toSubthemeHashtag(subtheme: string): string {
  if (!subtheme) return '';
  return subtheme.startsWith('#') ? subtheme : `#${subtheme}`;
}

function isDuplicate(recent: PostRecord[], figureName: string, quote: string): boolean {
  return recent.some((post) => post.figure_name === figureName || post.quote === quote);
}

export async function createDraft(scheduledFor?: string): Promise<PostRecord> {
  const recent = await getRecentPosts(CONFIG.duplicateDays);

  let content = null;
  let lastCandidate = null;
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = await generatePostContent(
      recent.map((post) => ({ figureName: post.figure_name, quote: post.quote })),
    );
    const combinedText = [
      candidate.figureName,
      candidate.quote,
      candidate.source,
      candidate.shortExplain,
      candidate.trivia,
      candidate.hashtags.join(' '),
    ]
      .join('\n')
      .trim();

    if (containsNgWords(combinedText)) {
      console.warn(`[createDraft] NG word detected (attempt ${attempt})`);
      continue;
    }

    lastCandidate = candidate;

    if (isDuplicate(recent, candidate.figureName, candidate.quote)) {
      console.warn(`[createDraft] Duplicate detected (attempt ${attempt})`);
      continue;
    }

    content = candidate;
    break;
  }

  if (!content && lastCandidate) {
    console.warn('[createDraft] Falling back to last candidate after duplicates');
    content = lastCandidate;
  }

  if (!content) {
    throw new Error('Failed to generate content');
  }

  const hashtags = normalizeExtraHashtags([
    toSubthemeHashtag(CONFIG.subtheme),
    ...content.hashtags,
  ]).filter(Boolean);

  const postText = buildTweet({
    figureName: content.figureName,
    quote: content.quote,
    source: content.source,
    shortExplain: content.shortExplain,
    trivia: content.trivia,
    hashtags,
  });

  const image = await generateImage({
    figureName: content.figureName,
    quote: content.quote,
    subtheme: CONFIG.subtheme,
  });

  const createdAt = new Date().toISOString();
  const draft: Omit<PostRecord, 'id'> = {
    created_at: createdAt,
    scheduled_for: scheduledFor ?? null,
    subtheme: CONFIG.subtheme,
    figure_name: content.figureName,
    quote: content.quote,
    source: content.source,
    short_explain: content.shortExplain,
    trivia: content.trivia,
    hashtags: hashtags.join(' '),
    post_text: postText,
    image_prompt: image.prompt,
    image_path: image.path,
    image_url: image.url,
    status: 'draft',
    tweet_id: null,
    error: null,
    ig_container_id: null,
    ig_post_id: null,
  };

  const id = await insertPostDraft(draft);

  return {
    id,
    ...draft,
    tweet_id: null,
    error: null,
  };
}

export async function postLatestDraft(): Promise<PostRecord> {
  const draft = await getLatestDraft();
  if (!draft) {
    throw new Error('No draft available');
  }

  try {
    const result = await postToInstagram(draft.post_text, draft.image_path, draft.image_url);
    let tweetId: string | null = null;
    if (CONFIG.x.enabled) {
      try {
        tweetId = await postToX(draft.post_text, draft.image_url || draft.image_path);
      } catch {
        tweetId = null;
      }
    }
    await markPostPosted(draft.id, result.postId, result.containerId, tweetId);
    return {
      ...draft,
      status: 'posted',
      ig_post_id: result.postId,
      ig_container_id: result.containerId,
      tweet_id: tweetId,
    };
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Failed to post to Instagram';
    await markPostFailed(draft.id, message);
    throw err;
  }
}

export async function createAndPost(scheduledFor?: string): Promise<PostRecord> {
  const draft = await createDraft(scheduledFor);
  try {
    const result = await postToInstagram(draft.post_text, draft.image_path, draft.image_url);
    let tweetId: string | null = null;
    if (CONFIG.x.enabled) {
      try {
        tweetId = await postToX(draft.post_text, draft.image_url || draft.image_path);
      } catch {
        tweetId = null;
      }
    }
    await markPostPosted(draft.id, result.postId, result.containerId, tweetId);
    return {
      ...draft,
      status: 'posted',
      ig_post_id: result.postId,
      ig_container_id: result.containerId,
      tweet_id: tweetId,
    };
  } catch (err: any) {
    const message = err instanceof Error ? err.message : 'Failed to post to Instagram';
    await markPostFailed(draft.id, message);
    throw err;
  }
}

export async function postLatestDraftToX(): Promise<PostRecord> {
  const draft = await getLatestDraft();
  if (!draft) {
    throw new Error('No draft available');
  }

  const tweetId = await postToX(draft.post_text, draft.image_url || draft.image_path);
  await markPostTweeted(draft.id, tweetId);

  return {
    ...draft,
    tweet_id: tweetId,
  };
}

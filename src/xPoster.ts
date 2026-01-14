import { getTwitterClient } from './xClient';

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

export async function postToX(postText: string): Promise<string> {
  const client = getTwitterClient();
  try {
    const tweet = await client.v2.tweet(postText);
    const tweetId = tweet.data?.id;
    if (!tweetId) {
      throw new Error('Tweet posted but no id returned');
    }

    return tweetId;
  } catch (err: any) {
    console.error('[postToX] Failed to post', extractTwitterError(err));
    throw err;
  }
}

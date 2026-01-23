import { CONFIG } from './config';

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
  try {
    const token = CONFIG.x.oauth2AccessToken;
    if (!token) {
      throw new Error('X OAuth2 access token is not set in environment variables');
    }

    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: postText }),
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

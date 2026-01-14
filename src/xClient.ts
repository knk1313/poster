import { TwitterApi } from 'twitter-api-v2';

export function getTwitterClient(): TwitterApi {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error('X API credentials are not set in environment variables');
  }

  return new TwitterApi({
    appKey: apiKey.trim(),
    appSecret: apiSecret.trim(),
    accessToken: accessToken.trim(),
    accessSecret: accessSecret.trim(),
  });
}

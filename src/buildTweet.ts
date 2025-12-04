export const MAX_TWEET_LENGTH = Number(process.env.MAX_TWEET_LENGTH ?? 280);

function composeTweet(caption: string, url: string, hashtags: string): string {
  const separator = caption ? '\n' : '';
  const hashtagPart = hashtags ? ` ${hashtags}` : '';
  return `${caption}${separator}${url}${hashtagPart}`;
}

function trimCaption(caption: string, allowedLength: number): string {
  if (allowedLength <= 0) {
    return '';
  }

  if (caption.length <= allowedLength) {
    return caption;
  }

  const sliced = caption.slice(0, allowedLength);
  const lastSpace = sliced.lastIndexOf(' ');

  if (lastSpace > allowedLength * 0.6) {
    return sliced.slice(0, lastSpace).trim();
  }

  return sliced.trim();
}

export function buildTweet(caption: string, url: string, hashtags: string): string {
  const captionPart = caption.trim();
  const urlPart = url.trim();
  const hashtagsPart = hashtags.trim();

  let tweet = composeTweet(captionPart, urlPart, hashtagsPart);
  if (tweet.length <= MAX_TWEET_LENGTH) {
    return tweet;
  }

  const baseLength = urlPart.length + (hashtagsPart ? 1 + hashtagsPart.length : 0);
  const newlineCost = captionPart ? 1 : 0;
  const allowedCaptionLength = Math.max(MAX_TWEET_LENGTH - baseLength - newlineCost, 0);

  const trimmedCaption = trimCaption(captionPart, allowedCaptionLength);
  tweet = composeTweet(trimmedCaption, urlPart, hashtagsPart);

  if (tweet.length <= MAX_TWEET_LENGTH) {
    return tweet;
  }

  const tags = hashtagsPart ? hashtagsPart.split(/\s+/).filter(Boolean) : [];
  let workingHashtags = tags;

  while (tweet.length > MAX_TWEET_LENGTH && workingHashtags.length > 0) {
    workingHashtags = workingHashtags.slice(0, workingHashtags.length - 1);
    tweet = composeTweet(trimmedCaption, urlPart, workingHashtags.join(' '));
  }

  if (tweet.length > MAX_TWEET_LENGTH) {
    // As a last resort, drop hashtags entirely.
    tweet = composeTweet(trimmedCaption, urlPart, '');
  }

  if (tweet.length > MAX_TWEET_LENGTH) {
    // Extremely long URLs are unlikely, but guard against them.
    return tweet.slice(tweet.length - MAX_TWEET_LENGTH);
  }

  return tweet;
}

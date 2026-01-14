export type PostParts = {
  figureName: string;
  quote: string;
  source: string;
  shortExplain: string;
  trivia: string;
  hashtags: string[];
};

export const MAX_TWEET_LENGTH = Number(process.env.MAX_TWEET_LENGTH ?? 280);

function composeLines(lines: string[]): string {
  return lines
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join('\n');
}

function truncateText(text: string, maxLen: number): string {
  if (maxLen <= 0) return '';
  if (text.length <= maxLen) return text;
  if (maxLen <= 3) return text.slice(0, maxLen);
  return `${text.slice(0, maxLen - 3).trimEnd()}...`;
}

export function buildTweet(parts: PostParts): string {
  const quoteLine = `「${parts.quote.trim()}」`;
  const figureLine = `　${parts.figureName.trim()}${parts.source ? `（${parts.source.trim()}）` : ''}`;
  const hashtagsLine = parts.hashtags.join(' ').trim();

  let shortExplain = parts.shortExplain.trim();
  let trivia = parts.trivia.trim();

  let tweet = composeLines([quoteLine, figureLine, shortExplain, trivia, hashtagsLine]);
  if (tweet.length <= MAX_TWEET_LENGTH) {
    return tweet;
  }

  const withoutTrivia = composeLines([quoteLine, figureLine, shortExplain, hashtagsLine]);
  const maxTriviaLength = MAX_TWEET_LENGTH - withoutTrivia.length - (trivia ? 1 : 0);
  if (maxTriviaLength < 0) {
    trivia = '';
  } else {
    trivia = truncateText(trivia, maxTriviaLength);
  }

  tweet = composeLines([quoteLine, figureLine, shortExplain, trivia, hashtagsLine]);
  if (tweet.length <= MAX_TWEET_LENGTH) {
    return tweet;
  }

  const withoutShortExplain = composeLines([quoteLine, figureLine, trivia, hashtagsLine]);
  const maxExplainLength = MAX_TWEET_LENGTH - withoutShortExplain.length - (shortExplain ? 1 : 0);
  if (maxExplainLength < 0) {
    shortExplain = '';
  } else {
    shortExplain = truncateText(shortExplain, maxExplainLength);
  }

  tweet = composeLines([quoteLine, figureLine, shortExplain, trivia, hashtagsLine]);
  if (tweet.length <= MAX_TWEET_LENGTH) {
    return tweet;
  }

  const withoutQuote = composeLines([figureLine, shortExplain, trivia, hashtagsLine]);
  const maxQuoteLength = MAX_TWEET_LENGTH - withoutQuote.length - 1;
  const trimmedQuote = truncateText(quoteLine, Math.max(maxQuoteLength, 0));

  return composeLines([trimmedQuote, figureLine, shortExplain, trivia, hashtagsLine]);
}

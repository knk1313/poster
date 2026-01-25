export type PostParts = {
  figureName: string;
  quote: string;
  source: string;
  shortExplain: string;
  trivia: string;
  hashtags: string[];
};

export const MAX_TWEET_LENGTH = Number(process.env.MAX_TWEET_LENGTH ?? 280);
const MIN_QUOTE_WEIGHT = 8;
const MIN_FIGURE_WEIGHT = 4;
const MIN_BODY_WEIGHT = 10;
const MAX_QUOTE_WEIGHT = 120;
const MAX_FIGURE_WEIGHT = 80;
const MAX_EXPLAIN_WEIGHT = 140;
const MAX_TRIVIA_WEIGHT = 120;
const MAX_HASHTAGS_WEIGHT = 80;

function charWeight(ch: string): number {
  return ch.codePointAt(0) && ch.codePointAt(0)! > 0x7f ? 2 : 1;
}

function weightedLength(text: string): number {
  let length = 0;
  for (const ch of text) {
    length += charWeight(ch);
  }
  return length;
}

function truncateToWeight(text: string, maxLen: number): string {
  if (maxLen <= 0) return '';
  let length = 0;
  let out = '';
  for (const ch of text) {
    const weight = charWeight(ch);
    if (length + weight > maxLen) break;
    out += ch;
    length += weight;
  }
  return out;
}

function composeLines(lines: string[]): string {
  return lines
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join('\n');
}

function truncateText(text: string, maxLen: number): string {
  if (maxLen <= 0) return '';
  if (weightedLength(text) <= maxLen) return text;
  if (maxLen <= 3) return truncateToWeight(text, maxLen);
  return `${truncateToWeight(text, maxLen - 3).trimEnd()}...`;
}

function fitLine(text: string, maxWeight: number, minWeight: number): string {
  const cleaned = text.trimEnd();
  if (cleaned.trim().length === 0) return '';
  const fitted = truncateText(cleaned, maxWeight);
  if (weightedLength(fitted) < minWeight) return '';
  return fitted;
}

function fitHashtags(tags: string[], maxWeight: number): string {
  const cleaned = tags.map((tag) => tag.trim()).filter(Boolean);
  if (cleaned.length === 0) return '';
  const picked: string[] = [];
  for (const tag of cleaned) {
    const candidate = picked.length ? `${picked.join(' ')} ${tag}` : tag;
    if (weightedLength(candidate) > maxWeight) break;
    picked.push(tag);
  }
  return picked.join(' ').trim();
}

export function buildTweet(parts: PostParts): string {
  const quoteLine = fitLine(`「${parts.quote.trim()}」`, MAX_QUOTE_WEIGHT, MIN_QUOTE_WEIGHT);
  const figureLine = fitLine(
    `　${parts.figureName.trim()}${parts.source ? `（${parts.source.trim()}）` : ''}`,
    MAX_FIGURE_WEIGHT,
    MIN_FIGURE_WEIGHT,
  );
  const hashtagsLine = fitHashtags(parts.hashtags, MAX_HASHTAGS_WEIGHT);

  let shortExplain = fitLine(parts.shortExplain.trim(), MAX_EXPLAIN_WEIGHT, MIN_BODY_WEIGHT);
  let trivia = fitLine(parts.trivia.trim(), MAX_TRIVIA_WEIGHT, MIN_BODY_WEIGHT);

  let tweet = composeLines([quoteLine, figureLine, shortExplain, trivia, hashtagsLine]);
  if (weightedLength(tweet) <= MAX_TWEET_LENGTH) {
    return tweet;
  }

  const withoutTrivia = composeLines([quoteLine, figureLine, shortExplain, hashtagsLine]);
  const maxTriviaLength =
    MAX_TWEET_LENGTH - weightedLength(withoutTrivia) - (trivia ? 1 : 0);
  if (maxTriviaLength < 0) {
    trivia = '';
  } else {
    trivia = fitLine(trivia, maxTriviaLength, MIN_BODY_WEIGHT);
  }

  tweet = composeLines([quoteLine, figureLine, shortExplain, trivia, hashtagsLine]);
  if (weightedLength(tweet) <= MAX_TWEET_LENGTH) {
    return tweet;
  }

  const withoutShortExplain = composeLines([quoteLine, figureLine, trivia, hashtagsLine]);
  const maxExplainLength =
    MAX_TWEET_LENGTH - weightedLength(withoutShortExplain) - (shortExplain ? 1 : 0);
  if (maxExplainLength < 0) {
    shortExplain = '';
  } else {
    shortExplain = fitLine(shortExplain, maxExplainLength, MIN_BODY_WEIGHT);
  }

  tweet = composeLines([quoteLine, figureLine, shortExplain, trivia, hashtagsLine]);
  if (weightedLength(tweet) <= MAX_TWEET_LENGTH) {
    return tweet;
  }

  const withoutQuote = composeLines([figureLine, shortExplain, trivia, hashtagsLine]);
  const maxQuoteLength = MAX_TWEET_LENGTH - weightedLength(withoutQuote) - 1;
  const trimmedQuote = fitLine(quoteLine, Math.max(maxQuoteLength, 0), MIN_QUOTE_WEIGHT);

  return composeLines([trimmedQuote, figureLine, shortExplain, trivia, hashtagsLine]);
}

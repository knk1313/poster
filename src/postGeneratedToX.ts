import 'dotenv/config';
import { buildTweet } from './buildTweet';
import { CONFIG, normalizeExtraHashtags } from './config';
import { containsNgWords, generatePostContent } from './textGenerator';
import { postToX } from './xPoster';

function toSubthemeHashtag(subtheme: string): string {
  if (!subtheme) return '';
  return subtheme.startsWith('#') ? subtheme : `#${subtheme}`;
}

const MAX_GENERATION_ATTEMPTS = 3;

async function main(): Promise<void> {
  const shouldPost = process.argv.includes('--post');
  const imageArgIndex = process.argv.indexOf('--image');
  const imagePath =
    imageArgIndex >= 0 ? (process.argv[imageArgIndex + 1] ?? '') : '';
  if (imageArgIndex >= 0 && !imagePath) {
    throw new Error('Missing value for --image (provide a local file path or URL)');
  }
  let content = null;
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = await generatePostContent([]);
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
      console.warn(`[postGeneratedToX] NG word detected (attempt ${attempt})`);
      continue;
    }

    content = candidate;
    break;
  }

  if (!content) {
    throw new Error('Failed to generate content without NG words');
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

  console.log('--- Generated post ---');
  console.log(postText);
  console.log(`--- Length: ${postText.length} ---`);

  if (!shouldPost) {
    console.log('Dry run only. Re-run with --post to publish to X.');
    return;
  }

  const tweetId = await postToX(postText, imagePath || null);
  console.log(`Posted to X. tweet_id=${tweetId}`);
}

main().catch((err) => {
  console.error('[postGeneratedToX] Failed', err);
  process.exitCode = 1;
});

// scripts/testCaption.ts
import 'dotenv/config';
import { generateCaption } from '../src/aiCaption';
import { generateArticleSummary } from '../src/aiArticleSummary';
import { fetchArticleBody } from '../src/fetchArticleBody';
import { buildTweet } from '../src/buildTweet';

async function main() {
  const samples = [
    {
      title: '香港 ネット撤去へ',
      source: 'yahoo_rss',
      url: 'https://news.yahoo.co.jp/pickup/6561232?source=rss',
    },
  ];

  for (const s of samples) {
    console.log('=====');
    console.log(`title   : ${s.title}`);

    const body = await fetchArticleBody(s.url);
    console.log(`bodyLen : ${body.length}`);

    const summary = await generateArticleSummary({
      title: s.title,
      source: s.source,
      url: s.url,
      body,
    });
    console.log('summaryShort:', summary.summaryShort);
    console.log('summaryLong :', summary.summaryLong);
    console.log('hashtags    :', summary.hashtags.join(' '));

    const caption = await generateCaption(s.title, s.source);
    console.log('caption     :', caption.caption);
    console.log('captionTags :', caption.hashtags);

    const tweet = buildTweet(caption.caption, s.url, caption.hashtags);
    console.log('tweet      :', tweet);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

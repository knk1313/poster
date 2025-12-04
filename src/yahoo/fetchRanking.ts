import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

export type YahooNewsItem = {
  title: string;
  url: string;
  category: string;
  fetchedAt: string;
};

const RSS_FEEDS: Record<string, string> = {
  トップ: 'https://news.yahoo.co.jp/rss/topics/top-picks.xml',
  国内: 'https://news.yahoo.co.jp/rss/topics/domestic.xml',
  国際: 'https://news.yahoo.co.jp/rss/topics/world.xml',
  経済: 'https://news.yahoo.co.jp/rss/topics/business.xml',
  // 必要に応じて追加
};

const parser = new XMLParser();

async function fetchFromRss(label: string, url: string): Promise<YahooNewsItem[]> {
  const res = await axios.get(url, { responseType: 'text' });
  const xmlObj = parser.parse(res.data);

  const channel = xmlObj.rss?.channel;
  if (!channel) {
    console.warn(`RSS channel not found for: ${label}`);
    return [];
  }

  const items = Array.isArray(channel.item) ? channel.item : [channel.item];
  const fetchedAt = new Date().toISOString();

  return items.map((item: any) => ({
    title: item.title,
    url: item.link,
    category: label,
    fetchedAt,
  }));
}

export async function fetchYahooNewsRanking(): Promise<YahooNewsItem[]> {
  const results: YahooNewsItem[] = [];

  for (const [label, url] of Object.entries(RSS_FEEDS)) {
    try {
      const items = await fetchFromRss(label, url);
      results.push(...items);
    } catch (err) {
      console.error(`Failed to fetch RSS for ${label}:`, err);
    }
  }

  return results;
}

if (require.main === module) {
  (async () => {
    const data = await fetchYahooNewsRanking();
    console.log(JSON.stringify(data, null, 2));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

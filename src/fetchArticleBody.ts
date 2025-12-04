import axios from 'axios';
import { load } from 'cheerio';

const ARTICLE_SELECTORS = [
  'article',
  '.article_body',
  '.articleBody',
  '.articleText',
  '.articleMain',
  '.news_body',
  '.newsText',
  '.article__body',
  '.article--body',
  '.newsVMD-body',
  '.yjDirectSLinkTarget',
  '.mdLocalContent',
  '#articleBody',
];

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export async function fetchArticleBody(url: string): Promise<string> {
  try {
    const res = await axios.get<string>(url, {
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; YahooNewsBot/1.0; +https://example.com)',
      },
    });

    const $ = load(res.data);
    $('script, style, noscript').remove();

    let bodyText = '';
    for (const selector of ARTICLE_SELECTORS) {
      const candidate = cleanText($(selector).text());
      if (candidate.length > bodyText.length) {
        bodyText = candidate;
      }
    }

    if (!bodyText) {
      bodyText = cleanText($('body').text());
    }

    return bodyText.slice(0, 4000);
  } catch (err) {
    console.error('Failed to fetch article body', url, err);
    return '';
  }
}

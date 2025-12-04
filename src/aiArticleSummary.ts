import { getOpenAIClient } from './openaiClient';

export type ArticleSummary = {
  title: string;
  summaryShort: string;
  summaryLong: string;
  hashtags: string[];
};

type SummaryInput = {
  title: string;
  source?: string;
  url: string;
  body: string;
};

function normalizeHashtags(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter(Boolean)
      .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
  }
  if (typeof raw === 'string') {
    return raw
      .split(/\s+/)
      .filter(Boolean)
      .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
  }
  return [];
}

export async function generateArticleSummary(input: SummaryInput): Promise<ArticleSummary> {
  const openai = getOpenAIClient();
  const systemPrompt = `
あなたは日本語のニュース要約を行うアシスタントです。入力としてニュース記事本文とメタ情報を受け取り、X（旧Twitter）投稿に使いやすい短いタイトル、要約文、適切なハッシュタグをJSON形式で返してください。
出力スキーマ:
{
  "title": "短いタイトル",
  "summaryShort": "短い要約（30〜50文字程度）",
  "summaryLong": "もう少し長い要約（目安80〜120文字、できれば100字前後）",
  "hashtags": ["#経済", "#日本", "#ニュース"] // 3〜4個
}
`.trim();

  const userPrompt = `
タイトル: ${input.title}
媒体: ${input.source ?? '不明'}
URL: ${input.url}

本文:
${input.body || '本文が取得できませんでした'}

上記をもとに、指定のJSONスキーマでのみ回答してください。余計な文言は付けないでください。
summaryLongは80〜120文字（できれば100字前後）で書いてください。
`.trim();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('OpenAIから空のレスポンスを受け取りました');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse article summary JSON:', raw);
    throw new Error('記事要約のJSONパースに失敗しました');
  }

  const title = typeof parsed.title === 'string' ? parsed.title.trim() : input.title;
  const summaryShort =
    typeof parsed.summaryShort === 'string'
      ? parsed.summaryShort.trim()
      : typeof parsed.summary === 'string'
        ? parsed.summary.trim()
        : '';
  const summaryLong =
    typeof parsed.summaryLong === 'string' ? parsed.summaryLong.trim() : summaryShort || '';
  const hashtags = normalizeHashtags(parsed.hashtags).slice(0, 4);

  return {
    title,
    summaryShort,
    summaryLong,
    hashtags,
  };
}

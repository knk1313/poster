import { getOpenAIClient } from './openaiClient';

export type GeneratedCaption = {
  caption: string;
  hashtags: string;
};

export async function generateCaption(title: string, source?: string): Promise<GeneratedCaption> {
  const openai = getOpenAIClient();
  const sourceText = source && source.trim().length > 0 ? source : '（情報元：不明）';

  const systemPrompt = `
あなたはニュースを紹介するX投稿の文面を作成するアシスタントです。

### 役割
- ニュース記事のタイトルとカテゴリ/媒体名をもとに、
  X（旧Twitter）向けの投稿文を作成します。
- 出力は JSON 形式で行います。

### キャプションのルール
- 日本語で書く
- 文字数の目安: 60〜110文字程度
- X向けに読みやすく、簡潔に
- 元記事の内容を推測しすぎず、
  「〜の可能性」「〜と報じられています」など控えめなトーンを優先
- 誇張・断定的な表現（「絶対に」「100%」「〜が確定」など）は避ける
- 見出しをそのままコピペせず、少し言い換える
- URLはキャプションには含めない（投稿時に後から末尾に付ける）

### ハッシュタグのルール
- 先頭に1つ汎用タグ（例: #ニュース / #速報 / #トレンド など）
- その後にカテゴリや内容に関連するタグを2〜4個
- すべて半角スペース区切り
- 記事タイトルに含まれる固有名詞（人物名・地名・サービス名など）があれば、
  ハッシュタグとして1〜2個含める
- ハッシュタグにも断定的・扇情的な表現は避ける

### 出力フォーマット
必ず **次のJSONだけ** を返してください。余計な文章は一切書かないでください。

{
  "caption": "キャプション本文",
  "hashtags": "#ニュース #タグ1 #タグ2"
}
`.trim();

  const userPrompt = `
タイトル: 「${title}」
カテゴリ / 媒体: 「${sourceText}」

上記の情報をもとに、指定されたフォーマットのJSONだけを返してください。
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
    throw new Error('OpenAIからのレスポンスが空でした');
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse JSON from OpenAI:', raw);
    throw new Error('OpenAIのレスポンスをJSONとしてパースできませんでした');
  }

  const result = json as Partial<GeneratedCaption>;

  if (typeof result.caption !== 'string' || typeof result.hashtags !== 'string') {
    console.error('Unexpected JSON structure:', json);
    throw new Error('OpenAIのJSON構造が想定と異なります（caption / hashtags が文字列ではない）');
  }

  return {
    caption: result.caption.trim(),
    hashtags: result.hashtags.trim(),
  };
}

import { getOpenAIClient } from './openaiClient';
import { CONFIG } from './config';

export type GeneratedPost = {
  figureName: string;
  quote: string;
  source: string;
  shortExplain: string;
  trivia: string;
  hashtags: string[];
  riskFlags: string[];
};

type RecentItem = {
  figureName: string;
  quote: string;
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
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
  }
  return [];
}

function normalizeStringArray(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/\\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

export async function generatePostContent(recent: RecentItem[]): Promise<GeneratedPost> {
  const openai = getOpenAIClient();

  const recentSummary = recent.length
    ? recent
        .slice(0, 20)
        .map((item) => `- ${item.figureName}: ${item.quote}`)
        .join('\n')
    : 'None';

  const systemPrompt = `
You are a Japanese copywriter for an educational X bot.
Return ONLY JSON with the following keys:
{
  "figure_name": "string",
  "quote": "string",
  "source": "string",
  "short_explain": "string",
  "trivia": "string",
  "hashtags": ["#tag1", "#tag2"],
  "risk_flags": ["string"]
}
Rules:
- Japanese only.
- Theme: ${CONFIG.theme}.
- Subtheme: ${CONFIG.subtheme}.
- Be accurate and cautious; if uncertain, say "諸説あり" in source.
- Avoid political or discriminatory statements.
- Provide 2-3 topical hashtags (do NOT include fixed tags; they will be added later).
- Output must be valid JSON only.
`.trim();

  const userPrompt = `
Recent quotes/figures (avoid duplicates):
${recentSummary}

Create one new post content that is not in the recent list.
`.trim();

  const completion = await openai.chat.completions.create({
    model: CONFIG.openai.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('OpenAI returned empty response');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const slice = raw.slice(start, end + 1);
      try {
        parsed = JSON.parse(slice);
      } catch (innerErr) {
        console.error('Failed to parse JSON from OpenAI:', raw);
        throw new Error('OpenAI JSON parse failed');
      }
    } else {
      console.error('Failed to parse JSON from OpenAI:', raw);
      throw new Error('OpenAI JSON parse failed');
    }
  }

  const figureName = normalizeText(parsed.figure_name);
  const quote = normalizeText(parsed.quote);
  const source = normalizeText(parsed.source);
  const shortExplain = normalizeText(parsed.short_explain);
  const trivia = normalizeText(parsed.trivia);
  const hashtags = normalizeHashtags(parsed.hashtags);
  const riskFlags = normalizeStringArray(parsed.risk_flags || parsed.riskFlags);

  if (!figureName || !quote || !shortExplain || !trivia) {
    throw new Error('OpenAI response missing required fields');
  }

  return {
    figureName,
    quote,
    source: source || '諸説あり',
    shortExplain,
    trivia,
    hashtags,
    riskFlags,
  };
}

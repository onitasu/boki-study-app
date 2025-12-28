import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Subject = 'mixed' | 'commercial' | 'industrial';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function extractOutputText(resp: any): string | null {
  if (typeof resp?.output_text === 'string') return resp.output_text;
  const content = resp?.output?.[0]?.content;
  if (Array.isArray(content)) {
    const t = content.find((c: any) => c?.type === 'output_text' && typeof c?.text === 'string')?.text;
    if (typeof t === 'string') return t;
  }
  return null;
}

function safeTrim(s: any, maxLen: number): string {
  const str = typeof s === 'string' ? s : '';
  const trimmed = str.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen);
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY が設定されていません。Vercel / .env.local に設定してください。' },
      { status: 500 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();

  const title = safeTrim(formData.get('title'), 120) || null;
  const memo = safeTrim(formData.get('memo'), 5000) || null;
  const subject = (safeTrim(formData.get('subject'), 20) || 'mixed') as Subject;

  const rawCount = Number(formData.get('count') ?? 8);
  const count = clamp(Number.isFinite(rawCount) ? rawCount : 8, 1, 20);

  const imageFiles = formData.getAll('images').filter((x) => x instanceof File) as File[];

  if (imageFiles.length === 0 && !memo) {
    return NextResponse.json({ error: '画像またはメモのどちらかは必要です。' }, { status: 400 });
  }

  // Convert images to data URLs (base64)
  const images: string[] = [];
  for (const file of imageFiles.slice(0, 3)) {
    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    const b64 = buf.toString('base64');
    const mime = file.type || 'image/jpeg';
    images.push(`data:${mime};base64,${b64}`);
  }

  // Prompt design: avoid verbatim copying from the textbook; create original questions.
  const systemPrompt = [
    'あなたは日商簿記2級の学習を支援する家庭教師です。',
    'ユーザーが提供した「テキスト写真」と「自分メモ」をもとに、理解を深めるためのフラッシュカード問題を作ります。',
    '',
    '重要:',
    '- 出力は必ず指定のJSONスキーマに従ってください（追加フィールド禁止）。',
    '- 教材の文章を長文でそのまま引用しないでください（著作権配慮）。内容は要約・言い換えし、問題はオリジナルにしてください。',
    '- 計算例を作る場合、数値は画像と同一のものをそのまま使わず、同じ論点を問う別の数値にしてください。',
    '- 問題文は短く、回答は明確に。解説は「なぜそうなるか」を1〜6行で。',
    '- できるだけ簿記2級の試験で問われやすい形（仕訳/手順/用語/判断基準/原価計算の型）に寄せる。',
  ].join('\n');

  const subjectHint =
    subject === 'commercial'
      ? '商業簿記（財務会計）中心'
      : subject === 'industrial'
        ? '工業簿記（原価計算）中心'
        : '商業/工業どちらでも可（内容から判断）';

  const userPrompt = [
    `【目的】ユーザーの理解定着。カード枚数の目安: ${count}枚。`,
    `【分野の希望】${subjectHint}`,
    '',
    '【ユーザーのメモ】',
    memo ?? '(なし)',
    '',
    '【作成ルール】',
    '- それぞれ「問題文」「ヒント」「回答」「解説」を作る。',
    '- ヒントは短く（1行）。不要なら空文字でもOK。',
    '- 解説は、間違えやすいポイントも一言入れる。',
  ].join('\n');

  const inputContent: any[] = [{ type: 'input_text', text: userPrompt }];
  for (const img of images) {
    inputContent.push({ type: 'input_image', image_url: img });
  }

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      cards: {
        type: 'array',
        minItems: 1,
        maxItems: 20,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            question: { type: 'string' },
            hint: { type: 'string' },
            answer: { type: 'string' },
            explanation: { type: 'string' },
          },
          required: ['question', 'hint', 'answer', 'explanation'],
        },
      },
    },
    required: ['cards'],
  };

  const openaiBody = {
    model,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: inputContent },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'boki_flashcards',
        schema,
        strict: true,
      },
    },
  };

  const openaiRes = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(openaiBody),
  });

  const openaiJson = await openaiRes.json().catch(() => null);

  if (!openaiRes.ok) {
    const msg =
      openaiJson?.error?.message ||
      openaiJson?.message ||
      `OpenAI API error (HTTP ${openaiRes.status})`;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const outputText = extractOutputText(openaiJson);
  if (!outputText) {
    return NextResponse.json({ error: 'AI応答の解析に失敗しました（output_textが見つかりません）。' }, { status: 500 });
  }

  let parsed: any;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    return NextResponse.json({ error: 'AI応答がJSONとして解析できませんでした。' }, { status: 500 });
  }

  const cards = Array.isArray(parsed?.cards) ? parsed.cards : null;
  if (!cards || cards.length === 0) {
    return NextResponse.json({ error: 'AIがカードを生成できませんでした。' }, { status: 500 });
  }

  // Create deck
  const { data: deck, error: deckError } = await supabase
    .from('flashcard_decks')
    .insert({
      user_id: user.id,
      title,
      subject,
      memo,
      images: [],
    })
    .select('*')
    .single();

  if (deckError || !deck) {
    return NextResponse.json({ error: `デッキ保存に失敗しました: ${deckError?.message}` }, { status: 500 });
  }

  const rows = cards
    .map((c: any) => ({
      user_id: user.id,
      deck_id: deck.id,
      status: 'learning',
      question: safeTrim(c?.question, 400),
      hint: safeTrim(c?.hint, 200),
      answer: safeTrim(c?.answer, 800),
      explanation: safeTrim(c?.explanation, 2000),
    }))
    .filter((r: any) => r.question && r.answer && r.explanation);

  if (rows.length === 0) {
    return NextResponse.json({ error: '生成結果が空でした（カード内容が不正）。' }, { status: 500 });
  }

  const { error: insertError } = await supabase.from('flashcards').insert(rows);

  if (insertError) {
    return NextResponse.json({ error: `カード保存に失敗しました: ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ deck_id: deck.id, created: rows.length });
}

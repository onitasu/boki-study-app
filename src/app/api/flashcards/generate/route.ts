import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Subject = 'mixed' | 'commercial' | 'industrial';
const MAX_IMAGE_COUNT = 3;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function extensionFromMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/heic':
      return '.heic';
    default:
      return '';
  }
}

function extractOutputText(resp: any): string | null {
  // Try direct output_text field
  if (typeof resp?.output_text === 'string') return resp.output_text;

  // Try output array
  const output = resp?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item?.type === 'message' && Array.isArray(item?.content)) {
        for (const c of item.content) {
          if (c?.type === 'output_text' && typeof c?.text === 'string') {
            return c.text;
          }
          // Also try 'text' type
          if (c?.type === 'text' && typeof c?.text === 'string') {
            return c.text;
          }
        }
      }
    }
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

  console.log('[Flashcard API] Starting request');
  console.log('[Flashcard API] Model:', model);

  if (!apiKey) {
    console.error('[Flashcard API] OPENAI_API_KEY not set');
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
    console.error('[Flashcard API] Unauthorized');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();

  const title = safeTrim(formData.get('title'), 120) || null;
  const memo = safeTrim(formData.get('memo'), 5000) || null;
  const subject = (safeTrim(formData.get('subject'), 20) || 'mixed') as Subject;
  const folderId = safeTrim(formData.get('folder_id'), 80) || null;

  const rawCount = Number(formData.get('count') ?? 8);
  const count = clamp(Number.isFinite(rawCount) ? rawCount : 8, 1, 20);

  const imageFiles = formData.getAll('images').filter((x) => x instanceof File) as File[];

  console.log('[Flashcard API] Title:', title);
  console.log('[Flashcard API] Memo length:', memo?.length ?? 0);
  console.log('[Flashcard API] Image count:', imageFiles.length);
  console.log('[Flashcard API] Folder:', folderId ?? 'none');

  if (imageFiles.length === 0 && !memo) {
    return NextResponse.json({ error: '画像またはメモのどちらかは必要です。' }, { status: 400 });
  }

  if (folderId) {
    const { data: folder, error: folderError } = await supabase
      .from('flashcard_folders')
      .select('id')
      .eq('id', folderId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (folderError) {
      console.error('[Flashcard API] Folder lookup error:', folderError);
      return NextResponse.json({ error: `フォルダ確認に失敗しました: ${folderError.message}` }, { status: 500 });
    }

    if (!folder) {
      return NextResponse.json({ error: '指定したフォルダが見つかりません。' }, { status: 400 });
    }
  }

  const uploadedImages: Array<{
    bucket: string;
    path: string;
    content_type: string | null;
    size: number;
  }> = [];
  const imageUrls: string[] = [];

  if (imageFiles.length > 0) {
    const bucket = process.env.FLASHCARD_IMAGE_BUCKET || 'flashcard-images';
    console.log('[Flashcard API] Uploading images to bucket:', bucket);

    for (const file of imageFiles.slice(0, MAX_IMAGE_COUNT)) {
      const ab = await file.arrayBuffer();
      const buf = Buffer.from(ab);
      const ext = extensionFromMime(file.type || '');
      const objectPath = `flashcards/${user.id}/${Date.now()}-${randomUUID()}${ext}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, buf, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

      if (uploadError) {
        console.error('[Flashcard API] Image upload error:', uploadError);
        return NextResponse.json(
          {
            error:
              '画像のアップロードに失敗しました。Supabase Storage のバケット作成とポリシー設定を確認してください。',
          },
          { status: 500 }
        );
      }

      const { data: signed, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(objectPath, 60 * 10);

      if (signedError || !signed?.signedUrl) {
        console.error('[Flashcard API] Signed URL error:', signedError);
        return NextResponse.json(
          {
            error:
              '画像URLの生成に失敗しました。Supabase Storage の署名付きURL設定を確認してください。',
          },
          { status: 500 }
        );
      }

      imageUrls.push(signed.signedUrl);
      uploadedImages.push({
        bucket,
        path: objectPath,
        content_type: file.type || null,
        size: file.size,
      });
    }
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
  for (const url of imageUrls) {
    inputContent.push({ type: 'input_image', image_url: url });
  }

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      cards: {
        type: 'array',
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

  console.log('[Flashcard API] Calling OpenAI Responses API...');
  console.log('[Flashcard API] Request body:', JSON.stringify(openaiBody, null, 2).slice(0, 500) + '...');

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(openaiBody),
    });

    const openaiJson = await openaiRes.json().catch(() => null);

    console.log('[Flashcard API] OpenAI response status:', openaiRes.status);
    console.log('[Flashcard API] OpenAI response:', JSON.stringify(openaiJson, null, 2).slice(0, 1000));

    if (!openaiRes.ok) {
      const msg =
        openaiJson?.error?.message ||
        openaiJson?.message ||
        `OpenAI API error (HTTP ${openaiRes.status})`;
      console.error('[Flashcard API] OpenAI error:', msg);
      console.error('[Flashcard API] Full error response:', JSON.stringify(openaiJson, null, 2));
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const outputText = extractOutputText(openaiJson);
    console.log('[Flashcard API] Extracted output_text:', outputText ? outputText.slice(0, 200) + '...' : 'null');

    if (!outputText) {
      console.error('[Flashcard API] Could not extract output_text from response');
      console.error('[Flashcard API] Full response structure:', JSON.stringify(openaiJson, null, 2));
      return NextResponse.json({ error: 'AI応答の解析に失敗しました（output_textが見つかりません）。' }, { status: 500 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(outputText);
    } catch (e) {
      console.error('[Flashcard API] JSON parse error:', e);
      console.error('[Flashcard API] Raw output_text:', outputText);
      return NextResponse.json({ error: 'AI応答がJSONとして解析できませんでした。' }, { status: 500 });
    }

    const cards = Array.isArray(parsed?.cards) ? parsed.cards : null;
    if (!cards || cards.length === 0) {
      console.error('[Flashcard API] No cards found in parsed response:', parsed);
      return NextResponse.json({ error: 'AIがカードを生成できませんでした。' }, { status: 500 });
    }

    console.log('[Flashcard API] Generated', cards.length, 'cards');

    // Create deck
    const { data: deck, error: deckError } = await supabase
      .from('flashcard_decks')
      .insert({
        user_id: user.id,
        title,
        subject,
        folder_id: folderId,
        memo,
        images: uploadedImages,
      })
      .select('*')
      .single();

    if (deckError || !deck) {
      console.error('[Flashcard API] Deck creation error:', deckError);
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
      console.error('[Flashcard API] Card insert error:', insertError);
      return NextResponse.json({ error: `カード保存に失敗しました: ${insertError.message}` }, { status: 500 });
    }

    console.log('[Flashcard API] Success! Created', rows.length, 'cards in deck', deck.id);
    return NextResponse.json({ deck_id: deck.id, created: rows.length });
  } catch (error) {
    console.error('[Flashcard API] Unexpected error:', error);
    return NextResponse.json({ error: `予期しないエラーが発生しました: ${error}` }, { status: 500 });
  }
}

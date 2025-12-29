import Link from 'next/link';
import { Stack, Typography, Button, Card, CardContent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { createClient } from '@/lib/supabase/server';
import type { Flashcard, FlashcardDeck, FlashcardFolder } from '@/lib/types';
import FlashcardsView from '@/components/FlashcardsView';

export default async function FlashcardsPage({
  searchParams,
}: {
  searchParams?: { deck?: string; folder?: string; status?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <Typography>ログインしてください。</Typography>;
  }

  const selectedDeckId = (searchParams?.deck ?? '').trim() || null;
  const selectedFolderId = (searchParams?.folder ?? '').trim() || null;

  const { data: decks, error: deckError } = await supabase
    .from('flashcard_decks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (deckError) {
    return <Typography>デッキ取得に失敗しました: {deckError.message}</Typography>;
  }

  const { data: folders, error: folderError } = await supabase
    .from('flashcard_folders')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (folderError) {
    return <Typography>フォルダ取得に失敗しました: {folderError.message}</Typography>;
  }

  let cardsQuery = supabase
    .from('flashcards')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(300);


  const { data: cards, error: cardError } = await cardsQuery;

  if (cardError) {
    return <Typography>カード取得に失敗しました: {cardError.message}</Typography>;
  }

  const hasAny = (cards ?? []).length > 0;

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack spacing={0.5}>
              <Typography variant="h6" fontWeight={700}>
                フラッシュカード
              </Typography>
              <Typography variant="body2" color="text.secondary">
                画像＋メモからAIが問題を作成します（教材本文の転載は避けます）。
              </Typography>
            </Stack>
            <Button
              component={Link}
              href="/flashcards/new"
              variant="contained"
              startIcon={<AddIcon />}
            >
              作成
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {!hasAny ? (
        <Typography color="text.secondary">
          まだカードがありません。「作成」から、テキスト写真とメモを送って生成してみてください。
        </Typography>
      ) : (
        <FlashcardsView
          initialDecks={(decks as FlashcardDeck[]) ?? []}
          initialFolders={(folders as FlashcardFolder[]) ?? []}
          initialCards={(cards as Flashcard[]) ?? []}
          selectedDeckId={selectedDeckId}
          selectedFolderId={selectedFolderId}
        />
      )}
    </Stack>
  );
}

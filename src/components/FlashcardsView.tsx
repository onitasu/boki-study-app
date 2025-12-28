'use client';

import * as React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ReplayIcon from '@mui/icons-material/Replay';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { createClient } from '@/lib/supabase/client';
import type { Flashcard, FlashcardDeck, FlashcardStatus } from '@/lib/types';

function subjectLabel(subject: FlashcardDeck['subject']): string {
  if (subject === 'commercial') return '商業';
  if (subject === 'industrial') return '工業';
  return '自動';
}

function deckLabel(deck: FlashcardDeck): string {
  const t = deck.title?.trim();
  return t && t.length > 0 ? t : `デッキ（${subjectLabel(deck.subject)}）`;
}

function statusLabel(status: FlashcardStatus) {
  return status === 'mastered' ? '理解済み' : '未理解';
}

function FlashcardItem({
  card,
  onToggleMastered,
  onDelete,
}: {
  card: Flashcard;
  onToggleMastered: (card: Flashcard) => void;
  onDelete: (card: Flashcard) => void;
}) {
  const [showAnswer, setShowAnswer] = React.useState(false);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip
              size="small"
              label={statusLabel(card.status)}
              color={card.status === 'mastered' ? 'success' : 'default'}
              variant={card.status === 'mastered' ? 'filled' : 'outlined'}
            />
          </Stack>

          <Typography variant="subtitle1" fontWeight={700}>
            Q. {card.question}
          </Typography>

          {card.hint ? (
            <Typography variant="body2" color="text.secondary">
              ヒント: {card.hint}
            </Typography>
          ) : null}

          {showAnswer ? (
            <>
              <Divider />
              <Typography variant="subtitle2" fontWeight={700}>
                回答
              </Typography>
              <Typography variant="body1">{card.answer}</Typography>

              <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1 }}>
                解説
              </Typography>
              <Typography variant="body2" color="text.secondary" whiteSpace="pre-wrap">
                {card.explanation}
              </Typography>
            </>
          ) : null}

          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Button
              size="small"
              startIcon={showAnswer ? <VisibilityOffIcon /> : <VisibilityIcon />}
              onClick={() => setShowAnswer((s) => !s)}
            >
              {showAnswer ? '隠す' : '答えを見る'}
            </Button>

            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                size="small"
                variant={card.status === 'mastered' ? 'outlined' : 'contained'}
                color={card.status === 'mastered' ? 'inherit' : 'success'}
                startIcon={card.status === 'mastered' ? <ReplayIcon /> : <CheckCircleIcon />}
                onClick={() => onToggleMastered(card)}
              >
                {card.status === 'mastered' ? 'まだ' : '理解した'}
              </Button>
              <IconButton aria-label="delete" onClick={() => onDelete(card)}>
                <DeleteIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function FlashcardsView({
  initialDecks,
  initialCards,
  selectedDeckId,
}: {
  initialDecks: FlashcardDeck[];
  initialCards: Flashcard[];
  selectedDeckId: string | null;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [decks, setDecks] = React.useState<FlashcardDeck[]>(initialDecks);
  const [cards, setCards] = React.useState<Flashcard[]>(initialCards);

  const [deckId, setDeckId] = React.useState<string>('__all__');
  const [tab, setTab] = React.useState<'learning' | 'mastered'>('learning');

  const [deleteTarget, setDeleteTarget] = React.useState<Flashcard | null>(null);

  // initialize selection
  React.useEffect(() => {
    if (selectedDeckId) setDeckId(selectedDeckId);
  }, [selectedDeckId]);

  const filteredCards = React.useMemo(() => {
    const byDeck =
      deckId === '__all__' ? cards : cards.filter((c) => c.deck_id === deckId);
    return byDeck.filter((c) => c.status === tab);
  }, [cards, deckId, tab]);

  const learningCount = React.useMemo(() => {
    const byDeck =
      deckId === '__all__' ? cards : cards.filter((c) => c.deck_id === deckId);
    return byDeck.filter((c) => c.status === 'learning').length;
  }, [cards, deckId]);

  const masteredCount = React.useMemo(() => {
    const byDeck =
      deckId === '__all__' ? cards : cards.filter((c) => c.deck_id === deckId);
    return byDeck.filter((c) => c.status === 'mastered').length;
  }, [cards, deckId]);

  async function setCardStatus(cardId: string, status: FlashcardStatus) {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status } : c)));
    const { error } = await supabase.from('flashcards').update({ status }).eq('id', cardId);
    if (error) {
      alert(`更新に失敗しました: ${error.message}`);
    }
  }

  async function toggleMastered(card: Flashcard) {
    const next: FlashcardStatus = card.status === 'mastered' ? 'learning' : 'mastered';
    await setCardStatus(card.id, next);
  }

  async function deleteCard(card: Flashcard) {
    setDeleteTarget(card);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);

    setCards((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from('flashcards').delete().eq('id', id);
    if (error) {
      alert(`削除に失敗しました: ${error.message}`);
    }
  }

  // Quick review (one card at a time) for learning
  const learningCardsForReview = React.useMemo(() => {
    const byDeck =
      deckId === '__all__' ? cards : cards.filter((c) => c.deck_id === deckId);
    return byDeck.filter((c) => c.status === 'learning');
  }, [cards, deckId]);

  const [reviewIndex, setReviewIndex] = React.useState(0);
  React.useEffect(() => {
    setReviewIndex(0);
  }, [deckId]);

  const reviewCard = learningCardsForReview[reviewIndex] ?? null;

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <FormControl fullWidth>
                <InputLabel id="deck-label">デッキ</InputLabel>
                <Select
                  labelId="deck-label"
                  label="デッキ"
                  value={deckId}
                  onChange={(e) => setDeckId(String(e.target.value))}
                >
                  <MenuItem value="__all__">すべて</MenuItem>
                  {decks.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {deckLabel(d)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Chip size="small" label={`未理解: ${learningCount}`} />
                <Chip size="small" label={`理解済み: ${masteredCount}`} />
              </Stack>
            </Stack>

            {reviewCard ? (
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                      クイックテスト（未理解から）
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {reviewIndex + 1}/{learningCardsForReview.length}：{reviewCard.question}
                    </Typography>

                    {reviewCard.hint ? (
                      <Typography variant="body2" color="text.secondary">
                        ヒント: {reviewCard.hint}
                      </Typography>
                    ) : null}

                    <Box>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<NavigateNextIcon />}
                        onClick={() =>
                          setReviewIndex((i) =>
                            learningCardsForReview.length === 0 ? 0 : (i + 1) % learningCardsForReview.length
                          )
                        }
                      >
                        次へ
                      </Button>
                      <Button
                        size="small"
                        sx={{ ml: 1 }}
                        variant="contained"
                        color="success"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => toggleMastered(reviewCard)}
                      >
                        理解した
                      </Button>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      ここは“思い出す練習”用です。詳細は下のカードで「答えを見る」を使ってください。
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            ) : (
              <Typography variant="body2" color="text.secondary">
                未理解のカードがありません。すべて理解済みです！
              </Typography>
            )}

            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="fullWidth"
              textColor="primary"
              indicatorColor="primary"
            >
              <Tab value="learning" label="未理解" />
              <Tab value="mastered" label="理解済み" />
            </Tabs>
          </Stack>
        </CardContent>
      </Card>

      {filteredCards.length === 0 ? (
        <Typography color="text.secondary">
          {tab === 'learning' ? '未理解のカードがありません。' : '理解済みのカードがありません。'}
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {filteredCards.map((c) => (
            <FlashcardItem
              key={c.id}
              card={c}
              onToggleMastered={toggleMastered}
              onDelete={deleteCard}
            />
          ))}
        </Stack>
      )}

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>カードを削除しますか？</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            この操作は取り消せません。
          </Typography>
          <Typography sx={{ mt: 1 }}>
            {deleteTarget?.question}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>キャンセル</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            削除
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

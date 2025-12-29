'use client';

import * as React from 'react';
import {
  Alert,
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
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ReplayIcon from '@mui/icons-material/Replay';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Flashcard, FlashcardDeck, FlashcardFolder, FlashcardStatus } from '@/lib/types';

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
  initialFolders,
  initialCards,
  selectedDeckId,
  selectedFolderId,
}: {
  initialDecks: FlashcardDeck[];
  initialFolders: FlashcardFolder[];
  initialCards: Flashcard[];
  selectedDeckId: string | null;
  selectedFolderId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = React.useMemo(() => createClient(), []);
  const [decks] = React.useState<FlashcardDeck[]>(initialDecks);
  const [folders, setFolders] = React.useState<FlashcardFolder[]>(initialFolders);
  const [cards, setCards] = React.useState<Flashcard[]>(initialCards);

  const [folderId, setFolderId] = React.useState<string>('__all__');
  const [deckId, setDeckId] = React.useState<string>('__all__');
  const [tab, setTab] = React.useState<'learning' | 'mastered'>('learning');
  const [viewMode, setViewMode] = React.useState<'review' | 'list'>('review');

  const [deleteTarget, setDeleteTarget] = React.useState<Flashcard | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false);
  const [folderName, setFolderName] = React.useState('');
  const [folderError, setFolderError] = React.useState<string | null>(null);

  // initialize selection
  React.useEffect(() => {
    if (!selectedDeckId) return;
    setDeckId(selectedDeckId);
    const deck = decks.find((d) => d.id === selectedDeckId);
    if (deck?.folder_id) {
      setFolderId(deck.folder_id);
    } else {
      setFolderId('__all__');
    }
  }, [selectedDeckId, decks]);

  React.useEffect(() => {
    if (!selectedFolderId) return;
    setFolderId(selectedFolderId);
  }, [selectedFolderId]);

  const hasFolderParam = searchParams.has('folder');
  const hasDeckParam = searchParams.has('deck');
  const currentFolderParam = searchParams.get('folder') ?? '__all__';
  const currentDeckParam = searchParams.get('deck') ?? '__all__';

  React.useEffect(() => {
    if (hasFolderParam) {
      setFolderId((prev) => (prev === currentFolderParam ? prev : currentFolderParam));
    }
    if (hasDeckParam) {
      setDeckId((prev) => (prev === currentDeckParam ? prev : currentDeckParam));
    }
  }, [currentFolderParam, currentDeckParam, hasFolderParam, hasDeckParam]);

  React.useEffect(() => {
    if (currentFolderParam === folderId && currentDeckParam === deckId) return;
    const params = new URLSearchParams(searchParams.toString());
    if (folderId === '__all__') {
      params.delete('folder');
    } else {
      params.set('folder', folderId);
    }
    if (deckId === '__all__') {
      params.delete('deck');
    } else {
      params.set('deck', deckId);
    }
    const qs = params.toString();
    router.replace(qs ? `/flashcards?${qs}` : '/flashcards', { scroll: false });
  }, [folderId, deckId, currentFolderParam, currentDeckParam, router, searchParams]);

  React.useEffect(() => {
    if (deckId === '__all__') return;
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) {
      setDeckId('__all__');
      return;
    }
    if (folderId !== '__all__' && deck.folder_id !== folderId) {
      setDeckId('__all__');
    }
  }, [folderId, deckId, decks]);

  const visibleDecks = React.useMemo(() => {
    if (folderId === '__all__') return decks;
    return decks.filter((d) => d.folder_id === folderId);
  }, [decks, folderId]);

  const cardsByFolder = React.useMemo(() => {
    if (folderId === '__all__') return cards;
    const allowed = new Set(visibleDecks.map((d) => d.id));
    return cards.filter((c) => allowed.has(c.deck_id));
  }, [cards, folderId, visibleDecks]);

  const cardsByDeck = React.useMemo(() => {
    return deckId === '__all__' ? cardsByFolder : cardsByFolder.filter((c) => c.deck_id === deckId);
  }, [cardsByFolder, deckId]);

  const filteredCards = React.useMemo(() => {
    return cardsByDeck.filter((c) => c.status === tab);
  }, [cardsByDeck, tab]);

  const learningCount = React.useMemo(() => {
    return cardsByDeck.filter((c) => c.status === 'learning').length;
  }, [cardsByDeck]);

  const masteredCount = React.useMemo(() => {
    return cardsByDeck.filter((c) => c.status === 'mastered').length;
  }, [cardsByDeck]);

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

  async function createFolder() {
    const name = folderName.trim();
    if (!name) {
      setFolderError('フォルダ名を入力してください。');
      return;
    }
    setFolderError(null);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setFolderError('ログイン情報の取得に失敗しました。');
      return;
    }
    const { data, error: insertError } = await supabase
      .from('flashcard_folders')
      .insert({ user_id: user.id, name })
      .select('*')
      .single();
    if (insertError || !data) {
      setFolderError(`作成に失敗しました: ${insertError?.message ?? 'unknown error'}`);
      return;
    }
    setFolders((prev) => [data as FlashcardFolder, ...prev]);
    setFolderId(data.id);
    setFolderName('');
    setFolderDialogOpen(false);
  }

  // Swipe review (one card at a time) for learning
  const learningCardsForReview = React.useMemo(() => {
    return cardsByDeck.filter((c) => c.status === 'learning');
  }, [cardsByDeck]);

  const [reviewIndex, setReviewIndex] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [dragX, setDragX] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartX = React.useRef(0);
  const dragStartY = React.useRef(0);
  const dragXRef = React.useRef(0);
  const pointerIdRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setReviewIndex(0);
    setFlipped(false);
    setDragX(0);
    dragXRef.current = 0;
  }, [deckId, folderId]);

  React.useEffect(() => {
    if (reviewIndex >= learningCardsForReview.length) {
      setReviewIndex(0);
    }
  }, [learningCardsForReview.length, reviewIndex]);

  const reviewCard = learningCardsForReview[reviewIndex] ?? null;
  const canSwipe = flipped && !!reviewCard;
  const swipeThreshold = 90;

  function resetDrag() {
    dragXRef.current = 0;
    setDragX(0);
  }

  function goNextCard() {
    if (learningCardsForReview.length === 0) return;
    setReviewIndex((i) => (i + 1) % learningCardsForReview.length);
    setFlipped(false);
    resetDrag();
  }

  function handleSwipe(direction: 'left' | 'right') {
    if (!reviewCard) return;
    const nextStatus: FlashcardStatus = direction === 'right' ? 'mastered' : 'learning';
    void setCardStatus(reviewCard.id, nextStatus);
    goNextCard();
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!canSwipe) return;
    pointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    setIsDragging(true);
    resetDrag();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDragging || pointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - dragStartX.current;
    const dy = e.clientY - dragStartY.current;
    if (Math.abs(dy) > Math.abs(dx)) return;
    dragXRef.current = dx;
    setDragX(dx);
  }

  function finishPointer(e: React.PointerEvent) {
    if (pointerIdRef.current !== e.pointerId) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDragging(false);
    const dx = dragXRef.current;
    resetDrag();
    if (Math.abs(dx) >= swipeThreshold) {
      handleSwipe(dx > 0 ? 'right' : 'left');
    }
  }

  const swipeStrength = Math.min(1, Math.abs(dragX) / swipeThreshold);
  const swipeDirection = dragX === 0 ? null : dragX > 0 ? 'right' : 'left';
  const swipeTransform = `translateX(${dragX}px) rotate(${dragX / 18}deg)`;

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' },
                gap: 2,
                alignItems: 'end',
              }}
            >
              <FormControl fullWidth>
                <InputLabel id="folder-label">フォルダ</InputLabel>
                <Select
                  labelId="folder-label"
                  label="フォルダ"
                  value={folderId}
                  onChange={(e) => {
                    setFolderId(String(e.target.value));
                    setDeckId('__all__');
                  }}
                >
                  <MenuItem value="__all__">すべて</MenuItem>
                  {folders.map((f) => (
                    <MenuItem key={f.id} value={f.id}>
                      {f.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel id="deck-label">デッキ</InputLabel>
                <Select
                  labelId="deck-label"
                  label="デッキ"
                  value={deckId}
                  onChange={(e) => setDeckId(String(e.target.value))}
                >
                  <MenuItem value="__all__">すべて</MenuItem>
                  {visibleDecks.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {deckLabel(d)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="outlined"
                startIcon={<CreateNewFolderIcon />}
                onClick={() => {
                  setFolderName('');
                  setFolderError(null);
                  setFolderDialogOpen(true);
                }}
                sx={{ whiteSpace: 'nowrap', width: { xs: '100%', sm: 'auto' } }}
              >
                フォルダ作成
              </Button>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip size="small" label={`未理解: ${learningCount}`} />
              <Chip size="small" label={`理解済み: ${masteredCount}`} />
            </Stack>

            <Tabs
              value={viewMode}
              onChange={(_, v) => setViewMode(v)}
              variant="fullWidth"
              textColor="primary"
              indicatorColor="primary"
            >
              <Tab value="review" label="スワイプ学習" />
              <Tab value="list" label="一覧" />
            </Tabs>
          </Stack>
        </CardContent>
      </Card>

      {viewMode === 'review' ? (
        reviewCard ? (
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={2} alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle2" color="text.secondary">
                    スワイプ学習（未理解から）
                  </Typography>
                  <Chip size="small" label={`${reviewIndex + 1}/${learningCardsForReview.length}`} />
                </Stack>

                <Box
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={finishPointer}
                  onPointerCancel={finishPointer}
                  sx={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: 560,
                    touchAction: 'pan-y',
                    userSelect: 'none',
                    transform: swipeTransform,
                    transition: isDragging ? 'none' : 'transform 0.2s ease',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 16,
                      top: 16,
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: 'success.light',
                      color: 'success.contrastText',
                      opacity: swipeDirection === 'right' ? swipeStrength : 0,
                      pointerEvents: 'none',
                      zIndex: 2,
                    }}
                  >
                    正解
                  </Box>
                  <Box
                    sx={{
                      position: 'absolute',
                      right: 16,
                      top: 16,
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: 'error.light',
                      color: 'error.contrastText',
                      opacity: swipeDirection === 'left' ? swipeStrength : 0,
                      pointerEvents: 'none',
                      zIndex: 2,
                    }}
                  >
                    不正解
                  </Box>

                  <Box
                    sx={{
                      position: 'relative',
                      minHeight: 240,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      boxShadow: 1,
                      transformStyle: 'preserve-3d',
                      transition: 'transform 0.35s ease',
                      transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        p: 2,
                        backfaceVisibility: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        表
                      </Typography>
                      <Typography variant="subtitle1" fontWeight={700}>
                        Q. {reviewCard.question}
                      </Typography>
                      {reviewCard.hint ? (
                        <Typography variant="body2" color="text.secondary">
                          ヒント: {reviewCard.hint}
                        </Typography>
                      ) : null}
                    </Box>

                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        p: 2,
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        overflowY: 'auto',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        裏
                      </Typography>
                      <Typography variant="subtitle2" fontWeight={700}>
                        回答
                      </Typography>
                      <Typography variant="body1">{reviewCard.answer}</Typography>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1 }}>
                        解説
                      </Typography>
                      <Typography variant="body2" color="text.secondary" whiteSpace="pre-wrap">
                        {reviewCard.explanation}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" onClick={() => setFlipped(false)} disabled={!flipped}>
                    問題に戻す
                  </Button>
                  <Button variant="contained" onClick={() => setFlipped(true)} disabled={flipped}>
                    答えを見る
                  </Button>
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Button color="error" variant="outlined" disabled={!flipped} onClick={() => handleSwipe('left')}>
                    不正解
                  </Button>
                  <Button color="success" variant="contained" disabled={!flipped} onClick={() => handleSwipe('right')}>
                    正解
                  </Button>
                </Stack>

                <Typography variant="caption" color="text.secondary">
                  裏面を見たあと、右スワイプで正解 / 左スワイプで不正解
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <Typography variant="body2" color="text.secondary">
            未理解のカードがありません。すべて理解済みです！
          </Typography>
        )
      ) : (
        <>
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
        </>
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

      <Dialog open={folderDialogOpen} onClose={() => setFolderDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>フォルダを作成</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="フォルダ名"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              autoFocus
            />
            {folderError ? <Alert severity="error">{folderError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderDialogOpen(false)}>キャンセル</Button>
          <Button onClick={createFolder} variant="contained">
            作成
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

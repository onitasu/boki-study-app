'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import { createClient } from '@/lib/supabase/client';
import type { FlashcardFolder } from '@/lib/types';

type Subject = 'mixed' | 'commercial' | 'industrial';
type LoadedImage = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  cleanup: () => void;
};

const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.82;

async function loadImageSource(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
      cleanup: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  if (typeof img.decode === 'function') {
    await img.decode();
  } else {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image decode failed'));
    });
  }
  URL.revokeObjectURL(url);

  return {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    draw: (ctx, width, height) => ctx.drawImage(img, 0, 0, width, height),
    cleanup: () => {},
  };
}

async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  let source: LoadedImage | null = null;
  try {
    source = await loadImageSource(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(source.width, source.height));
    const targetWidth = Math.max(1, Math.round(source.width * scale));
    const targetHeight = Math.max(1, Math.round(source.height * scale));

    if (scale === 1 && file.size <= 1_500_000 && file.type !== 'image/heic') {
      source.cleanup();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      source.cleanup();
      return file;
    }

    source.draw(ctx, targetWidth, targetHeight);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    source.cleanup();

    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    source?.cleanup();
    return file;
  }
}

async function compressImageList(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const converted = await compressImageFile(file);
    out.push(converted);
  }
  return out;
}

export default function NewFlashcardsPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [title, setTitle] = React.useState<string>('');
  const [subject, setSubject] = React.useState<Subject>('mixed');
  const [count, setCount] = React.useState<number>(8);
  const [memo, setMemo] = React.useState<string>('');
  const [files, setFiles] = React.useState<File[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [processingImages, setProcessingImages] = React.useState<boolean>(false);
  const [processingError, setProcessingError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [folders, setFolders] = React.useState<FlashcardFolder[]>([]);
  const [folderId, setFolderId] = React.useState<string>('');
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false);
  const [folderName, setFolderName] = React.useState('');
  const [folderError, setFolderError] = React.useState<string | null>(null);
  const [folderLoadError, setFolderLoadError] = React.useState<string | null>(null);

  const totalBytes = React.useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files]);
  const totalMB = React.useMemo(() => (totalBytes / 1024 / 1024).toFixed(1), [totalBytes]);

  React.useEffect(() => {
    let active = true;
    async function loadFolders() {
      setFolderLoadError(null);
      const { data, error: loadError } = await supabase
        .from('flashcard_folders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!active) return;
      if (loadError) {
        console.error('[Flashcards] Folder load error:', loadError);
        setFolderLoadError('フォルダの取得に失敗しました。');
        return;
      }
      setFolders((data as FlashcardFolder[]) ?? []);
    }
    loadFolders();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    if (list.length === 0) {
      setFiles([]);
      return;
    }
    setProcessingImages(true);
    setProcessingError(null);
    try {
      const processed = await compressImageList(list);
      setFiles(processed);
    } catch {
      setFiles(list);
      setProcessingError('画像の圧縮に失敗しました。元の画像で続行します。');
    } finally {
      setProcessingImages(false);
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

  async function generate() {
    setError(null);
    if (processingImages) {
      setError('画像の準備中です。少し待ってからもう一度お試しください。');
      return;
    }
    if (files.length === 0 && memo.trim() === '') {
      setError('画像またはメモのどちらかは入力してください。');
      return;
    }
    if (count < 1 || count > 20) {
      setError('カード枚数は1〜20の範囲で指定してください。');
      return;
    }

    // Vercel 等のリクエスト上限を踏まえて、画像サイズが大きい場合は事前にブロックします。
    // 目安: 合計8MBを超える場合は、スクショ/圧縮して再アップロードしてください。
    if (totalBytes > 8 * 1024 * 1024) {
      setError('画像の合計サイズが大きすぎます（目安8MB以内）。スクリーンショットや画像圧縮で小さくしてから再度お試しください。');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set('title', title);
      fd.set('subject', subject);
      fd.set('count', String(count));
      fd.set('memo', memo);
      if (folderId) fd.set('folder_id', folderId);

      for (const file of files) {
        fd.append('images', file);
      }

      const res = await fetch('/api/flashcards/generate', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? `生成に失敗しました (HTTP ${res.status})`);
      }

      const deckId = data?.deck_id as string | undefined;
      router.push(deckId ? `/flashcards?deck=${encodeURIComponent(deckId)}` : '/flashcards');
    } catch (e: any) {
      setError(e?.message ?? '生成に失敗しました。');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="h6" fontWeight={700}>
              カード作成
            </Typography>
            <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/flashcards')}>
              戻る
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="タイトル（任意）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：材料費（棚卸減耗）で間違えたところ"
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel id="subject-label">分野</InputLabel>
                <Select
                  labelId="subject-label"
                  value={subject}
                  label="分野"
                  onChange={(e) => setSubject(e.target.value as Subject)}
                >
                  <MenuItem value="mixed">自動（商業/工業）</MenuItem>
                  <MenuItem value="commercial">商業</MenuItem>
                  <MenuItem value="industrial">工業</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="カード枚数（目安）"
                type="number"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                inputProps={{ min: 1, max: 20, step: 1 }}
                helperText="1〜20"
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
              <FormControl fullWidth>
                <InputLabel id="folder-label">フォルダ</InputLabel>
                <Select
                  labelId="folder-label"
                  value={folderId}
                  label="フォルダ"
                  onChange={(e) => setFolderId(String(e.target.value))}
                >
                  <MenuItem value="">フォルダなし</MenuItem>
                  {folders.map((folder) => (
                    <MenuItem key={folder.id} value={folder.id}>
                      {folder.name}
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
              >
                フォルダ作成
              </Button>
            </Stack>

            {folderLoadError ? <Alert severity="error">{folderLoadError}</Alert> : null}

            <Box>
              <Button variant="outlined" component="label">
                画像を選ぶ（複数OK）
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={onFilesChange}
                />
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                選択: {files.length}枚（合計 {totalMB} MB）
              </Typography>
            </Box>

            <TextField
              label="メモ（任意）"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              multiline
              minRows={4}
              placeholder="例：材料副費は材料費に含める。仕掛品の期首/期末の意味が混乱した…"
            />

            {processingImages ? (
              <Alert severity="info">画像を最適化中です。完了まで少しお待ちください。</Alert>
            ) : null}
            {processingError ? <Alert severity="warning">{processingError}</Alert> : null}

            <Alert severity="info">
              送信した画像とメモをもとに、AIが「問題文・ヒント・回答・解説」を作成します。
              著作権保護のため、教材の文章をそのまま長文で転載しない形で生成します。
            </Alert>

            <Button
              onClick={generate}
              variant="contained"
              startIcon={loading ? <CircularProgress size={18} /> : <AutoAwesomeIcon />}
              disabled={loading || processingImages}
            >
              {loading ? '生成中…' : processingImages ? '画像準備中…' : 'AIでフラッシュカード作成'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

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

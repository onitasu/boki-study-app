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

type Subject = 'mixed' | 'commercial' | 'industrial';

export default function NewFlashcardsPage() {
  const router = useRouter();
  const [title, setTitle] = React.useState<string>('');
  const [subject, setSubject] = React.useState<Subject>('mixed');
  const [count, setCount] = React.useState<number>(8);
  const [memo, setMemo] = React.useState<string>('');
  const [files, setFiles] = React.useState<File[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const totalBytes = React.useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files]);
  const totalMB = React.useMemo(() => (totalBytes / 1024 / 1024).toFixed(1), [totalBytes]);

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    setFiles(list);
  }

  async function generate() {
    setError(null);
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

            <Alert severity="info">
              送信した画像とメモをもとに、AIが「問題文・ヒント・回答・解説」を作成します。
              著作権保護のため、教材の文章をそのまま長文で転載しない形で生成します。
            </Alert>

            <Button
              onClick={generate}
              variant="contained"
              startIcon={loading ? <CircularProgress size={18} /> : <AutoAwesomeIcon />}
              disabled={loading}
            >
              {loading ? '生成中…' : 'AIでフラッシュカード作成'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import { signIn, signUp, type AuthState } from './actions';

const initialState: AuthState = { error: null, success: null };

function SubmitButton({ mode }: { mode: 'signin' | 'signup' }) {
  const { pending } = useFormStatus();

  return (
    <Button
      variant="contained"
      type="submit"
      size="large"
      disabled={pending}
      startIcon={pending ? <CircularProgress size={20} color="inherit" /> : null}
    >
      {pending
        ? (mode === 'signin' ? 'ログイン中...' : '登録中...')
        : (mode === 'signin' ? 'ログイン' : '新規登録')}
    </Button>
  );
}

export default function LoginPage() {
  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin');
  const [origin, setOrigin] = React.useState('');
  const [registeredEmail, setRegisteredEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const action = mode === 'signin' ? signIn : signUp;
  const [state, formAction] = useFormState(action, initialState);

  // 登録成功時にメールアドレスを保存
  React.useEffect(() => {
    if (state.success && mode === 'signup') {
      const form = document.querySelector('form');
      const emailInput = form?.querySelector('input[name="email"]') as HTMLInputElement;
      if (emailInput?.value) {
        setRegisteredEmail(emailInput.value);
      }
    }
  }, [state.success, mode]);

  // メール確認待ち画面
  if (registeredEmail) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Card sx={{ width: '100%', maxWidth: 480 }}>
          <CardContent>
            <Stack spacing={3} alignItems="center" sx={{ py: 2 }}>
              <MailOutlineIcon sx={{ fontSize: 64, color: 'primary.main' }} />
              <Typography variant="h5" fontWeight={700} textAlign="center">
                確認メールを送信しました
              </Typography>
              <Typography variant="body1" color="text.secondary" textAlign="center">
                <strong>{registeredEmail}</strong> に確認メールを送信しました。
              </Typography>
              <Alert severity="info" sx={{ width: '100%' }}>
                メールアプリを開いて、メール内のリンクをクリックして登録を完了してください。
              </Alert>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                メールが届かない場合は、迷惑メールフォルダをご確認ください。
              </Typography>
              <Divider sx={{ width: '100%' }} />
              <Button
                variant="text"
                onClick={() => {
                  setRegisteredEmail(null);
                  setMode('signin');
                }}
              >
                ログイン画面に戻る
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Card sx={{ width: '100%', maxWidth: 480 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5" fontWeight={700}>
              簿記2級 学習チェック
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supabase認証でログインして、商業簿記・工業簿記の学習計画と毎日のチェックを管理します。
            </Typography>

            {state.error && <Alert severity="error">{state.error}</Alert>}

            <Box component="form" action={formAction}>
              <Stack spacing={2}>
                <input type="hidden" name="origin" value={origin} />
                <TextField
                  name="email"
                  label="メールアドレス"
                  type="email"
                  required
                  fullWidth
                />
                <TextField
                  name="password"
                  label="パスワード"
                  type="password"
                  required
                  fullWidth
                />
                {mode === 'signup' && (
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    登録後、確認メールが届きます。メール内のリンクをクリックして登録を完了してください。
                  </Alert>
                )}
                <SubmitButton mode={mode} />
              </Stack>
            </Box>

            <Divider />

            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {mode === 'signin' ? 'アカウントがない？' : '既にアカウントがある？'}
              </Typography>
              <Button
                variant="text"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              >
                {mode === 'signin' ? '新規登録へ' : 'ログインへ'}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

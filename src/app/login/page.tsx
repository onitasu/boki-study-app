'use client';

import * as React from 'react';
import { useFormState } from 'react-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { signIn, signUp, type AuthState } from './actions';

const initialState: AuthState = { error: null };

export default function LoginPage() {
  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin');

  const action = mode === 'signin' ? signIn : signUp;
  const [state, formAction] = useFormState(action, initialState);

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
                <Button variant="contained" type="submit" size="large">
                  {mode === 'signin' ? 'ログイン' : '新規登録'}
                </Button>
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

            <Typography variant="caption" color="text.secondary">
              ※ Supabase側でメール確認を有効にしている場合、新規登録後に確認メールが届きます。
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

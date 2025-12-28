'use client';

import * as React from 'react';
import { useFormState } from 'react-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { createPlan, type SetupState } from './actions';
import { toISODateString } from '@/lib/date';

const initialState: SetupState = { error: null };

export default function SetupPage() {
  const [state, formAction] = useFormState(createPlan, initialState);

  const today = React.useMemo(() => toISODateString(new Date()), []);

  return (
    <Box>
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={700}>
          学習計画を作成
        </Typography>
        <Typography variant="body2" color="text.secondary">
          開始日と試験日、1日の学習時間を入力すると、商業簿記・工業簿記のテーマ（テキスト＋問題集）に沿って
          日割り計画を自動生成します。
        </Typography>

        {state.error && <Alert severity="error">{state.error}</Alert>}

        <Card>
          <CardContent>
            <Box component="form" action={formAction}>
              <Stack spacing={2}>
                <TextField
                  name="start_date"
                  label="勉強開始日"
                  type="date"
                  defaultValue={today}
                  InputLabelProps={{ shrink: true }}
                  required
                />
                <TextField
                  name="exam_date"
                  label="試験日"
                  type="date"
                  defaultValue="2026-02-22"
                  InputLabelProps={{ shrink: true }}
                  required
                />
                <TextField
                  name="daily_minutes"
                  label="1日の学習時間（分）"
                  type="number"
                  defaultValue={150}
                  inputProps={{ min: 30, max: 600, step: 5 }}
                  required
                  helperText="例：2.5時間なら150"
                />
                <TextField
                  name="rest_days_per_week"
                  label="休み日（週あたり）"
                  type="number"
                  defaultValue={1}
                  inputProps={{ min: 0, max: 2, step: 1 }}
                  helperText="0〜2（おすすめは1）。休み日は日曜（+水曜）として扱います。"
                />

                <Button variant="contained" type="submit" size="large">
                  計画を作成する
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        <Typography variant="caption" color="text.secondary">
          ※ 既存の計画がある場合は自動的にアーカイブして、新しい計画を作り直します。
        </Typography>
      </Stack>
    </Box>
  );
}

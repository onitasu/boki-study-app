import Link from 'next/link';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import { createClient } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <Typography>ログインしてください。</Typography>;
  }

  const { data: plan } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        設定
      </Typography>

      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              ログイン中
            </Typography>
            <Typography>{user.email}</Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              現在の学習計画
            </Typography>
            {plan ? (
              <>
                <Typography>開始日: {plan.start_date}</Typography>
                <Typography>試験日: {plan.exam_date}</Typography>
                <Typography>1日: {plan.daily_minutes}分</Typography>
                <Typography>休み: 週{plan.rest_days_per_week}日（目安）</Typography>
              </>
            ) : (
              <Typography>未作成</Typography>
            )}

            <Button component={Link} href="/setup" variant="contained">
              計画を作り直す
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Alert severity="info">
        通知が必要なら、iPhoneの「時計」アプリで毎日の学習時間にアラームを設定するのが簡単です。
        例: 20:00 学習開始 / 22:30 チェック（タスク完了）
      </Alert>
    </Stack>
  );
}

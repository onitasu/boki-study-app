import {
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { createClient } from '@/lib/supabase/server';
import type { Task, Theme } from '@/lib/types';

function subjectLabel(s: Theme['subject']) {
  return s === 'commercial' ? '商業簿記' : '工業簿記';
}

export default async function ThemesPage() {
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

  if (!plan) {
    return <Typography>学習計画がありません。設定から作成してください。</Typography>;
  }

  const { data: themes, error: themeError } = await supabase
    .from('themes')
    .select('*')
    .order('subject', { ascending: true })
    .order('display_order', { ascending: true });

  if (themeError || !themes) {
    return <Typography>テーマ取得に失敗しました。</Typography>;
  }

  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('plan_id', plan.id)
    .not('theme_id', 'is', null);

  if (taskError) {
    return <Typography>進捗取得に失敗しました。</Typography>;
  }

  const byTheme: Record<string, { done: number; total: number }> = {};
  for (const t of (tasks as Task[]) ?? []) {
    if (!t.theme_id) continue;
    byTheme[t.theme_id] = byTheme[t.theme_id] ?? { done: 0, total: 0 };
    byTheme[t.theme_id].total += 1;
    if (t.status === 'done') byTheme[t.theme_id].done += 1;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        テーマ進捗
      </Typography>
      <Typography variant="body2" color="text.secondary">
        商業簿記（テーマ00〜24）・工業簿記（テーマ01〜22）をそれぞれ「テキスト」「問題集」で管理します。
      </Typography>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>科目</TableCell>
            <TableCell>テーマ</TableCell>
            <TableCell>進捗</TableCell>
            <TableCell align="right">問題集</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(themes as Theme[]).map((th) => {
            const p = byTheme[th.id] ?? { done: 0, total: 0 };
            const ratio = p.total === 0 ? 0 : Math.round((p.done / p.total) * 100);
            return (
              <TableRow key={th.id}>
                <TableCell>
                  <Chip size="small" label={subjectLabel(th.subject)} />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={700}>
                    テーマ{th.code} {th.title}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={`${p.done}/${p.total}（${ratio}%）`} />
                </TableCell>
                <TableCell align="right">
                  {th.problem_page_start ? `p${th.problem_page_start}〜` : '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Stack>
  );
}

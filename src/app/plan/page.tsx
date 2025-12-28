import { Typography, Stack } from '@mui/material';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST, addDays, toISODateString } from '@/lib/date';
import PlanList from '@/components/PlanList';
import type { Task } from '@/lib/types';

function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

export default async function PlanPage() {
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

  const today = getTodayJST();
  const start = toISODateString(addDays(parseLocalDate(today), -7));
  const end = toISODateString(addDays(parseLocalDate(today), 30));

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('plan_id', plan.id)
    .gte('task_date', start)
    .lte('task_date', end)
    .order('task_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return <Typography>タスク取得に失敗しました: {error.message}</Typography>;
  }

  const tasksByDate: Record<string, Task[]> = {};
  for (const t of (tasks as Task[]) ?? []) {
    tasksByDate[t.task_date] = tasksByDate[t.task_date] ?? [];
    tasksByDate[t.task_date].push(t);
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5" fontWeight={700}>
        計画（直近）
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {start} 〜 {end}
      </Typography>
      <PlanList tasksByDate={tasksByDate} />
    </Stack>
  );
}

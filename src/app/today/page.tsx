import { Typography } from '@mui/material';
import { createClient } from '@/lib/supabase/server';
import { getTodayJST } from '@/lib/date';
import TaskList from '@/components/TaskList';
import type { Task } from '@/lib/types';

export default async function TodayPage() {
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

  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('plan_id', plan.id)
    .eq('task_date', today)
    .order('created_at', { ascending: true });

  if (error) {
    return <Typography>タスク取得に失敗しました: {error.message}</Typography>;
  }

  return <TaskList initialTasks={(tasks as Task[]) ?? []} dateLabel={today} />;
}

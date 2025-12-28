'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { generateTasks } from '@/lib/planner/generateTasks';
import type { Theme } from '@/lib/types';

export interface SetupState {
  error: string | null;
}

export async function createPlan(prevState: SetupState, formData: FormData): Promise<SetupState> {
  const startDate = String(formData.get('start_date') ?? '').trim();
  const examDate = String(formData.get('exam_date') ?? '').trim();
  const dailyMinutes = Number(formData.get('daily_minutes') ?? 0);
  const restDaysPerWeek = Number(formData.get('rest_days_per_week') ?? 1);

  if (!startDate || !examDate) {
    return { error: '開始日・試験日を入力してください。' };
  }
  if (!Number.isFinite(dailyMinutes) || dailyMinutes <= 0) {
    return { error: '1日の学習時間（分）を正しく入力してください。' };
  }
  if (!Number.isFinite(restDaysPerWeek) || restDaysPerWeek < 0 || restDaysPerWeek > 2) {
    return { error: '休み日（週あたり）は0〜2で入力してください。' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'ログイン情報が取得できませんでした。再ログインしてください。' };
  }

  // Archive existing active plans
  await supabase
    .from('plans')
    .update({ status: 'archived' })
    .eq('user_id', user.id)
    .eq('status', 'active');

  const { data: plan, error: planError } = await supabase
    .from('plans')
    .insert({
      user_id: user.id,
      start_date: startDate,
      exam_date: examDate,
      daily_minutes: dailyMinutes,
      rest_days_per_week: restDaysPerWeek,
      status: 'active',
    })
    .select('*')
    .single();

  if (planError || !plan) {
    return { error: planError?.message ?? '計画の作成に失敗しました。' };
  }

  const { data: themes, error: themeError } = await supabase
    .from('themes')
    .select('*')
    .order('display_order', { ascending: true });

  if (themeError || !themes) {
    return { error: themeError?.message ?? 'テーマの取得に失敗しました。' };
  }

  let taskSeeds;
  try {
    taskSeeds = generateTasks(themes as Theme[], {
      startDate,
      examDate,
      dailyMinutes,
      restDaysPerWeek,
    });
  } catch (e: any) {
    return { error: e?.message ?? '計画の生成に失敗しました。' };
  }

  // Clean tasks for archived plans? (optional)
  // Insert tasks
  const tasksToInsert = taskSeeds.map((t) => ({
    plan_id: plan.id,
    user_id: user.id,
    task_date: t.task_date,
    subject: t.subject,
    theme_id: t.theme_id,
    task_type: t.task_type,
    title: t.title,
    planned_minutes: t.planned_minutes,
    status: 'todo',
    meta: t.meta,
  }));

  // Batch insert in chunks to avoid payload limits
  const chunkSize = 500;
  for (let i = 0; i < tasksToInsert.length; i += chunkSize) {
    const chunk = tasksToInsert.slice(i, i + chunkSize);
    const { error } = await supabase.from('tasks').insert(chunk);
    if (error) {
      return { error: `タスク作成に失敗しました：${error.message}` };
    }
  }

  redirect('/today');
}

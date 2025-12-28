import { addDays, toISODateString } from '@/lib/date';
import type { Subject, TaskType, Theme } from '@/lib/types';

export interface GenerateOptions {
  startDate: string; // YYYY-MM-DD
  examDate: string; // YYYY-MM-DD (exam day)
  dailyMinutes: number;
  restDaysPerWeek: number; // 0-2
  timeZone?: string; // reserved
}

export interface TaskSeed {
  task_date: string;
  subject: Subject;
  theme_id: string | null;
  task_type: TaskType;
  title: string;
  planned_minutes: number;
  meta: Record<string, any>;
}

type TaskSeedNoDate = Omit<TaskSeed, 'task_date'>;

function parseLocalDate(dateStr: string): Date {
  // Treat as local date (no timezone conversion): midnight local
  return new Date(`${dateStr}T00:00:00`);
}

function round5(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5);
}

function isRestDay(date: Date, restDaysPerWeek: number): boolean {
  if (restDaysPerWeek <= 0) return false;
  const dow = date.getDay();
  // 0=Sun, 1=Mon...
  if (dow === 0) return true; // Sunday
  if (restDaysPerWeek >= 2 && dow === 3) return true; // Wednesday
  return false;
}

function pickInterleavedThemeOrder(commercial: Theme[], industrial: Theme[]): Theme[] {
  const c = [...commercial];
  const i = [...industrial];

  let remC = c.reduce((s, t) => s + t.estimated_minutes, 0);
  let remI = i.reduce((s, t) => s + t.estimated_minutes, 0);

  const order: Theme[] = [];

  while (c.length > 0 || i.length > 0) {
    const pickCommercial = (c.length > 0 && remC >= remI) || i.length === 0;
    if (pickCommercial) {
      const t = c.shift()!;
      order.push(t);
      remC -= t.estimated_minutes;
    } else {
      const t = i.shift()!;
      order.push(t);
      remI -= t.estimated_minutes;
    }
  }

  return order;
}

function themeTasks(theme: Theme): TaskSeedNoDate[] {
  const total = theme.estimated_minutes;
  const learn = round5(Math.max(30, total * 0.45));
  const drill = round5(Math.max(30, total - learn));

  const subjectLabel = theme.subject === 'commercial' ? '商業' : '工業';
  const themeLabel = `テーマ${theme.code}`;
  const pageInfo = theme.problem_page_start ? `問題集 p${theme.problem_page_start}〜` : '問題集';

  return [
    {
      subject: theme.subject,
      theme_id: theme.id,
      task_type: 'learn',
      title: `[${subjectLabel}] ${themeLabel} ${theme.title}：テキスト・例題`,
      planned_minutes: learn,
      meta: {
        theme_code: theme.code,
        theme_title: theme.title,
        resource: 'textbook',
      },
    },
    {
      subject: theme.subject,
      theme_id: theme.id,
      task_type: 'drill',
      title: `[${subjectLabel}] ${themeLabel} ${theme.title}：${pageInfo}`,
      planned_minutes: drill,
      meta: {
        theme_code: theme.code,
        theme_title: theme.title,
        resource: 'problem_book',
        problem_page_start: theme.problem_page_start,
      },
    },
  ];
}

function assignTask(task: TaskSeedNoDate, date: string, minutes: number, suffix: string): TaskSeed {
  return {
    ...task,
    task_date: date,
    planned_minutes: minutes,
    title: suffix ? `${task.title} ${suffix}` : task.title,
  };
}

export function generateTasks(themes: Theme[], options: GenerateOptions): TaskSeed[] {
  const { startDate, examDate, dailyMinutes, restDaysPerWeek } = options;

  const start = parseLocalDate(startDate);
  const exam = parseLocalDate(examDate);
  const lastStudy = addDays(exam, -1);

  if (lastStudy < start) {
    throw new Error('開始日と試験日の設定が不正です（試験日が開始日以前になっています）。');
  }

  const allDates: { date: Date; dateStr: string; rest: boolean }[] = [];
  for (let d = new Date(start); d <= lastStudy; d = addDays(d, 1)) {
    allDates.push({
      date: new Date(d),
      dateStr: toISODateString(d),
      rest: isRestDay(d, restDaysPerWeek),
    });
  }

  const studyDates = allDates.filter((d) => !d.rest).map((d) => d.dateStr);

  const totalStudyDays = studyDates.length;
  const mockWindowDays =
    totalStudyDays >= 45
      ? 14
      : totalStudyDays >= 30
        ? 10
        : totalStudyDays >= 20
          ? 7
          : Math.max(3, Math.floor(totalStudyDays * 0.25));

  const preMockDays = Math.max(0, totalStudyDays - mockWindowDays);
  const preMockDates = studyDates.slice(0, preMockDays);
  const mockDates = studyDates.slice(preMockDays);

  const mockCount = totalStudyDays >= 40 ? 6 : totalStudyDays >= 28 ? 4 : totalStudyDays >= 18 ? 2 : 1;

  const commercialThemes = themes
    .filter((t) => t.subject === 'commercial')
    .sort((a, b) => a.display_order - b.display_order);
  const industrialThemes = themes
    .filter((t) => t.subject === 'industrial')
    .sort((a, b) => a.display_order - b.display_order);

  const orderedThemes = pickInterleavedThemeOrder(commercialThemes, industrialThemes);

  const themeQueue: TaskSeedNoDate[] = [];
  for (const theme of orderedThemes) {
    themeQueue.push(...themeTasks(theme));
  }

  const mockQueue: TaskSeedNoDate[] = [];
  for (let i = 1; i <= mockCount; i++) {
    mockQueue.push({
      subject: 'mixed',
      theme_id: null,
      task_type: 'mock',
      title: `[総合] 本試験形式 模試 #${i}（90分）`,
      planned_minutes: 90,
      meta: { mock_no: i },
    });
    mockQueue.push({
      subject: 'mixed',
      theme_id: null,
      task_type: 'review',
      title: `[総合] 模試 #${i} 復習（60分）`,
      planned_minutes: 60,
      meta: { mock_no: i },
    });
  }
  mockQueue.push({
    subject: 'mixed',
    theme_id: null,
    task_type: 'review',
    title: '[総合] 最終確認（重要仕訳・連結の型）',
    planned_minutes: 30,
    meta: { kind: 'final_check' },
  });

  const tasks: TaskSeed[] = [];

  // Habit anchor: daily mini review
  const dailyReviewMinutes = Math.min(15, Math.max(0, dailyMinutes));

  function addDailyReview(dateStr: string) {
    if (dailyReviewMinutes <= 0) return;
    tasks.push({
      task_date: dateStr,
      subject: 'mixed',
      theme_id: null,
      task_type: 'review',
      title: '[毎日] ミニ復習（前日のミス直し・仕訳確認）',
      planned_minutes: dailyReviewMinutes,
      meta: { kind: 'daily' },
    });
  }

  // Weekly review on Sundays (even if rest day)
  for (const d of allDates) {
    if (d.date.getDay() === 0) {
      tasks.push({
        task_date: d.dateStr,
        subject: 'mixed',
        theme_id: null,
        task_type: 'weekly_review',
        title: '[週次] 進捗レビュー（遅れ/苦手テーマ確認→来週を調整）',
        planned_minutes: 20,
        meta: { kind: 'weekly' },
      });
    }
  }

  // Pre-mock: add daily review for each study day
  for (const dateStr of preMockDates) addDailyReview(dateStr);

  const capacityByDate = new Map<string, number>();
  for (const dateStr of preMockDates) {
    capacityByDate.set(dateStr, Math.max(0, dailyMinutes - dailyReviewMinutes));
  }

  // Pack theme tasks
  let dayIdx = 0;
  let currentDate = preMockDates[dayIdx];
  let remaining = currentDate ? (capacityByDate.get(currentDate) ?? 0) : 0;

  for (const q of themeQueue) {
    if (preMockDates.length === 0) break;

    let minutesLeft = q.planned_minutes;
    let part = 1;

    while (minutesLeft > 0) {
      if (!currentDate) {
        // Out of pre-mock days. Stop scheduling theme tasks.
        minutesLeft = 0;
        break;
      }

      if (remaining <= 0) {
        dayIdx += 1;
        currentDate = preMockDates[dayIdx];
        remaining = currentDate ? (capacityByDate.get(currentDate) ?? 0) : 0;
        continue;
      }

      if (minutesLeft <= remaining) {
        tasks.push(assignTask(q, currentDate, minutesLeft, part > 1 ? `(続き${part})` : ''));
        remaining -= minutesLeft;
        minutesLeft = 0;
      } else {
        tasks.push(assignTask(q, currentDate, remaining, part > 1 ? `(続き${part})` : '(続き)'));
        minutesLeft -= remaining;
        remaining = 0;
        part += 1;
      }
    }
  }

  // Mock window: daily review
  for (const dateStr of mockDates) addDailyReview(dateStr);

  const mockCapacityByDate = new Map<string, number>();
  for (const dateStr of mockDates) {
    mockCapacityByDate.set(dateStr, Math.max(0, dailyMinutes - dailyReviewMinutes));
  }

  let mIdx = 0;
  let mDate = mockDates[mIdx];
  let mRemaining = mDate ? (mockCapacityByDate.get(mDate) ?? 0) : 0;

  for (const q of mockQueue) {
    if (mockDates.length === 0) break;

    let minutesLeft = q.planned_minutes;
    let part = 1;

    while (minutesLeft > 0) {
      if (!mDate) {
        minutesLeft = 0;
        break;
      }

      if (mRemaining <= 0) {
        mIdx += 1;
        mDate = mockDates[mIdx];
        mRemaining = mDate ? (mockCapacityByDate.get(mDate) ?? 0) : 0;
        continue;
      }

      if (minutesLeft <= mRemaining) {
        tasks.push(assignTask(q, mDate, minutesLeft, part > 1 ? `(続き${part})` : ''));
        mRemaining -= minutesLeft;
        minutesLeft = 0;
      } else {
        tasks.push(assignTask(q, mDate, mRemaining, part > 1 ? `(続き${part})` : '(続き)'));
        minutesLeft -= mRemaining;
        mRemaining = 0;
        part += 1;
      }
    }
  }

  return tasks;
}

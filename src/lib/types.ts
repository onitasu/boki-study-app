export type Subject = 'commercial' | 'industrial' | 'mixed';

export type TaskType = 'learn' | 'drill' | 'review' | 'mock' | 'weekly_review';

export type TaskStatus = 'todo' | 'done' | 'skipped';

export interface Theme {
  id: string;
  subject: Exclude<Subject, 'mixed'>;
  code: string;
  title: string;
  display_order: number;
  problem_page_start: number | null;
  estimated_minutes: number;
  weight: number;
}

export interface Plan {
  id: string;
  start_date: string;
  exam_date: string;
  daily_minutes: number;
  rest_days_per_week: number;
  status: string;
}

export interface Task {
  id: string;
  plan_id: string;
  user_id: string;
  task_date: string;
  subject: Subject;
  theme_id: string | null;
  task_type: TaskType;
  title: string;
  planned_minutes: number;
  status: TaskStatus;
  actual_minutes: number | null;
  note: string | null;
  meta: Record<string, any>;
}

export type FlashcardStatus = 'learning' | 'mastered';

export interface FlashcardDeck {
  id: string;
  user_id: string;
  created_at: string;
  title: string | null;
  subject: Subject;
  folder_id: string | null;
  memo: string | null;
  images: any[];
}

export interface FlashcardFolder {
  id: string;
  user_id: string;
  created_at: string;
  name: string;
}

export interface Flashcard {
  id: string;
  deck_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  status: FlashcardStatus;
  question: string;
  hint: string | null;
  answer: string;
  explanation: string;
}

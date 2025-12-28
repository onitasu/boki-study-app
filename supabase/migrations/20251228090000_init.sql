-- 簿記2級 学習チェックアプリ用スキーマ
-- Supabase SQL Editor で実行してください

create extension if not exists "pgcrypto";

-- Plans (学習計画)
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  start_date date not null,
  exam_date date not null,
  daily_minutes int not null,
  rest_days_per_week int not null default 1,
  status text not null default 'active'
);

create index if not exists plans_user_id_idx on public.plans (user_id);

-- Themes (教材のテーマ)
create table if not exists public.themes (
  id text primary key,
  subject text not null check (subject in ('commercial', 'industrial')),
  code text not null,
  title text not null,
  display_order int not null,
  problem_page_start int,
  estimated_minutes int not null default 120,
  weight int not null default 3,
  created_at timestamptz not null default now()
);

create unique index if not exists themes_subject_code_uidx on public.themes (subject, code);

-- Tasks (日次タスク)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  task_date date not null,
  subject text not null check (subject in ('commercial','industrial','mixed')),
  theme_id text references public.themes (id),
  task_type text not null check (task_type in ('learn','drill','review','mock','weekly_review')),
  title text not null,
  planned_minutes int not null,
  status text not null default 'todo' check (status in ('todo','done','skipped')),
  actual_minutes int,
  note text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_date_idx on public.tasks (user_id, task_date);
create index if not exists tasks_plan_id_idx on public.tasks (plan_id);

-- updated_at trigger
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute procedure public.set_updated_at();

-- Row Level Security
alter table public.plans enable row level security;
alter table public.tasks enable row level security;
alter table public.themes enable row level security;

-- plans: only owner
drop policy if exists plans_select_own on public.plans;
create policy plans_select_own on public.plans
  for select using (auth.uid() = user_id);

drop policy if exists plans_insert_own on public.plans;
create policy plans_insert_own on public.plans
  for insert with check (auth.uid() = user_id);

drop policy if exists plans_update_own on public.plans;
create policy plans_update_own on public.plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists plans_delete_own on public.plans;
create policy plans_delete_own on public.plans
  for delete using (auth.uid() = user_id);

-- tasks: only owner
drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own on public.tasks
  for select using (auth.uid() = user_id);

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own on public.tasks
  for insert with check (auth.uid() = user_id);

drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own on public.tasks
  for delete using (auth.uid() = user_id);

-- themes: read-only (everyone can select)
drop policy if exists themes_read_all on public.themes;
create policy themes_read_all on public.themes
  for select using (true);

-- Seed data: 商業簿記テーマ (Ver.17.0)
insert into public.themes (id, subject, code, title, display_order, problem_page_start, estimated_minutes, weight)
values
  ('S00','commercial','00','簿記一巡の手続き',0,3,90,2),
  ('S01','commercial','01','財務諸表',1,9,120,3),
  ('S02','commercial','02','商品売買',2,12,120,3),
  ('S03','commercial','03','現金および預金',3,21,120,3),
  ('S04','commercial','04','債権・債務',4,29,120,3),
  ('S05','commercial','05','有価証券',5,39,120,3),
  ('S06','commercial','06','有形固定資産（I）',6,49,150,4),
  ('S07','commercial','07','有形固定資産（II）',7,54,150,4),
  ('S08','commercial','08','リース取引',8,64,120,3),
  ('S09','commercial','09','無形固定資産等と研究開発費',9,71,90,2),
  ('S10','commercial','10','引当金',10,73,90,2),
  ('S11','commercial','11','外貨換算会計',11,82,90,2),
  ('S12','commercial','12','税金',12,90,90,2),
  ('S13','commercial','13','課税所得の算定と税効果会計',13,92,120,4),
  ('S14','commercial','14','株式の発行',14,98,90,2),
  ('S15','commercial','15','剰余金の配当と処分',15,101,90,2),
  ('S16','commercial','16','決算手続',16,106,150,4),
  ('S17','commercial','17','収益の認識基準',17,130,120,3),
  ('S18','commercial','18','本支店会計',18,142,150,4),
  ('S19','commercial','19','合併と事業譲渡',19,149,150,4),
  ('S20','commercial','20','連結会計I（資本連結I）',20,151,180,5),
  ('S21','commercial','21','連結会計II（資本連結II）',21,155,180,5),
  ('S22','commercial','22','連結会計III（成果連結）',22,168,180,5),
  ('S23','commercial','23','連結会計IV（連結株主資本等変動計算書を作成する場合）',23,181,180,5),
  ('S24','commercial','24','製造業会計',24,200,90,2)
on conflict (id) do nothing;

-- Seed data: 工業簿記テーマ
insert into public.themes (id, subject, code, title, display_order, problem_page_start, estimated_minutes, weight)
values
  ('I01','industrial','01','工業簿記の基礎',1,3,90,2),
  ('I02','industrial','02','工業簿記の勘定連絡',2,4,90,2),
  ('I03','industrial','03','材料費（I）',3,9,120,3),
  ('I04','industrial','04','材料費（II）',4,11,120,3),
  ('I05','industrial','05','労務費（I）',5,19,120,3),
  ('I06','industrial','06','労務費（II）',6,21,90,2),
  ('I07','industrial','07','経費',7,26,90,2),
  ('I08','industrial','08','個別原価計算（I）',8,31,120,3),
  ('I09','industrial','09','個別原価計算（II）',9,38,120,3),
  ('I10','industrial','10','部門別個別原価計算（I）',10,50,120,3),
  ('I11','industrial','11','部門別個別原価計算（II）',11,56,120,3),
  ('I12','industrial','12','総合原価計算（I）',12,66,120,3),
  ('I13','industrial','13','総合原価計算（II）',13,67,90,2),
  ('I14','industrial','14','総合原価計算（III）',14,74,120,3),
  ('I15','industrial','15','総合原価計算（IV）',15,80,120,3),
  ('I16','industrial','16','総合原価計算（V）',16,88,120,3),
  ('I17','industrial','17','財務諸表',17,92,90,2),
  ('I18','industrial','18','標準原価計算（I）',18,105,120,3),
  ('I19','industrial','19','標準原価計算（II）',19,108,90,2),
  ('I20','industrial','20','直接原価計算（I）',20,121,90,2),
  ('I21','industrial','21','直接原価計算（II）',21,126,90,2),
  ('I22','industrial','22','本社工場会計',22,134,90,2),
  ('I99','industrial','99','複合問題編',99,137,180,5)
on conflict (id) do nothing;

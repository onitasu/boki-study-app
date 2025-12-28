-- Flashcards (AI生成フラッシュカード) 用スキーマ
-- Supabase SQL Editor で実行してください
-- ※ 先に 20251228090000_init.sql を実行して public.set_updated_at() を作成してください

-- Decks (アップロード/メモ単位)
create table if not exists public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  title text,
  subject text not null default 'mixed' check (subject in ('commercial','industrial','mixed')),
  memo text,
  images jsonb not null default '[]'::jsonb
);

create index if not exists flashcard_decks_user_created_idx on public.flashcard_decks (user_id, created_at desc);

-- Flashcards
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.flashcard_decks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'learning' check (status in ('learning','mastered')),
  question text not null,
  hint text,
  answer text not null,
  explanation text not null
);

create index if not exists flashcards_user_status_idx on public.flashcards (user_id, status, created_at desc);
create index if not exists flashcards_deck_idx on public.flashcards (deck_id);

-- updated_at trigger
drop trigger if exists set_flashcards_updated_at on public.flashcards;
create trigger set_flashcards_updated_at
before update on public.flashcards
for each row execute procedure public.set_updated_at();

-- Row Level Security
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;

-- Deck policies
drop policy if exists flashcard_decks_select_own on public.flashcard_decks;
create policy flashcard_decks_select_own on public.flashcard_decks
  for select using (auth.uid() = user_id);

drop policy if exists flashcard_decks_insert_own on public.flashcard_decks;
create policy flashcard_decks_insert_own on public.flashcard_decks
  for insert with check (auth.uid() = user_id);

drop policy if exists flashcard_decks_update_own on public.flashcard_decks;
create policy flashcard_decks_update_own on public.flashcard_decks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists flashcard_decks_delete_own on public.flashcard_decks;
create policy flashcard_decks_delete_own on public.flashcard_decks
  for delete using (auth.uid() = user_id);

-- Flashcard policies
drop policy if exists flashcards_select_own on public.flashcards;
create policy flashcards_select_own on public.flashcards
  for select using (auth.uid() = user_id);

drop policy if exists flashcards_insert_own on public.flashcards;
create policy flashcards_insert_own on public.flashcards
  for insert with check (auth.uid() = user_id);

drop policy if exists flashcards_update_own on public.flashcards;
create policy flashcards_update_own on public.flashcards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists flashcards_delete_own on public.flashcards;
create policy flashcards_delete_own on public.flashcards
  for delete using (auth.uid() = user_id);

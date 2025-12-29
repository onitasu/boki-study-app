-- Flashcard folders (ユーザーごとのフォルダ)
-- Supabase SQL Editor で実行してください

create table if not exists public.flashcard_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null
);

create unique index if not exists flashcard_folders_user_name_uidx
  on public.flashcard_folders (user_id, name);

-- Link folders to decks
alter table public.flashcard_decks
  add column if not exists folder_id uuid references public.flashcard_folders (id) on delete set null;

create index if not exists flashcard_decks_user_folder_idx
  on public.flashcard_decks (user_id, folder_id);

-- Row Level Security
alter table public.flashcard_folders enable row level security;

-- Folders: only owner
drop policy if exists flashcard_folders_select_own on public.flashcard_folders;
create policy flashcard_folders_select_own on public.flashcard_folders
  for select using (auth.uid() = user_id);

drop policy if exists flashcard_folders_insert_own on public.flashcard_folders;
create policy flashcard_folders_insert_own on public.flashcard_folders
  for insert with check (auth.uid() = user_id);

drop policy if exists flashcard_folders_update_own on public.flashcard_folders;
create policy flashcard_folders_update_own on public.flashcard_folders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists flashcard_folders_delete_own on public.flashcard_folders;
create policy flashcard_folders_delete_own on public.flashcard_folders
  for delete using (auth.uid() = user_id);

-- Update deck policies to enforce folder ownership
drop policy if exists flashcard_decks_insert_own on public.flashcard_decks;
create policy flashcard_decks_insert_own on public.flashcard_decks
  for insert with check (
    auth.uid() = user_id
    and (
      folder_id is null
      or exists (
        select 1
        from public.flashcard_folders f
        where f.id = folder_id
          and f.user_id = auth.uid()
      )
    )
  );

drop policy if exists flashcard_decks_update_own on public.flashcard_decks;
create policy flashcard_decks_update_own on public.flashcard_decks
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      folder_id is null
      or exists (
        select 1
        from public.flashcard_folders f
        where f.id = folder_id
          and f.user_id = auth.uid()
      )
    )
  );

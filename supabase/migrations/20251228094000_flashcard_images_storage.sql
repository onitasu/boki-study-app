-- Flashcard images storage bucket + policies
-- Supabase SQL Editor で実行してください

insert into storage.buckets (id, name, public)
values ('flashcard-images', 'flashcard-images', false)
on conflict (id) do nothing;

-- Allow users to manage their own uploaded images
drop policy if exists "Flashcard images insert own" on storage.objects;
create policy "Flashcard images insert own" on storage.objects
  for insert with check (bucket_id = 'flashcard-images' and auth.uid() = owner);

drop policy if exists "Flashcard images select own" on storage.objects;
create policy "Flashcard images select own" on storage.objects
  for select using (bucket_id = 'flashcard-images' and auth.uid() = owner);

drop policy if exists "Flashcard images update own" on storage.objects;
create policy "Flashcard images update own" on storage.objects
  for update using (bucket_id = 'flashcard-images' and auth.uid() = owner)
  with check (bucket_id = 'flashcard-images' and auth.uid() = owner);

drop policy if exists "Flashcard images delete own" on storage.objects;
create policy "Flashcard images delete own" on storage.objects
  for delete using (bucket_id = 'flashcard-images' and auth.uid() = owner);

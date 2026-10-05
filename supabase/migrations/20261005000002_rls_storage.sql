-- Row Level Security + grants + storage policies.
-- Principle: deny by default. anon gets nothing except public playlists; authenticated users only
-- ever touch rows where user_id = auth.uid(). (select auth.uid()) lets Postgres evaluate it once.

-- Start from zero privileges, then grant only what each role needs.
revoke all on all tables in schema public from anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_settings', 'watch_history', 'search_history', 'watch_later', 'favorites',
    'video_likes', 'subscriptions', 'playlists', 'playlist_items', 'notifications',
    'recommendation_profiles', 'recommendation_events', 'video_notes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- Generic "own rows only" policies for tables keyed by user_id.
do $$
declare
  t text;
begin
  foreach t in array array[
    'user_settings', 'watch_history', 'search_history', 'watch_later', 'favorites', 'video_likes',
    'subscriptions', 'notifications', 'recommendation_profiles', 'video_notes'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "%1$s_select_own" on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_insert_own" on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_update_own" on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_delete_own" on public.%1$I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- user_settings / recommendation_profiles rows are created by the signup trigger; users must not
-- delete them (the app would lose its settings row). Everything else stays user-deletable.
drop policy "user_settings_delete_own" on public.user_settings;
drop policy "recommendation_profiles_delete_own" on public.recommendation_profiles;
revoke delete on public.user_settings, public.recommendation_profiles from authenticated;

-- ---------------------------------------------------------------------------
-- recommendation_events: append-only log the user can read and erase, but never rewrite
-- ---------------------------------------------------------------------------
grant select, insert, delete on public.recommendation_events to authenticated;
create policy "recommendation_events_select_own" on public.recommendation_events
  for select to authenticated using (user_id = (select auth.uid()));
create policy "recommendation_events_insert_own" on public.recommendation_events
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "recommendation_events_delete_own" on public.recommendation_events
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- profiles: own row only (no public profile browsing in v1). Created by trigger, removed by cascade.
-- ---------------------------------------------------------------------------
grant select, update on public.profiles to authenticated;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- playlists: owner full access; public playlists readable by anyone (link sharing)
-- ---------------------------------------------------------------------------
grant select on public.playlists, public.playlist_items to anon;
grant select, insert, update, delete on public.playlists, public.playlist_items to authenticated;

create policy "playlists_select_visible" on public.playlists
  for select to anon, authenticated
  using (visibility = 'public' or user_id = (select auth.uid()));
create policy "playlists_insert_own" on public.playlists
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "playlists_update_own" on public.playlists
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "playlists_delete_own" on public.playlists
  for delete to authenticated using (user_id = (select auth.uid()));

-- playlist_items: ownership is derived from the parent playlist.
create policy "playlist_items_select_visible" on public.playlist_items
  for select to anon, authenticated
  using (exists (
    select 1 from public.playlists p
    where p.id = playlist_items.playlist_id
      and (p.visibility = 'public' or p.user_id = (select auth.uid()))
  ));
create policy "playlist_items_insert_own" on public.playlist_items
  for insert to authenticated
  with check (exists (
    select 1 from public.playlists p
    where p.id = playlist_items.playlist_id and p.user_id = (select auth.uid())
  ));
create policy "playlist_items_update_own" on public.playlist_items
  for update to authenticated
  using (exists (
    select 1 from public.playlists p
    where p.id = playlist_items.playlist_id and p.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.playlists p
    where p.id = playlist_items.playlist_id and p.user_id = (select auth.uid())
  ));
create policy "playlist_items_delete_own" on public.playlist_items
  for delete to authenticated
  using (exists (
    select 1 from public.playlists p
    where p.id = playlist_items.playlist_id and p.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Storage: avatars bucket. Public read (served by public URL), writes only inside <uid>/ folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars_select_own_folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_update_own_folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

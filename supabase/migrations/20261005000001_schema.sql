-- VUEBOX core schema.
-- Every user-owned table references auth.users(id) ON DELETE CASCADE, so deleting an account
-- removes only that user's rows. RLS lives in the next migration.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (public/service profile only; credentials are owned by Supabase Auth)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_key unique (username),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_len check (char_length(display_name) between 1 and 40),
  constraint profiles_bio_len check (char_length(bio) <= 300),
  constraint profiles_avatar_https check (avatar_url is null or avatar_url ~* '^https://')
);

-- ---------------------------------------------------------------------------
-- user_settings
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  autoplay boolean not null default true,
  save_watch_history boolean not null default true,
  save_search_history boolean not null default true,
  personalization boolean not null default true,
  notifications_enabled boolean not null default true,
  region text not null default 'KR' check (region ~ '^[A-Z]{2}$'),
  default_playback_rate numeric(3, 2) not null default 1 check (default_playback_rate between 0.25 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- watch_history (one row per user + video; snapshots are a display fallback only)
-- ---------------------------------------------------------------------------
create table public.watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title_snapshot text,
  thumbnail_snapshot text check (thumbnail_snapshot is null or thumbnail_snapshot ~* '^https://'),
  channel_id_snapshot text,
  channel_name_snapshot text,
  category_id_snapshot text,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  progress_seconds integer not null default 0 check (progress_seconds >= 0),
  watch_percentage numeric(5, 2) not null default 0 check (watch_percentage between 0 and 100),
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  completed boolean not null default false,
  started_at timestamptz not null default now(),
  last_watched_at timestamptz not null default now(),
  snapshot_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watch_history_user_video_key unique (user_id, video_id)
);
create index watch_history_user_last_watched_idx on public.watch_history (user_id, last_watched_at desc);

-- ---------------------------------------------------------------------------
-- search_history
-- ---------------------------------------------------------------------------
create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  query text not null check (char_length(query) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint search_history_user_query_key unique (user_id, query)
);
create index search_history_user_created_idx on public.search_history (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- watch_later / favorites / video_likes (video ids only; metadata is fetched fresh)
-- ---------------------------------------------------------------------------
create table public.watch_later (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watch_later_user_video_key unique (user_id, video_id)
);
create index watch_later_user_created_idx on public.watch_later (user_id, created_at desc);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint favorites_user_video_key unique (user_id, video_id)
);
create index favorites_user_idx on public.favorites (user_id, created_at desc);

create table public.video_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_likes_user_video_key unique (user_id, video_id)
);
create index video_likes_user_idx on public.video_likes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- subscriptions (VUEBOX-internal follows; never touches the user's YouTube account)
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  youtube_channel_id text not null check (youtube_channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  channel_name text not null check (char_length(channel_name) between 1 and 200),
  avatar_url text check (avatar_url is null or avatar_url ~* '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_user_channel_key unique (user_id, youtube_channel_id)
);
create index subscriptions_user_idx on public.subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- playlists + items
-- ---------------------------------------------------------------------------
create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index playlists_user_idx on public.playlists (user_id);

create table public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title_snapshot text,
  thumbnail_snapshot text check (thumbnail_snapshot is null or thumbnail_snapshot ~* '^https://'),
  channel_name_snapshot text,
  position integer not null check (position >= 0),
  snapshot_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint playlist_items_playlist_video_key unique (playlist_id, video_id)
);
create index playlist_items_playlist_position_idx on public.playlist_items (playlist_id, position);

-- Append at the end when the client does not send a position; cap playlist size.
create or replace function public.playlist_items_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
  v_max integer;
begin
  select count(*), coalesce(max(position), -1) into v_count, v_max
  from public.playlist_items where playlist_id = new.playlist_id;

  if v_count >= 500 then
    raise exception 'playlist is full (max 500 items)' using errcode = '54000';
  end if;
  if new.position is null then
    new.position := v_max + 1;
  end if;
  return new;
end;
$$;

-- position is NOT NULL, but BEFORE triggers run first so a NULL from the client is filled in.
create trigger playlist_items_before_insert
  before insert on public.playlist_items
  for each row execute function public.playlist_items_before_insert();

create or replace function public.reorder_playlist_items(p_playlist_id uuid, p_item_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- SECURITY INVOKER: RLS on playlist_items decides which rows the caller may update.
  update public.playlist_items pi
  set position = o.ord - 1
  from unnest(p_item_ids) with ordinality as o (id, ord)
  where pi.id = o.id and pi.playlist_id = p_playlist_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('recommendation', 'subscription', 'playlist', 'reminder', 'system')),
  title text not null check (char_length(title) between 1 and 120),
  message text not null default '' check (char_length(message) <= 500),
  reference_id text check (reference_id is null or char_length(reference_id) <= 100),
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create unique index notifications_dedupe_idx on public.notifications (user_id, type, reference_id)
  where reference_id is not null;

-- ---------------------------------------------------------------------------
-- recommendation_profiles / recommendation_events
-- ---------------------------------------------------------------------------
create table public.recommendation_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  preferred_categories text[] not null default '{}',
  preferred_keywords text[] not null default '{}',
  preferred_channels text[] not null default '{}',
  category_scores jsonb not null default '{}'::jsonb check (jsonb_typeof(category_scores) = 'object'),
  keyword_scores jsonb not null default '{}'::jsonb check (jsonb_typeof(keyword_scores) = 'object'),
  channel_scores jsonb not null default '{}'::jsonb check (jsonb_typeof(channel_scores) = 'object'),
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  event_type text not null check (event_type in ('impression', 'click', 'play', 'pause', 'complete', 'skip', 'save', 'like')),
  created_at timestamptz not null default now()
);
create index recommendation_events_user_created_idx on public.recommendation_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- video_notes (private)
-- ---------------------------------------------------------------------------
create table public.video_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  timestamp_seconds integer not null check (timestamp_seconds >= 0),
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index video_notes_user_video_idx on public.video_notes (user_id, video_id, timestamp_seconds);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_settings', 'watch_history', 'search_history', 'watch_later', 'favorites',
    'video_likes', 'subscriptions', 'playlists', 'notifications', 'recommendation_profiles', 'video_notes'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Signup: create profile + settings + recommendation profile atomically.
-- Username/display name come from signUp() options.data and are re-validated here.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suffix text := substr(replace(new.id::text, '-', ''), 1, 9);
  v_username text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  v_display text := left(
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    40
  );
begin
  if v_username !~ '^[a-z0-9_]{3,20}$' then
    v_username := 'user_' || v_suffix;
  elsif exists (select 1 from public.profiles where username = v_username) then
    v_username := left(v_username, 10) || '_' || v_suffix;
  end if;
  if char_length(v_display) = 0 then
    v_display := 'user';
  end if;

  insert into public.profiles (id, username, display_name) values (new.id, v_username, v_display);
  insert into public.user_settings (user_id) values (new.id);
  insert into public.recommendation_profiles (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Signup form helper: is this username free? (returns a boolean only)
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_username ~ '^[a-z0-9_]{3,20}$'
    and not exists (select 1 from public.profiles where username = lower(p_username));
$$;

-- YouTube API policy: stored API data must be refreshed or deleted within 30 days.
-- Snapshots are display fallbacks only, so we null them out when they get old.
create or replace function public.purge_stale_youtube_snapshots()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.watch_history
  set title_snapshot = null, thumbnail_snapshot = null, channel_id_snapshot = null,
      channel_name_snapshot = null, category_id_snapshot = null
  where snapshot_updated_at < now() - interval '25 days'
    and (title_snapshot is not null or thumbnail_snapshot is not null);

  update public.playlist_items
  set title_snapshot = null, thumbnail_snapshot = null, channel_name_snapshot = null
  where snapshot_updated_at < now() - interval '25 days'
    and (title_snapshot is not null or thumbnail_snapshot is not null);
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.purge_stale_youtube_snapshots() from public, anon, authenticated;
revoke execute on function public.playlist_items_before_insert() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.reorder_playlist_items(uuid, uuid[]) to authenticated;
revoke execute on function public.reorder_playlist_items(uuid, uuid[]) from anon;

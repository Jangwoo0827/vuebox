/**
 * RLS / constraint tests that run the real migrations inside PGlite (Postgres in WASM),
 * so they work without Docker:  npm run test:rls
 *
 * Supabase-provided pieces (roles, auth.users, auth.uid(), storage.*) are stubbed in `bootstrap`.
 * For a final check against a real project, run the same scenarios with `supabase test db`
 * or via the SQL editor.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const MIGRATIONS = join(import.meta.dirname, '..', 'migrations')

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const VID = 'dQw4w9WgXcQ'
const VID2 = 'jNQXAC9IVRw'
const CHANNEL = 'UCuAXFkgsw1L7xaCfnd5JJOw'

let db: PGlite

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema storage;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  create table storage.buckets (
    id text primary key, name text, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id),
    name text not null, owner uuid
  );
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.objects to authenticated;
  create function storage.foldername(name text) returns text[] language plpgsql as $$
    declare _parts text[]; begin
      select string_to_array(name, '/') into _parts;
      return _parts[1:array_length(_parts, 1) - 1];
    end $$;
`

type Params = unknown[]

/** Run a statement as a given Supabase role / user. */
async function as<T = Record<string, unknown>>(
  role: 'anon' | 'authenticated' | 'service_role' | 'postgres',
  uid: string | null,
  sql: string,
  params: Params = [],
): Promise<T[]> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`)
  if (role !== 'postgres') await db.exec(`set role ${role}`)
  try {
    const res = await db.query<T>(sql, params)
    return res.rows
  } finally {
    await db.exec('reset role')
  }
}

const asA = <T = Record<string, unknown>>(sql: string, p?: Params) => as<T>('authenticated', A, sql, p)
const asB = <T = Record<string, unknown>>(sql: string, p?: Params) => as<T>('authenticated', B, sql, p)
const asAnon = <T = Record<string, unknown>>(sql: string, p?: Params) => as<T>('anon', null, sql, p)
const admin = <T = Record<string, unknown>>(sql: string, p?: Params) => as<T>('postgres', null, sql, p)

beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(bootstrap)
  for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'))
  }
  await admin(
    `insert into auth.users (id, email, raw_user_meta_data) values
       ($1, 'a@example.com', '{"username":"alice_01","display_name":"Alice"}'),
       ($2, 'b@example.com', '{"username":"bob_02","display_name":"Bob"}')`,
    [A, B],
  )
})

afterAll(async () => {
  await db.close()
})

/** Tables where every row is keyed by user_id and fully self-service. */
const ownedTables: Record<string, { insert: string; params: (uid: string) => Params; updateSet: string }> = {
  watch_history: {
    insert: `insert into watch_history (user_id, video_id, progress_seconds) values ($1, $2, 10)`,
    params: (uid) => [uid, VID],
    updateSet: `progress_seconds = 99`,
  },
  search_history: {
    insert: `insert into search_history (user_id, query) values ($1, $2)`,
    params: (uid) => [uid, 'lofi beats'],
    updateSet: `query = 'hacked'`,
  },
  watch_later: {
    insert: `insert into watch_later (user_id, video_id) values ($1, $2)`,
    params: (uid) => [uid, VID],
    updateSet: `video_id = '${VID2}'`,
  },
  favorites: {
    insert: `insert into favorites (user_id, video_id) values ($1, $2)`,
    params: (uid) => [uid, VID],
    updateSet: `video_id = '${VID2}'`,
  },
  video_likes: {
    insert: `insert into video_likes (user_id, video_id) values ($1, $2)`,
    params: (uid) => [uid, VID],
    updateSet: `video_id = '${VID2}'`,
  },
  subscriptions: {
    insert: `insert into subscriptions (user_id, youtube_channel_id, channel_name) values ($1, $2, 'Chan')`,
    params: (uid) => [uid, CHANNEL],
    updateSet: `channel_name = 'hacked'`,
  },
  notifications: {
    insert: `insert into notifications (user_id, type, title) values ($1, 'system', 'Hello')`,
    params: (uid) => [uid],
    updateSet: `read = true`,
  },
  video_notes: {
    insert: `insert into video_notes (user_id, video_id, timestamp_seconds, content) values ($1, $2, 83, 'important')`,
    params: (uid) => [uid, VID],
    updateSet: `content = 'hacked'`,
  },
}

describe('signup trigger', () => {
  it('creates profile, settings and recommendation profile for each new user', async () => {
    const profiles = await admin<{ id: string; username: string; display_name: string }>(
      `select id, username, display_name from profiles order by username`,
    )
    expect(profiles.map((p) => p.username)).toEqual(['alice_01', 'bob_02'])
    expect((await admin(`select 1 from user_settings`)).length).toBe(2)
    expect((await admin(`select 1 from recommendation_profiles`)).length).toBe(2)
  })

  it('falls back to a generated username on collision or invalid input', async () => {
    const C = '00000000-0000-4000-8000-00000000000c'
    const D = '00000000-0000-4000-8000-00000000000d'
    await admin(
      `insert into auth.users (id, email, raw_user_meta_data) values
         ($1, 'c@example.com', '{"username":"alice_01"}'),
         ($2, 'd@example.com', '{"username":"Bad Name!"}')`,
      [C, D],
    )
    const rows = await admin<{ id: string; username: string }>(`select id, username from profiles where id in ($1, $2)`, [C, D])
    expect(rows).toHaveLength(2)
    for (const r of rows) {
      expect(r.username).toMatch(/^[a-z0-9_]{3,20}$/)
      expect(r.username).not.toBe('alice_01')
    }
    await admin(`delete from auth.users where id in ($1, $2)`, [C, D])
  })

  it('username_available works for anon and rejects bad formats', async () => {
    expect((await asAnon(`select username_available('fresh_name') as ok`))[0]).toEqual({ ok: true })
    expect((await asAnon(`select username_available('alice_01') as ok`))[0]).toEqual({ ok: false })
    expect((await asAnon(`select username_available('x') as ok`))[0]).toEqual({ ok: false })
  })
})

describe('profiles', () => {
  it('lets a user read and update only their own profile', async () => {
    expect(await asA(`select id from profiles`)).toEqual([{ id: A }])
    expect(await asA(`update profiles set bio = 'hi' where id = $1 returning id`, [A])).toHaveLength(1)
    expect(await asA(`update profiles set bio = 'pwned' where id = $1 returning id`, [B])).toHaveLength(0)
    expect((await admin<{ bio: string }>(`select bio from profiles where id = $1`, [B]))[0]?.bio).toBe('')
  })

  it('cannot be read by anon and cannot be inserted/deleted by users', async () => {
    await expect(asAnon(`select * from profiles`)).rejects.toThrow(/permission denied/)
    await expect(asA(`insert into profiles (id, username, display_name) values (gen_random_uuid(), 'zzz', 'z')`)).rejects.toThrow()
    await expect(asA(`delete from profiles where id = $1`, [A])).rejects.toThrow(/permission denied/)
  })

  it('enforces username format and uniqueness', async () => {
    await expect(asA(`update profiles set username = 'bob_02' where id = $1`, [A])).rejects.toThrow(/duplicate key/)
    await expect(asA(`update profiles set username = 'NOPE' where id = $1`, [A])).rejects.toThrow(/check constraint/)
    await expect(asA(`update profiles set avatar_url = 'javascript:alert(1)' where id = $1`, [A])).rejects.toThrow(/check constraint/)
  })
})

describe.each(Object.entries(ownedTables))('%s', (table, cfg) => {
  it('denies anon', async () => {
    await expect(asAnon(`select * from ${table}`)).rejects.toThrow(/permission denied/)
  })

  it('lets a user insert and read their own row', async () => {
    await asA(cfg.insert, cfg.params(A))
    expect((await asA(`select user_id from ${table}`)).every((r) => r.user_id === A)).toBe(true)
    expect(await asA(`select 1 from ${table}`)).toHaveLength(1)
  })

  it("hides the user's rows from other users", async () => {
    expect(await asB(`select 1 from ${table}`)).toHaveLength(0)
  })

  it("rejects inserting a row for someone else", async () => {
    await expect(asA(cfg.insert, cfg.params(B))).rejects.toThrow(/row-level security/)
  })

  it("cannot update or delete another user's row", async () => {
    await asB(cfg.insert, cfg.params(B))
    expect(await asA(`update ${table} set ${cfg.updateSet} where user_id = $1 returning 1`, [B])).toHaveLength(0)
    expect(await asA(`delete from ${table} where user_id = $1 returning 1`, [B])).toHaveLength(0)
    expect(await asB(`select 1 from ${table}`)).toHaveLength(1)
  })

  it('cannot reassign a row to another user', async () => {
    await expect(asA(`update ${table} set user_id = $1 where user_id = $2`, [B, A])).rejects.toThrow(/row-level security/)
  })

  it('lets the owner update and delete their own row', async () => {
    expect(await asA(`update ${table} set ${cfg.updateSet} where user_id = $1 returning 1`, [A])).toHaveLength(1)
    expect(await asA(`delete from ${table} where user_id = $1 returning 1`, [A])).toHaveLength(1)
    expect(await asA(`select 1 from ${table}`)).toHaveLength(0)
  })
})

describe('watch_history constraints', () => {
  it('upserts a single row per user + video', async () => {
    const upsert = `insert into watch_history (user_id, video_id, progress_seconds, watch_percentage)
                    values ($1, $2, $3, $4)
                    on conflict (user_id, video_id) do update set progress_seconds = excluded.progress_seconds,
                      watch_percentage = excluded.watch_percentage returning id`
    await asB(upsert, [B, VID, 10, 5])
    await asB(upsert, [B, VID, 50, 25])
    const rows = await asB<{ progress_seconds: number }>(`select progress_seconds from watch_history where video_id = $1`, [VID])
    expect(rows).toEqual([{ progress_seconds: 50 }])
  })

  it('rejects malformed video ids and out-of-range percentages', async () => {
    await expect(asB(`insert into watch_history (user_id, video_id) values ($1, 'not-an-id')`, [B])).rejects.toThrow(/check constraint/)
    await expect(
      asB(`insert into watch_history (user_id, video_id, watch_percentage) values ($1, $2, 120)`, [B, VID2]),
    ).rejects.toThrow()
  })
})

describe('user_settings & recommendation tables', () => {
  it('lets a user update their settings but not delete the row', async () => {
    expect(await asA(`update user_settings set theme = 'light' where user_id = $1 returning 1`, [A])).toHaveLength(1)
    await expect(asA(`delete from user_settings`)).rejects.toThrow(/permission denied/)
    await expect(asA(`update user_settings set theme = 'neon' where user_id = $1`, [A])).rejects.toThrow(/check constraint/)
    expect(await asB(`update user_settings set region = 'US' where user_id = $1 returning 1`, [A])).toHaveLength(0)
  })

  it("keeps recommendation profiles private", async () => {
    expect(await asA(`select user_id from recommendation_profiles`)).toEqual([{ user_id: A }])
    expect(await asB(`update recommendation_profiles set category_scores = '{"10": 99}' where user_id = $1 returning 1`, [A])).toHaveLength(0)
    await expect(asAnon(`select * from recommendation_profiles`)).rejects.toThrow(/permission denied/)
  })

  it('treats recommendation_events as append-only, self-erasable', async () => {
    await asA(`insert into recommendation_events (user_id, video_id, event_type) values ($1, $2, 'click')`, [A, VID])
    await expect(asA(`insert into recommendation_events (user_id, video_id, event_type) values ($1, $2, 'click')`, [B, VID])).rejects.toThrow(/row-level security/)
    await expect(asA(`update recommendation_events set event_type = 'like'`)).rejects.toThrow(/permission denied/)
    expect(await asB(`select 1 from recommendation_events`)).toHaveLength(0)
    expect(await asA(`delete from recommendation_events returning 1`)).toHaveLength(1)
    await expect(asAnon(`select * from recommendation_events`)).rejects.toThrow(/permission denied/)
  })

  it('dedupes notifications by (user, type, reference)', async () => {
    const q = `insert into notifications (user_id, type, title, reference_id) values ($1, 'subscription', 'New video', 'abc')`
    await asA(q, [A])
    await expect(asA(q, [A])).rejects.toThrow(/duplicate key/)
    await asA(`delete from notifications`)
  })
})

describe('playlists', () => {
  let privateId = ''
  let publicId = ''
  const itemIds: string[] = []

  beforeAll(async () => {
    privateId = (await asA<{ id: string }>(`insert into playlists (user_id, title) values ($1, 'Secret') returning id`, [A]))[0]!.id
    publicId = (
      await asA<{ id: string }>(`insert into playlists (user_id, title, visibility) values ($1, 'Shared', 'public') returning id`, [A])
    )[0]!.id
    for (const [pl, vid] of [
      [privateId, VID],
      [privateId, VID2],
      [publicId, VID],
    ] as const) {
      itemIds.push((await asA<{ id: string }>(`insert into playlist_items (playlist_id, video_id) values ($1, $2) returning id`, [pl, vid]))[0]!.id)
    }
  })

  it('appends items at the next position automatically', async () => {
    const rows = await asA<{ video_id: string; position: number }>(
      `select video_id, position from playlist_items where playlist_id = $1 order by position`, [privateId],
    )
    expect(rows.map((r) => r.position)).toEqual([0, 1])
  })

  it('hides private playlists and their items from other users and anon', async () => {
    expect(await asB(`select 1 from playlists where id = $1`, [privateId])).toHaveLength(0)
    expect(await asB(`select 1 from playlist_items where playlist_id = $1`, [privateId])).toHaveLength(0)
    expect(await asAnon(`select 1 from playlists where id = $1`, [privateId])).toHaveLength(0)
    expect(await asAnon(`select 1 from playlist_items where playlist_id = $1`, [privateId])).toHaveLength(0)
  })

  it('shows public playlists to anyone, read-only', async () => {
    expect(await asAnon(`select 1 from playlists where id = $1`, [publicId])).toHaveLength(1)
    expect(await asAnon(`select 1 from playlist_items where playlist_id = $1`, [publicId])).toHaveLength(1)
    expect(await asB(`select 1 from playlist_items where playlist_id = $1`, [publicId])).toHaveLength(1)
    await expect(asAnon(`insert into playlists (user_id, title) values ($1, 'x')`, [A])).rejects.toThrow(/permission denied/)
  })

  it("blocks other users from modifying someone else's playlist", async () => {
    expect(await asB(`update playlists set title = 'pwned' where id = $1 returning 1`, [publicId])).toHaveLength(0)
    expect(await asB(`delete from playlists where id = $1 returning 1`, [publicId])).toHaveLength(0)
    await expect(asB(`insert into playlist_items (playlist_id, video_id) values ($1, $2)`, [publicId, VID2])).rejects.toThrow(/row-level security/)
    expect(await asB(`update playlist_items set position = 9 where playlist_id = $1 returning 1`, [publicId])).toHaveLength(0)
    expect(await asB(`delete from playlist_items where playlist_id = $1 returning 1`, [publicId])).toHaveLength(0)
    await expect(asB(`insert into playlists (user_id, title) values ($1, 'forged')`, [A])).rejects.toThrow(/row-level security/)
  })

  it('reorders items for the owner only', async () => {
    const [first, second] = (
      await asA<{ id: string }>(`select id from playlist_items where playlist_id = $1 order by position`, [privateId])
    ).map((r) => r.id)
    await asB(`select reorder_playlist_items($1, $2::uuid[])`, [privateId, [second, first]])
    expect((await asA<{ id: string }>(`select id from playlist_items where playlist_id = $1 order by position`, [privateId])).map((r) => r.id)).toEqual([first, second])

    await asA(`select reorder_playlist_items($1, $2::uuid[])`, [privateId, [second, first]])
    expect((await asA<{ id: string }>(`select id from playlist_items where playlist_id = $1 order by position`, [privateId])).map((r) => r.id)).toEqual([second, first])
    await expect(asAnon(`select reorder_playlist_items($1, $2::uuid[])`, [privateId, [first]])).rejects.toThrow(/permission denied/)
  })

  it('rejects duplicate videos in the same playlist', async () => {
    await expect(asA(`insert into playlist_items (playlist_id, video_id) values ($1, $2)`, [privateId, VID])).rejects.toThrow(/duplicate key/)
  })

  it('caps a playlist at 500 items', async () => {
    const big = (await asA<{ id: string }>(`insert into playlists (user_id, title) values ($1, 'Big') returning id`, [A]))[0]!.id
    await asA(
      `insert into playlist_items (playlist_id, video_id)
       select $1, 'v' || lpad(g::text, 10, '0') from generate_series(1, 500) g`,
      [big],
    )
    await expect(asA(`insert into playlist_items (playlist_id, video_id) values ($1, 'overflow_01')`, [big])).rejects.toThrow(/playlist is full/)
  })
})

describe('storage.avatars', () => {
  it('lets a user write only inside their own folder', async () => {
    await asA(`insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)`, [`${A}/avatar.png`, A])
    await expect(asA(`insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)`, [`${B}/avatar.png`, A])).rejects.toThrow(/row-level security/)
    await expect(asA(`insert into storage.objects (bucket_id, name, owner) values ('avatars', 'avatar.png', $1)`, [A])).rejects.toThrow(/row-level security/)
  })

  it("prevents overwriting or deleting another user's avatar", async () => {
    await asB(`insert into storage.objects (bucket_id, name, owner) values ('avatars', $1, $2)`, [`${B}/avatar.png`, B])
    expect(await asA(`update storage.objects set name = $1 where name = $2 returning 1`, [`${A}/x.png`, `${B}/avatar.png`])).toHaveLength(0)
    expect(await asA(`delete from storage.objects where name = $1 returning 1`, [`${B}/avatar.png`])).toHaveLength(0)
    expect(await asA(`select 1 from storage.objects where name = $1`, [`${B}/avatar.png`])).toHaveLength(0)
  })

  it('configures the bucket with size and mime limits', async () => {
    const [bucket] = await admin<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      `select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'`,
    )
    expect(bucket?.public).toBe(true)
    expect(Number(bucket?.file_size_limit)).toBe(2 * 1024 * 1024)
    expect(bucket?.allowed_mime_types).toEqual(['image/png', 'image/jpeg', 'image/webp'])
  })
})

describe('function privileges', () => {
  it('does not expose internal trigger/maintenance functions to API roles', async () => {
    await expect(asAnon(`select purge_stale_youtube_snapshots()`)).rejects.toThrow(/permission denied/)
    await expect(asA(`select purge_stale_youtube_snapshots()`)).rejects.toThrow(/permission denied/)
  })

  it('purges only stale snapshots', async () => {
    await asB(
      `insert into watch_history (user_id, video_id, title_snapshot, snapshot_updated_at)
       values ($1, 'old_video_1', 'old', now() - interval '26 days'), ($1, 'new_video_1', 'new', now())`,
      [B],
    )
    await admin(`select purge_stale_youtube_snapshots()`)
    const rows = await asB<{ video_id: string; title_snapshot: string | null }>(
      `select video_id, title_snapshot from watch_history where video_id in ('old_video_1','new_video_1') order by video_id`,
    )
    expect(rows).toEqual([
      { video_id: 'new_video_1', title_snapshot: 'new' },
      { video_id: 'old_video_1', title_snapshot: null },
    ])
  })
})

describe('account deletion', () => {
  it("cascades only the deleted user's data", async () => {
    await asB(`insert into watch_later (user_id, video_id) values ($1, $2) on conflict do nothing`, [B, VID])
    await admin(`delete from auth.users where id = $1`, [A])
    for (const t of ['profiles', 'user_settings', 'recommendation_profiles', 'playlists', 'watch_history', 'video_notes']) {
      const col = t === 'profiles' ? 'id' : 'user_id'
      expect(await admin(`select 1 from ${t} where ${col} = $1`, [A]), t).toHaveLength(0)
    }
    expect(await admin(`select 1 from playlist_items where playlist_id in (select id from playlists where user_id = $1)`, [A])).toHaveLength(0)
    expect((await admin(`select 1 from profiles where id = $1`, [B])).length).toBe(1)
    expect((await admin(`select 1 from watch_later where user_id = $1`, [B])).length).toBe(1)
  })
})

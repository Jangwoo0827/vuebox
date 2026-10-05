// YouTube Data API v3 gateway. Keeps YOUTUBE_API_KEY server-side, validates every input against an
// allowlist, caches responses (quota!), rate-limits per caller, and maps API payloads to a small
// normalized shape so the UI never depends on raw YouTube responses.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { clientIp, corsHeaders, createRateLimiter, HttpError, json } from '../_shared/http.ts'

// Overridable only so the function tests can point at a local fake API.
const API = Deno.env.get('YOUTUBE_API_BASE') ?? 'https://www.googleapis.com/youtube/v3'
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/
const PAGE_TOKEN = /^[A-Za-z0-9_-]{1,100}$/
const REGION = /^[A-Z]{2}$/

// ---------------------------------------------------------------------------
// Types returned to the client (mirror src/types/youtube.ts)
// ---------------------------------------------------------------------------
interface Video {
  id: string
  title: string
  description: string
  thumbnail: string
  channelId: string
  channelTitle: string
  publishedAt: string
  durationSeconds: number
  viewCount: number | null
  likeCount: number | null
  categoryId: string | null
  tags: string[]
  live: 'none' | 'live' | 'upcoming'
  embeddable: boolean
}
interface Channel {
  id: string
  title: string
  description: string
  avatar: string
  banner: string | null
  customUrl: string | null
  subscriberCount: number | null
  videoCount: number | null
  uploadsPlaylistId: string
}
interface PlaylistSummary {
  id: string
  title: string
  description: string
  thumbnail: string
  channelId: string
  channelTitle: string
  itemCount: number | null
}

// ---------------------------------------------------------------------------
// Raw API shapes (only the fields we read)
// ---------------------------------------------------------------------------
interface Thumbs {
  default?: { url: string }
  medium?: { url: string }
  high?: { url: string }
}
interface RawSnippet {
  title?: string
  description?: string
  publishedAt?: string
  channelId?: string
  channelTitle?: string
  thumbnails?: Thumbs
  categoryId?: string
  tags?: string[]
  liveBroadcastContent?: string
  customUrl?: string
  resourceId?: { videoId?: string }
}
interface RawItem {
  id?: string | { videoId?: string; channelId?: string; playlistId?: string; kind?: string }
  snippet?: RawSnippet
  contentDetails?: {
    duration?: string
    itemCount?: number
    videoId?: string
    videoPublishedAt?: string
    relatedPlaylists?: { uploads?: string }
  }
  statistics?: { viewCount?: string; likeCount?: string; subscriberCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean }
  status?: { embeddable?: boolean; privacyStatus?: string }
  brandingSettings?: { image?: { bannerExternalUrl?: string } }
}
interface RawList {
  items?: RawItem[]
  nextPageToken?: string
  error?: { code: number; message: string; errors?: { reason?: string }[] }
}

// ---------------------------------------------------------------------------
// Infrastructure: cache, limiter, quota breaker
// ---------------------------------------------------------------------------
const cache = new Map<string, { exp: number; value: unknown }>()
let quotaBlockedUntil = 0
const anonLimiter = createRateLimiter(40, 60_000)
const userLimiter = createRateLimiter(120, 60_000)

const TTL: Record<string, number> = {
  search: 15 * 60_000,
  videos: 10 * 60_000,
  trending: 30 * 60_000,
  categories: 24 * 3_600_000,
  channels: 60 * 60_000,
  uploads: 15 * 60_000,
  uploadsAll: 30 * 60_000,
  feed: 10 * 60_000,
  channelPlaylists: 30 * 60_000,
  playlistVideos: 30 * 60_000,
}

function cacheGet(key: string): unknown | undefined {
  const hit = cache.get(key)
  if (!hit) return undefined
  if (hit.exp < Date.now()) {
    cache.delete(key)
    return undefined
  }
  return hit.value
}

function cacheSet(key: string, value: unknown, ttl: number) {
  if (cache.size > 800) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, { exp: Date.now() + ttl, value })
}

async function yt(endpoint: string, params: Record<string, string | undefined>): Promise<RawList> {
  const key = Deno.env.get('YOUTUBE_API_KEY')
  if (!key) throw new HttpError(500, 'SERVER_MISCONFIGURED', 'YOUTUBE_API_KEY is not set')
  if (Date.now() < quotaBlockedUntil) throw new HttpError(429, 'QUOTA_EXCEEDED', 'YouTube API quota is exhausted')

  const url = new URL(`${API}/${endpoint}`)
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, v)
  url.searchParams.set('key', key)

  const res = await fetch(url)
  const body = (await res.json().catch(() => ({}))) as RawList
  if (res.ok) return body

  const reason = body.error?.errors?.[0]?.reason ?? ''
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || reason === 'rateLimitExceeded') {
    quotaBlockedUntil = Date.now() + 10 * 60_000 // stop hammering for a while
    throw new HttpError(429, 'QUOTA_EXCEEDED', 'YouTube API quota is exhausted')
  }
  if (reason === 'videoChartNotFound') throw new HttpError(404, 'CHART_UNAVAILABLE', 'Chart is not available for this region/category')
  if (res.status === 404 || reason === 'playlistNotFound' || reason === 'videoNotFound') throw new HttpError(404, 'NOT_FOUND', 'Not found')
  if (res.status === 403 || res.status === 400) {
    console.error('YouTube API error', res.status, reason, body.error?.message)
    throw new HttpError(502, 'YOUTUBE_API_ERROR', 'YouTube API rejected the request')
  }
  console.error('YouTube API error', res.status, reason)
  throw new HttpError(502, 'YOUTUBE_API_ERROR', 'YouTube API request failed')
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------
function parseDuration(iso?: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso ?? '')
  if (!m) return 0
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0)
}

const num = (s?: string): number | null => (s === undefined || s === '' ? null : Number.isFinite(Number(s)) ? Number(s) : null)
const thumb = (t?: Thumbs): string => t?.medium?.url ?? t?.high?.url ?? t?.default?.url ?? ''

function mapVideo(it: RawItem, full: boolean): Video | null {
  const id = typeof it.id === 'string' ? it.id : undefined
  if (!id || !it.snippet) return null
  const s = it.snippet
  const live = s.liveBroadcastContent === 'live' ? 'live' : s.liveBroadcastContent === 'upcoming' ? 'upcoming' : 'none'
  return {
    id,
    title: s.title ?? '',
    description: full ? (s.description ?? '') : (s.description ?? '').slice(0, 200),
    thumbnail: thumb(s.thumbnails),
    channelId: s.channelId ?? '',
    channelTitle: s.channelTitle ?? '',
    publishedAt: s.publishedAt ?? '',
    durationSeconds: parseDuration(it.contentDetails?.duration),
    viewCount: num(it.statistics?.viewCount),
    likeCount: num(it.statistics?.likeCount),
    categoryId: s.categoryId ?? null,
    tags: (s.tags ?? []).slice(0, 15),
    live,
    embeddable: it.status?.embeddable !== false,
  }
}

function mapChannel(it: RawItem): Channel | null {
  const id = typeof it.id === 'string' ? it.id : undefined
  if (!id || !it.snippet) return null
  return {
    id,
    title: it.snippet.title ?? '',
    description: it.snippet.description ?? '',
    avatar: thumb(it.snippet.thumbnails),
    banner: it.brandingSettings?.image?.bannerExternalUrl ?? null,
    customUrl: it.snippet.customUrl ?? null,
    subscriberCount: it.statistics?.hiddenSubscriberCount ? null : num(it.statistics?.subscriberCount),
    videoCount: num(it.statistics?.videoCount),
    uploadsPlaylistId: it.contentDetails?.relatedPlaylists?.uploads ?? 'UU' + id.slice(2),
  }
}

function mapPlaylist(it: RawItem): PlaylistSummary | null {
  const id = typeof it.id === 'string' ? it.id : it.id?.playlistId
  if (!id || !it.snippet) return null
  return {
    id,
    title: it.snippet.title ?? '',
    description: (it.snippet.description ?? '').slice(0, 200),
    thumbnail: thumb(it.snippet.thumbnails),
    channelId: it.snippet.channelId ?? '',
    channelTitle: it.snippet.channelTitle ?? '',
    itemCount: it.contentDetails?.itemCount ?? null,
  }
}

/** videos.list for up to 50 ids, preserving the requested order and dropping unavailable/non-embeddable ones. */
async function fetchVideos(ids: string[], full = false): Promise<Video[]> {
  const unique = [...new Set(ids)].slice(0, 50)
  if (unique.length === 0) return []
  const res = await yt('videos', { part: 'snippet,contentDetails,statistics,status', id: unique.join(','), maxResults: '50' })
  const byId = new Map<string, Video>()
  for (const it of res.items ?? []) {
    if (it.status?.privacyStatus && it.status.privacyStatus !== 'public' && it.status.privacyStatus !== 'unlisted') continue
    const v = mapVideo(it, full)
    if (v) byId.set(v.id, v)
  }
  return unique.map((id) => byId.get(id)).filter((v): v is Video => !!v)
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------
type Params = Record<string, unknown>

function str(p: Params, k: string, opts: { max?: number; re?: RegExp; required?: boolean } = {}): string | undefined {
  const v = p[k]
  if (v === undefined || v === null || v === '') {
    if (opts.required) throw new HttpError(400, 'BAD_REQUEST', `${k} is required`)
    return undefined
  }
  if (typeof v !== 'string') throw new HttpError(400, 'BAD_REQUEST', `${k} must be a string`)
  if (v.length > (opts.max ?? 200)) throw new HttpError(400, 'BAD_REQUEST', `${k} is too long`)
  if (opts.re && !opts.re.test(v)) throw new HttpError(400, 'BAD_REQUEST', `${k} is invalid`)
  return v
}

function oneOf<T extends string>(p: Params, k: string, allowedValues: readonly T[]): T | undefined {
  const v = str(p, k, { max: 20 })
  if (v === undefined) return undefined
  if (!(allowedValues as readonly string[]).includes(v)) throw new HttpError(400, 'BAD_REQUEST', `${k} is invalid`)
  return v as T
}

function int(p: Params, k: string, min: number, max: number, dflt: number): number {
  const v = p[k]
  if (v === undefined || v === null) return dflt
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new HttpError(400, 'BAD_REQUEST', `${k} is invalid`)
  return v
}

function ids(p: Params, k: string, re: RegExp, max: number): string[] {
  const v = p[k]
  if (!Array.isArray(v) || v.length === 0 || v.length > max || !v.every((x) => typeof x === 'string' && re.test(x))) {
    throw new HttpError(400, 'BAD_REQUEST', `${k} must be 1-${max} valid ids`)
  }
  return v as string[]
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
type Handler = (p: Params, ctx: { userId: string | null }) => Promise<unknown>

const actions: Record<string, Handler> = {
  /** search.list (100 quota units) + videos.list (1) for video results. */
  async search(p) {
    const q = str(p, 'q', { max: 100, required: true })!.trim()
    if (!q) throw new HttpError(400, 'BAD_REQUEST', 'q is required')
    const type = oneOf(p, 'type', ['video', 'channel', 'playlist'] as const) ?? 'video'
    const order = oneOf(p, 'order', ['relevance', 'date', 'viewCount', 'rating'] as const)
    const duration = oneOf(p, 'videoDuration', ['short', 'medium', 'long'] as const)
    const definition = oneOf(p, 'videoDefinition', ['high'] as const)
    const eventType = oneOf(p, 'eventType', ['live'] as const)
    if ((duration || definition || eventType) && type !== 'video') throw new HttpError(400, 'BAD_REQUEST', 'video filters need type=video')

    const res = await yt('search', {
      part: 'snippet',
      q,
      type,
      order,
      videoDuration: duration,
      videoDefinition: definition,
      eventType,
      videoEmbeddable: type === 'video' ? 'true' : undefined,
      safeSearch: 'moderate',
      regionCode: str(p, 'regionCode', { re: REGION }),
      pageToken: str(p, 'pageToken', { re: PAGE_TOKEN }),
      maxResults: String(int(p, 'maxResults', 1, 25, 20)),
    })
    const items = res.items ?? []
    if (type === 'video') {
      const vids = items.map((i) => (typeof i.id === 'object' ? i.id?.videoId : undefined)).filter((x): x is string => !!x)
      return { kind: 'video', items: await fetchVideos(vids), nextPageToken: res.nextPageToken ?? null }
    }
    if (type === 'channel') {
      const chIds = items.map((i) => (typeof i.id === 'object' ? i.id?.channelId : undefined)).filter((x): x is string => !!x)
      const chRes = chIds.length
        ? await yt('channels', { part: 'snippet,statistics,contentDetails', id: chIds.join(','), maxResults: '50' })
        : { items: [] }
      const byId = new Map((chRes.items ?? []).map((c) => [c.id as string, mapChannel(c)]))
      return {
        kind: 'channel',
        items: chIds.map((id) => byId.get(id)).filter((c): c is Channel => !!c),
        nextPageToken: res.nextPageToken ?? null,
      }
    }
    return {
      kind: 'playlist',
      items: items.map(mapPlaylist).filter((x): x is PlaylistSummary => !!x),
      nextPageToken: res.nextPageToken ?? null,
    }
  },

  /** videos.list (1 unit). */
  async videos(p) {
    const list = ids(p, 'ids', VIDEO_ID, 50)
    return { items: await fetchVideos(list, p.full === true) }
  },

  /** videos.list chart=mostPopular (1 unit) — the cheap way to get fresh, popular videos. */
  async trending(p) {
    const categoryId = str(p, 'categoryId', { re: /^\d{1,3}$/ })
    try {
      const res = await yt('videos', {
        part: 'snippet,contentDetails,statistics,status',
        chart: 'mostPopular',
        regionCode: str(p, 'regionCode', { re: REGION }) ?? 'KR',
        videoCategoryId: categoryId,
        pageToken: str(p, 'pageToken', { re: PAGE_TOKEN }),
        maxResults: String(int(p, 'maxResults', 1, 50, 30)),
      })
      const items = (res.items ?? []).map((i) => mapVideo(i, false)).filter((v): v is Video => !!v && v.embeddable)
      return { items, nextPageToken: res.nextPageToken ?? null, unavailable: false }
    } catch (e) {
      // Some categories have no chart in some regions; report that instead of failing the page.
      if (e instanceof HttpError && e.code === 'CHART_UNAVAILABLE') return { items: [], nextPageToken: null, unavailable: true }
      throw e
    }
  },

  /** videoCategories.list (1 unit). */
  async categories(p) {
    const res = await yt('videoCategories', { part: 'snippet', regionCode: str(p, 'regionCode', { re: REGION }) ?? 'KR' })
    return {
      items: (res.items ?? [])
        .filter((c) => (c as { snippet?: { assignable?: boolean } }).snippet?.assignable !== false)
        .map((c) => ({ id: c.id as string, title: c.snippet?.title ?? '' })),
    }
  },

  /** channels.list (1 unit). */
  async channels(p) {
    const list = ids(p, 'ids', CHANNEL_ID, 50)
    const res = await yt('channels', { part: 'snippet,statistics,contentDetails,brandingSettings', id: list.join(','), maxResults: '50' })
    return { items: (res.items ?? []).map(mapChannel).filter((c): c is Channel => !!c) }
  },

  /** Channel uploads via the uploads playlist: playlistItems.list (1) + videos.list (1), not search (100). */
  async uploads(p) {
    const channelId = str(p, 'channelId', { re: CHANNEL_ID, required: true })!
    let res: RawList
    try {
      res = await yt('playlistItems', {
        part: 'snippet,contentDetails',
        playlistId: 'UU' + channelId.slice(2),
        pageToken: str(p, 'pageToken', { re: PAGE_TOKEN }),
        maxResults: String(int(p, 'maxResults', 1, 50, 30)),
      })
    } catch (e) {
      if (e instanceof HttpError && e.code === 'NOT_FOUND') return { items: [], nextPageToken: null }
      throw e
    }
    const vids = (res.items ?? []).map((i) => i.contentDetails?.videoId).filter((x): x is string => !!x)
    return { items: (await fetchVideos(vids)).filter((v) => v.embeddable), nextPageToken: res.nextPageToken ?? null }
  },

  /**
   * A channel's whole upload list (up to maxVideos, newest first) in one response, so the client can sort
   * by views or oldest-first — the API only lists uploads newest-first and search.list can't sort ascending.
   * Costs ~2 quota units per 50 videos (playlistItems + videos), cached for 30 minutes.
   */
  async uploadsAll(p) {
    const channelId = str(p, 'channelId', { re: CHANNEL_ID, required: true })!
    const maxVideos = int(p, 'maxVideos', 50, 2000, 2000)
    let count = 0
    let pageToken: string | undefined
    let truncated = false
    // Pipeline: each playlist page's videos.list request starts as soon as that page arrives,
    // so details are fetched while the next page of ids is still loading.
    const details: Promise<Video[]>[] = []
    try {
      while (count < maxVideos) {
        const res = await yt('playlistItems', { part: 'contentDetails', playlistId: 'UU' + channelId.slice(2), pageToken, maxResults: '50' })
        const ids = (res.items ?? []).map((i) => i.contentDetails?.videoId).filter((x): x is string => !!x).slice(0, maxVideos - count)
        count += ids.length
        if (ids.length) details.push(fetchVideos(ids))
        pageToken = res.nextPageToken
        if (!pageToken) break
        if (count >= maxVideos) truncated = true
      }
    } catch (e) {
      if (e instanceof HttpError && e.code === 'NOT_FOUND') return { items: [], truncated: false }
      throw e
    }
    const items: Video[] = []
    for (const list of await Promise.all(details)) for (const v of list) if (v.embeddable) items.push({ ...v, description: '' })
    return { items, truncated }
  },

  /** Latest uploads across many channels in a single call (signed-in users only). */
  async feed(p, ctx) {
    if (!ctx.userId) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to load your feed')
    const channelIds = ids(p, 'channelIds', CHANNEL_ID, 20)
    const perChannel = int(p, 'perChannel', 1, 6, 4)
    const settled = await Promise.allSettled(
      channelIds.map((c) => yt('playlistItems', { part: 'contentDetails', playlistId: 'UU' + c.slice(2), maxResults: String(perChannel) })),
    )
    if (settled.every((s) => s.status === 'rejected')) {
      const first = settled[0] as PromiseRejectedResult
      if (first.reason instanceof HttpError && first.reason.code === 'QUOTA_EXCEEDED') throw first.reason
    }
    const entries: { id: string; at: string }[] = []
    for (const s of settled) {
      if (s.status !== 'fulfilled') continue
      for (const it of s.value.items ?? []) {
        if (it.contentDetails?.videoId) entries.push({ id: it.contentDetails.videoId, at: it.contentDetails.videoPublishedAt ?? '' })
      }
    }
    entries.sort((a, b) => b.at.localeCompare(a.at))
    const vids = await fetchVideos(entries.slice(0, 50).map((e) => e.id))
    return { items: vids.filter((v) => v.embeddable).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)) }
  },

  /** playlists.list for a channel (1 unit). */
  async channelPlaylists(p) {
    const res = await yt('playlists', {
      part: 'snippet,contentDetails',
      channelId: str(p, 'channelId', { re: CHANNEL_ID, required: true }),
      pageToken: str(p, 'pageToken', { re: PAGE_TOKEN }),
      maxResults: String(int(p, 'maxResults', 1, 50, 24)),
    })
    return { items: (res.items ?? []).map(mapPlaylist).filter((x): x is PlaylistSummary => !!x), nextPageToken: res.nextPageToken ?? null }
  },

  /** Videos of a public YouTube playlist, plus its metadata on the first page. */
  async playlistVideos(p) {
    const playlistId = str(p, 'playlistId', { re: PLAYLIST_ID, required: true })!
    const pageToken = str(p, 'pageToken', { re: PAGE_TOKEN })
    const [items, meta] = await Promise.all([
      yt('playlistItems', { part: 'contentDetails', playlistId, pageToken, maxResults: '30' }),
      pageToken ? Promise.resolve<RawList>({}) : yt('playlists', { part: 'snippet,contentDetails', id: playlistId }),
    ])
    const vids = (items.items ?? []).map((i) => i.contentDetails?.videoId).filter((x): x is string => !!x)
    return {
      playlist: meta.items?.[0] ? mapPlaylist(meta.items[0]) : null,
      items: (await fetchVideos(vids)).filter((v) => v.embeddable),
      nextPageToken: items.nextPageToken ?? null,
    }
  },
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function resolveUser(req: Request): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!token || !url || !anon) return null
  // The publishable/anon key is not a user session: getUser() simply returns an error for it.
  const client = createClient(url, anon, { auth: { persistSession: false } })
  const { data, error } = await client.auth.getUser(token)
  return error ? null : (data.user?.id ?? null)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) })
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'POST only')
    const userId = await resolveUser(req)
    const allowedRequest = userId ? userLimiter(`u:${userId}`) : anonLimiter(`ip:${clientIp(req)}`)
    if (!allowedRequest) throw new HttpError(429, 'RATE_LIMITED', 'Too many requests, slow down')

    const raw = await req.text()
    if (raw.length > 8_000) throw new HttpError(413, 'BAD_REQUEST', 'Request too large')
    let body: { action?: unknown; params?: unknown }
    try {
      body = JSON.parse(raw)
    } catch {
      throw new HttpError(400, 'BAD_REQUEST', 'Invalid JSON')
    }
    const action = typeof body.action === 'string' ? body.action : ''
    const handler = Object.hasOwn(actions, action) ? actions[action] : undefined
    if (!handler) throw new HttpError(400, 'BAD_REQUEST', 'Unknown action')
    const params = (body.params && typeof body.params === 'object' && !Array.isArray(body.params) ? body.params : {}) as Params

    // Personalized actions are cached per user; the rest are shared across everyone.
    const cacheKey = `${action}:${action === 'feed' ? userId : ''}:${JSON.stringify(params, Object.keys(params).sort())}`
    const hit = cacheGet(cacheKey)
    if (hit !== undefined) return json(req, { data: hit }, 200, { 'X-Cache': 'HIT' })

    const data = await handler(params, { userId })
    cacheSet(cacheKey, data, TTL[action] ?? 5 * 60_000)
    return json(req, { data }, 200, { 'X-Cache': 'MISS' })
  } catch (e) {
    if (e instanceof HttpError) return json(req, { error: { code: e.code, message: e.message } }, e.status)
    console.error(e)
    return json(req, { error: { code: 'INTERNAL', message: 'Unexpected error' } }, 500)
  }
})

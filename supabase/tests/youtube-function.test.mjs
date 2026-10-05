// Integration test for the `youtube` Edge Function: runs it under Deno against a local fake YouTube API.
//   npm run test:functions        (needs Deno on PATH, or it falls back to `npx deno`)
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import http from 'node:http'
import { after, before, test } from 'node:test'

const FAKE_PORT = 8799
let fake
let fn
let fakeHits = 0

const videoItem = (id, over = {}) => ({
  id,
  snippet: { title: `T ${id}`, description: 'd'.repeat(500), publishedAt: '2026-01-01T00:00:00Z', channelId: 'UC' + 'a'.repeat(22), channelTitle: 'Chan', thumbnails: { medium: { url: 'https://i.ytimg.com/x.jpg' } }, categoryId: '10', tags: ['a', 'b'], liveBroadcastContent: 'none' },
  contentDetails: { duration: 'PT1H2M3S' },
  statistics: { viewCount: '12345', likeCount: '10' },
  status: { embeddable: true, privacyStatus: 'public' },
  ...over,
})

before(async () => {
  fake = http.createServer((req, res) => {
    fakeHits++
    const url = new URL(req.url, 'http://x')
    const send = (status, body) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body))
    const path = url.pathname
    if (path === '/search') {
      if (url.searchParams.get('q') === 'quota') return send(403, { error: { code: 403, message: 'quota', errors: [{ reason: 'quotaExceeded' }] } })
      return send(200, { nextPageToken: 'NEXT', items: [{ id: { videoId: 'AAAAAAAAAAA' } }, { id: { videoId: 'BBBBBBBBBBB' } }] })
    }
    if (path === '/videos') {
      if (url.searchParams.get('chart') && url.searchParams.get('videoCategoryId') === '99') return send(404, { error: { code: 404, message: 'x', errors: [{ reason: 'videoChartNotFound' }] } })
      const ids = (url.searchParams.get('id') ?? 'CCCCCCCCCCC').split(',')
      const items = ids.map((id) => (id === 'BBBBBBBBBBB' ? videoItem(id, { status: { embeddable: true, privacyStatus: 'private' } }) : videoItem(id)))
      return send(200, { items, nextPageToken: undefined })
    }
    if (path === '/playlistItems') return send(200, { items: [{ contentDetails: { videoId: 'AAAAAAAAAAA', videoPublishedAt: '2026-02-01T00:00:00Z' } }] })
    send(200, { items: [] })
  })
  await new Promise((r) => fake.listen(FAKE_PORT, r))

  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  fn = spawn(cmd, ['--yes', 'deno@latest', 'run', '-A', 'supabase/functions/youtube/index.ts'], {
    env: { ...process.env, YOUTUBE_API_KEY: 'test-key', YOUTUBE_API_BASE: `http://localhost:${FAKE_PORT}`, DENO_NO_PROMPT: '1' },
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  // Deno.serve defaults to port 8000.
  for (let i = 0; i < 120; i++) {
    try {
      await fetch('http://localhost:8000', { method: 'OPTIONS' })
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error('function did not start')
})

after(() => {
  fake?.close()
  if (fn?.pid) {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(fn.pid), '/T', '/F'])
    else fn.kill()
  }
})

const call = (action, params = {}, init = {}) =>
  fetch('http://localhost:8000', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) }, body: init.raw ?? JSON.stringify({ action, params }) })

test('CORS preflight and method guard', async () => {
  const pre = await fetch('http://localhost:8000', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } })
  assert.equal(pre.status, 204)
  assert.ok(pre.headers.get('access-control-allow-headers')?.includes('apikey'))
  assert.equal((await fetch('http://localhost:8000')).status, 405)
})

test('rejects malformed requests', async () => {
  assert.equal((await call(null, {}, { raw: '{not json' })).status, 400)
  assert.equal((await call('nope')).status, 400)
  assert.equal((await call('__proto__')).status, 400)
  assert.equal((await call('constructor')).status, 400)
  assert.equal((await call('search', {})).status, 400)
  assert.equal((await call('search', { q: 'x'.repeat(101) })).status, 400)
  assert.equal((await call('search', { q: 'ok', type: 'channel', videoDuration: 'short' })).status, 400)
  assert.equal((await call('search', { q: 'ok', pageToken: '../../etc' })).status, 400)
  assert.equal((await call('search', { q: 'ok', order: 'rating; drop' })).status, 400)
  assert.equal((await call('videos', { ids: ['short'] })).status, 400)
  assert.equal((await call('videos', { ids: Array(51).fill('AAAAAAAAAAA') })).status, 400)
  assert.equal((await call('uploads', { channelId: 'UCnotvalid' })).status, 400)
  assert.equal((await call('trending', { regionCode: 'kr' })).status, 400)
  assert.equal((await call('trending', { categoryId: '1; 2' })).status, 400)
  assert.equal((await call('search', { q: 'x' }, { raw: 'x'.repeat(9000) })).status, 413)
})

test('normalizes video search results, drops non-public videos, parses durations', async () => {
  const res = await call('search', { q: 'lofi', type: 'video' })
  assert.equal(res.status, 200)
  const { data } = await res.json()
  assert.equal(data.kind, 'video')
  assert.equal(data.nextPageToken, 'NEXT')
  assert.deepEqual(data.items.map((v) => v.id), ['AAAAAAAAAAA']) // BBBBBBBBBBB is private
  const v = data.items[0]
  assert.equal(v.durationSeconds, 3723)
  assert.equal(v.viewCount, 12345)
  assert.equal(v.description.length, 200) // lists get a trimmed description
  assert.equal(v.thumbnail, 'https://i.ytimg.com/x.jpg')
  assert.equal('snippet' in v, false) // raw payload never leaks
})

test('caches identical requests (saves quota)', async () => {
  const params = { q: 'cache-me', type: 'video' }
  const first = await call('search', params)
  assert.equal(first.headers.get('x-cache'), 'MISS')
  const before = fakeHits
  const second = await call('search', params)
  assert.equal(second.headers.get('x-cache'), 'HIT')
  assert.equal(fakeHits, before)
})

test('videos action returns full descriptions only when asked', async () => {
  const { data } = await (await call('videos', { ids: ['CCCCCCCCCCC'], full: true })).json()
  assert.equal(data.items[0].description.length, 500)
})

test('uploads use the uploads playlist (not search)', async () => {
  const { data } = await (await call('uploads', { channelId: 'UC' + 'a'.repeat(22) })).json()
  assert.equal(data.items.length, 1)
})

test('trending degrades gracefully when a chart is unavailable', async () => {
  const res = await call('trending', { categoryId: '99', regionCode: 'KR' })
  assert.equal(res.status, 200)
  assert.deepEqual((await res.json()).data, { items: [], nextPageToken: null, unavailable: true })
})

test('feed requires a signed-in user', async () => {
  const res = await call('feed', { channelIds: ['UC' + 'a'.repeat(22)] })
  assert.equal(res.status, 401)
  assert.equal((await res.json()).error.code, 'UNAUTHENTICATED')
})

test('maps quota exhaustion to 429 and stops calling YouTube', async () => {
  const res = await call('search', { q: 'quota' })
  assert.equal(res.status, 429)
  assert.equal((await res.json()).error.code, 'QUOTA_EXCEEDED')
  const before = fakeHits
  const again = await call('videos', { ids: ['DDDDDDDDDDD'] })
  assert.equal(again.status, 429) // circuit breaker: no new upstream request
  assert.equal(fakeHits, before)
})

test('rate limits anonymous callers', async () => {
  const codes = []
  for (let i = 0; i < 60; i++) codes.push((await call('videos', { ids: [`Z${String(i).padStart(10, '0')}`] })).status)
  assert.ok(codes.includes(429), 'expected at least one 429 after bursting')
})

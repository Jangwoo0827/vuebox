export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

/** "1시간 23분" style, for stats. */
export function formatWatchTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  if (s < 60) return `${s}초`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`
}

const compact = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 })
export const formatCount = (n: number) => compact.format(n)
export const formatViews = (n: number | null) => (n === null ? '' : `조회수 ${formatCount(n)}회`)

const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const diff = Math.round((t - now) / 1000)
  const abs = Math.abs(diff)
  for (const [unit, secs] of UNITS) if (abs >= secs) return rtf.format(Math.round(diff / secs), unit)
  return rtf.format(0, 'second')
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

/** Parse "1:23", "01:02:03" or plain seconds typed by the user. Returns null if invalid. */
export function parseTimestamp(input: string): number | null {
  const parts = input.trim().split(':')
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0)
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

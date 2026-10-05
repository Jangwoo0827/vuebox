const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'how', 'what', 'new', 'you', 'your', 'are', 'was', 'official',
  'video', 'videos', 'full', 'episode', 'part', 'live', 'shorts', 'short', 'ft', 'feat', 'hd', '4k', 'vs',
  '영상', '공식', '최신', '하는', '있는', '에서', '으로', '하기', '위한',
])

/** Lowercased word tokens (unicode-aware, so Korean works too), minus noise and pure numbers. */
export function tokenize(text: string): string[] {
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_+#.-]*/gu) ?? []
  return tokens.map((t) => t.replace(/[.-]+$/, '')).filter((t) => t.length >= 2 && !/^\d+$/.test(t) && !STOPWORDS.has(t))
}

/** Most informative keywords for a video: explicit tags first, then title words, deduped. */
export function extractKeywords(title: string, tags: readonly string[] = [], limit = 8): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (t: string) => {
    if (!seen.has(t) && out.length < limit) {
      seen.add(t)
      out.push(t)
    }
  }
  for (const tag of tags) for (const t of tokenize(tag)) push(t)
  for (const t of tokenize(title)) push(t)
  return out
}

export function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  const inter = a.filter((x) => setB.has(x)).length
  return inter / (new Set([...a, ...b]).size || 1)
}

import { useEffect } from 'react'

const BASE = 'VUEBOX'
const DEFAULT_DESCRIPTION = '공식 YouTube 플레이어로 영상을 보고, 시청 기록·재생목록·추천이 모든 기기에서 동기화되는 개인화 영상 플랫폼.'

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

/** Per-page <title>, description and Open Graph tags. */
export function usePageTitle(title?: string | null, description?: string) {
  useEffect(() => {
    const full = title ? `${title} - ${BASE}` : BASE
    const desc = (description ?? DEFAULT_DESCRIPTION).slice(0, 200)
    document.title = full
    setMeta('meta[name="description"]', 'name', 'description', desc)
    setMeta('meta[property="og:title"]', 'property', 'og:title', full)
    setMeta('meta[property="og:description"]', 'property', 'og:description', desc)
  }, [title, description])
}

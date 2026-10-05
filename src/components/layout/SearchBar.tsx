import { History, Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useDebounce } from '@/hooks/useDebounce'
import { useSearchHistory } from '@/hooks/useSearchHistory'

interface Props {
  /** Phone layout: the field fills the top bar and shows a back button. */
  autoFocus?: boolean
  onDone?: () => void
}

/** Search box with recent-search suggestions. Typing never calls the API: only submitting does (quota). */
export function SearchBar({ autoFocus, onDone }: Props) {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const urlQuery = location.pathname === '/search' ? (params.get('q') ?? '') : ''
  const [value, setValue] = useState(urlQuery)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const { items, remove, clear, enabled } = useSearchHistory(30)

  useEffect(() => setValue(urlQuery), [urlQuery])

  const debounced = useDebounce(value.trim().toLowerCase(), 300)
  const suggestions = useMemo(() => {
    const list = debounced ? items.filter((i) => i.query.toLowerCase().includes(debounced) && i.query.toLowerCase() !== debounced) : items
    return list.slice(0, 8)
  }, [items, debounced])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const submit = (q: string) => {
    const query = q.trim()
    if (!query) return // empty queries never hit the API
    setOpen(false)
    setActive(-1)
    inputRef.current?.blur()
    navigate(`/search?q=${encodeURIComponent(query)}`)
    onDone?.()
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit(active >= 0 && suggestions[active] ? suggestions[active].query : value)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  const showList = open && enabled && suggestions.length > 0

  return (
    <form ref={wrapRef} role="search" onSubmit={onSubmit} className="relative w-full max-w-xl">
      <div className="flex">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="search"
            value={value}
            autoFocus={autoFocus}
            maxLength={100}
            enterKeyHint="search"
            autoComplete="off"
            placeholder="영상, 채널, 재생목록 검색"
            aria-label="검색"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            onChange={(e) => {
              setValue(e.target.value)
              setActive(-1)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            className="h-11 w-full rounded-l-full border border-border bg-surface pl-4 pr-9 text-base text-text placeholder:text-text-secondary focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {value && (
            <button
              type="button"
              aria-label="검색어 지우기"
              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary hover:text-text"
              onClick={() => {
                setValue('')
                inputRef.current?.focus()
              }}
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <button type="submit" aria-label="검색" className="flex h-11 w-14 items-center justify-center rounded-r-full border border-l-0 border-border bg-surface-2 hover:bg-surface-hover">
          <Search className="size-5" aria-hidden />
        </button>
      </div>

      {showList && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow)]">
          <div className="flex items-center justify-between px-4 pb-1 pt-3 text-xs font-medium text-text-secondary">
            <span>최근 검색</span>
            <button type="button" className="hover:text-text" onClick={() => clear()}>
              전체 삭제
            </button>
          </div>
          <ul id={listId} role="listbox" aria-label="최근 검색어">
            {suggestions.map((s, i) => (
              <li key={s.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={`flex items-center ${i === active ? 'bg-surface-hover' : 'hover:bg-surface-hover'}`}>
                <button type="button" className="flex min-h-11 flex-1 items-center gap-3 px-4 text-left" onClick={() => submit(s.query)}>
                  <History className="size-4 shrink-0 text-text-secondary" aria-hidden />
                  <span className="truncate">{s.query}</span>
                </button>
                <button type="button" aria-label={`${s.query} 삭제`} className="mr-2 flex size-9 items-center justify-center rounded-full text-text-secondary hover:text-text" onClick={() => remove(s.id)}>
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  )
}

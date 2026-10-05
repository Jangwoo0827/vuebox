import { useState } from 'react'

interface Props {
  src?: string | null
  name: string
  size?: number
  className?: string
}

/** Image avatar with a letter fallback (also used when the image URL fails to load). */
export function Avatar({ src, name, size = 36, className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size, fontSize: size * 0.42 }
  if (src && !failed) {
    return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} style={style} className={`shrink-0 rounded-full bg-surface-2 object-cover ${className}`} />
  }
  return (
    <span aria-hidden style={style} className={`inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent ${className}`}>
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

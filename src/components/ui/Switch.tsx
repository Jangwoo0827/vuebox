interface Props {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}

/** Settings row with an accessible toggle (role="switch"). */
export function Switch({ checked, onChange, label, description, disabled }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        {description && <p className="text-sm text-text-secondary">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-accent' : 'bg-surface-hover'}`}
      >
        <span className={`absolute left-0.5 top-0.5 size-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  )
}

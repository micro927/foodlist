import { useMemo, useState } from 'react'
import { inputClass } from './ui'

/** Free-text input with tappable suggestion chips underneath (friendlier than a dropdown on phones). */
export function Autocomplete({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase()
    return options.filter((o) => o.toLowerCase() !== q && o.toLowerCase().includes(q)).slice(0, 12)
  }, [value, options])

  return (
    <div>
      <input
        className={inputClass}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {focused && suggestions.length > 0 && (
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange(s)}
              className="h-8 shrink-0 rounded-full bg-black/[0.05] px-3 text-sm whitespace-nowrap active:bg-black/10"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useId, useRef, useState } from "react"

export type CatalogSelectOption = { value: string; label: string }

type Props = {
  label: string
  value: string
  options: CatalogSelectOption[]
  onChange: (value: string) => void
  /** aria-label для кнопки */
  ariaLabel?: string
}

/** Свой выпадающий список вместо системного &lt;select&gt; */
export function CatalogSelect({
  label,
  value,
  options,
  onChange,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const current = options.find((o) => o.value === value) || options[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    window.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div
      className={`catalog-select${open ? " is-open" : ""}`}
      ref={rootRef}
    >
      <span className="catalog-select-label">{label}</span>
      <button
        type="button"
        className="catalog-select-trigger"
        aria-label={ariaLabel || label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="catalog-select-value">{current?.label}</span>
        <svg
          className="catalog-select-chev"
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open ? (
        <ul
          id={listId}
          className="catalog-select-list"
          role="listbox"
          aria-label={ariaLabel || label}
        >
          {options.map((o) => {
            const selected = o.value === value
            return (
              <li key={o.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={`catalog-select-option${
                    selected ? " is-selected" : ""
                  }`}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                >
                  {o.label}
                  {selected ? <span className="catalog-select-check">✓</span> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

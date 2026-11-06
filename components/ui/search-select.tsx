"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

export type SearchSelectOption = { value: string; label: string; disabled?: boolean }

/**
 * Dropdown dengan pencarian. Dipakai untuk semua pilihan aplikasi:
 * daftar pendek tetap memakai gaya yang sama, kolom pencarian muncul
 * otomatis saat opsi lebih dari `searchThreshold`.
 *
 * Keyboard: ArrowDown/ArrowUp pindah highlight, Enter pilih, Escape tutup.
 */
export function SearchSelect({
  id,
  name,
  options,
  value,
  onValueChange,
  onChange,
  onBlur,
  placeholder = "Pilih…",
  disabled,
  invalid,
  describedBy,
  className,
  searchThreshold = 6,
  inputRef,
}: {
  id: string
  name?: string
  options: SearchSelectOption[]
  value: string
  onValueChange?: (value: string) => void
  /** Kompatibilitas RHF register: dipanggil dengan event-like { target: { name, value } }. */
  onChange?: (e: { target: { name?: string; value: string } }) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  describedBy?: string
  className?: string
  searchThreshold?: number
  inputRef?: React.Ref<HTMLInputElement>
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [highlight, setHighlight] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const listId = `${id}-listbox`

  const selected = options.find((o) => o.value === value)
  const showSearch = options.length > searchThreshold

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [highlight])

  /** Buka menu: reset pencarian + sorotan, lalu fokus ke kolom cari. */
  const openMenu = () => {
    setQuery("")
    setHighlight(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  const commit = (opt: SearchSelectOption) => {
    if (opt.disabled) return
    onValueChange?.(opt.value)
    onChange?.({ target: { name, value: opt.value } })
    onBlur?.()
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        openMenu()
      }
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => Math.min(filtered.length - 1, h + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const opt = filtered[highlight]
      if (opt) commit(opt)
    } else if (e.key === "Tab") {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {/* Hidden input supaya react-hook-form register tetap mendapat nilai + ref */}
      {name && <input ref={inputRef} type="hidden" name={name} value={value} readOnly />}

      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-[4px] border bg-surface px-3 text-left text-base ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-bg disabled:text-ink-muted",
          invalid ? "border-danger bg-danger-soft/40" : "border-input",
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-ink-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-[4px] border border-border bg-surface shadow-raised">
          {showSearch && (
            <div className="relative border-b border-border p-2">
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setHighlight(0)
                }}
                onKeyDown={onKeyDown}
                placeholder="Cari…"
                aria-label={`Cari pilihan ${id}`}
                aria-controls={listId}
                className="h-9 w-full rounded-[3px] border border-input bg-surface pl-8 pr-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          <ul ref={listRef} id={listId} role="listbox" aria-label="Pilihan" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada hasil.</li>}
            {filtered.map((opt, i) => {
              const isSelected = opt.value === value
              const isHighlighted = i === highlight
              return (
                <li key={opt.value} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    data-index={i}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => commit(opt)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm",
                      opt.disabled
                        ? "cursor-not-allowed text-muted-foreground/60"
                        : isHighlighted
                          ? "bg-primary-soft text-primary-ink"
                          : "text-ink hover:bg-bg",
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check aria-hidden className="size-4 shrink-0 text-primary" strokeWidth={2.5} />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

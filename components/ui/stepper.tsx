"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export function KtaStepper({
  steps,
  current,
  className,
}: {
  steps: { label: string; desc?: string }[]
  /** index 0-based: sudah selesai < current, aktif = current, belum = > current */
  current: number
  className?: string
}) {
  return (
    <ol className={cn("flex w-full items-start", className)} aria-label="Progres KTA">
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s.label} className={cn("relative flex flex-1 flex-col items-center text-center", i < steps.length - 1 && "after:absolute after:left-[calc(50%+18px)] after:right-[calc(-50%+18px)] after:top-4 after:h-px after:bg-border", done && "after:bg-primary")}>
            <span
              aria-hidden
              className={cn(
                "relative z-10 grid size-8 place-items-center rounded-lg border text-sm font-semibold",
                done && "border-primary bg-primary text-white",
                active && "border-primary bg-surface text-primary ring-2 ring-primary/30",
                !done && !active && "border-control-border bg-surface text-ink-muted"
              )}
            >
              {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span className={cn("mt-2 px-1 text-xs font-semibold leading-tight", active ? "text-primary-ink" : "text-ink-muted")}>
              {s.label}
            </span>
            {s.desc && <span className="mt-0.5 px-1 text-[11px] leading-tight text-ink-muted">{s.desc}</span>}
          </li>
        )
      })}
    </ol>
  )
}

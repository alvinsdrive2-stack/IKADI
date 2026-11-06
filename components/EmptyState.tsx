import { ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, SearchX } from "lucide-react"

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      <SearchX aria-hidden className="size-12 text-control-border" strokeWidth={1.5} />
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      {action}
    </div>
  )
}

export { ArrowRight, ArrowLeft, ChevronLeft, ChevronRight }

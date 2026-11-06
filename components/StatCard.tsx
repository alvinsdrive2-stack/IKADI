import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"

export function StatCard({
  label,
  value,
  icon,
  hint,
  className,
}: {
  label: string
  value: number | string
  icon?: React.ReactNode
  hint?: string
  className?: string
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">{label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-ink">
              {typeof value === "number" ? value.toLocaleString("id-ID") : value}
            </p>
            {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
          </div>
          {icon && (
            <span className="grid size-10 shrink-0 place-items-center rounded-[4px] bg-primary-soft text-primary">
              {icon}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

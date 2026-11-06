import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone = "success" | "error" | "info"

const tones: Record<Tone, string> = {
  success: "border-primary/20 bg-primary-soft text-primary-ink",
  error: "border-danger-border bg-danger-soft text-danger",
  info: "border-border bg-surface text-ink",
}

export function AlertIcon({ tone }: { tone: Tone }) {
  const cls = "mt-0.5 size-5 shrink-0"
  if (tone === "success") return <CheckCircle2 aria-hidden className={cls} strokeWidth={2} />
  if (tone === "error") return <AlertCircle aria-hidden className={cls} strokeWidth={2} />
  return <Info aria-hidden className={cls} strokeWidth={2} />
}

export function Alert({
  tone = "info",
  children,
  innerRef,
  className,
}: {
  tone?: Tone
  children: React.ReactNode
  innerRef?: React.Ref<HTMLDivElement>
  className?: string
}) {
  return (
    <div
      ref={innerRef}
      role={tone === "error" ? "alert" : "status"}
      tabIndex={tone === "error" ? -1 : undefined}
      className={cn(`flex items-start gap-2 rounded-lg border p-4 text-sm font-medium ${tones[tone]}`, className)}
    >
      <AlertIcon tone={tone} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

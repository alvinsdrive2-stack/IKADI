import { Badge as UiBadge } from "@/components/ui/badge"

export function Badge({
  variant = "neutral",
  children,
}: {
  variant?: "neutral" | "pw" | "pd" | "success"
  children: React.ReactNode
}) {
  const map = {
    neutral: "secondary" as const,
    pw: "pw" as const,
    pd: "pd" as const,
    success: "success" as const,
  }
  return <UiBadge variant={map[variant]}>{children}</UiBadge>
}

export function OriginBadge({ type }: { type: string }) {
  return <Badge variant={type === "PD" ? "pd" : "pw"}>{type}</Badge>
}

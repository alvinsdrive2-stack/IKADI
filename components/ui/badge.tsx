import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[3px] px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary-soft text-primary-ink",
        secondary: "bg-bg text-ink-muted",
        pw: "bg-primary-soft text-primary-ink",
        pd: "bg-accent-soft text-accent-ink",
        success: "bg-primary-soft text-primary-ink",
        outline: "border border-border text-ink",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {variant === "success" && <Check aria-hidden strokeWidth={3} />}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }

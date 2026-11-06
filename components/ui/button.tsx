import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "border border-primary bg-surface text-primary hover:bg-bg",
        ghost: "text-ink-muted hover:bg-bg hover:text-primary",
        onDark: "bg-surface text-primary-hover hover:bg-primary-soft",
        outline: "border border-input bg-surface hover:bg-bg hover:text-primary",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 text-base",
        sm: "h-9 min-h-11 md:min-h-0 px-3 text-sm",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, type, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, className }))
    if (asChild) {
      return (
        <Slot className={classes} ref={ref} {...props}>
          {children}
        </Slot>
      )
    }
    return (
      <button
        type={type ?? "button"}
        className={classes}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        ref={ref}
        {...props}
      >
        {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { LoaderCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants, type ButtonProps as UiButtonProps } from "@/components/ui/button"

type Variant = "primary" | "secondary" | "ghost" | "onDark"

const variantMap: Record<Variant, UiButtonProps["variant"]> = {
  primary: "default",
  secondary: "secondary",
  ghost: "ghost",
  onDark: "onDark",
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  type = "button",
  children,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: "md" | "sm"
  loading?: boolean
  asChild?: boolean
}) {
  const uiSize = size === "sm" ? "sm" : "default"
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      type={asChild ? undefined : type}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : loading || props.disabled}
      className={cn(buttonVariants({ variant: variantMap[variant], size: uiSize }), className)}
      {...props}
    >
      {loading && <LoaderCircle aria-hidden className="animate-spin" />}
      {children}
    </Comp>
  )
}

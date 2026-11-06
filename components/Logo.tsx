import Image from "next/image"
import Link from "next/link"

export function LogoMark({
  size = 40,
  priority = false,
  className = "",
  variant = "color",
}: {
  size?: number
  priority?: boolean
  className?: string
  variant?: "color" | "white"
}) {
  return (
    <Image
      src="/logo.png"
      alt="Logo IKADI"
      width={size}
      height={size}
      priority={priority}
      style={{ width: size, height: size }}
      className={`shrink-0 object-contain ${
        variant === "white" ? "[filter:brightness(0)_invert(1)]" : ""
      } ${className}`}
    />
  )
}

export function Logo({ href = "/", onDark = false, subtitle }: { href?: string; onDark?: boolean; subtitle?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 no-underline">
      <LogoMark priority size={38} variant={onDark ? "white" : "color"} />
      <span className="min-w-0 leading-tight">
        <span className={`block whitespace-nowrap text-sm font-bold tracking-tight sm:text-base ${onDark ? "text-white" : "text-primary-ink"}`}>
          Pendataan KTA IKADI
        </span>
        <span className={`hidden text-xs sm:block ${onDark ? "text-white/80" : "text-ink-muted"}`}>
          {subtitle ?? "Ikatan Dai Indonesia"}
        </span>
      </span>
    </Link>
  )
}

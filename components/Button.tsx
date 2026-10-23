import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "onDark";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "border border-primary bg-surface text-primary hover:bg-bg",
  ghost: "text-ink-muted hover:bg-bg hover:text-primary",
  // Putih di atas hero hijau: 6.5:1 (DESIGN.md 4.1)
  onDark: "bg-surface text-primary-hover hover:bg-primary-soft",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  type = "button",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "md" | "sm";
  loading?: boolean;
}) {
  const sizing =
    size === "sm"
      ? "px-3 text-sm min-h-11 md:h-9 md:min-h-0"
      : "h-11 px-5 text-base";

  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md border border-transparent font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizing} ${className}`}
      {...props}
    >
      {loading && (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-4 animate-spin"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        >
          <circle cx="12" cy="12" r="9" opacity=".25" />
          <path d="M21 12a9 9 0 0 0-9-9" />
        </svg>
      )}
      {children}
    </button>
  );
}

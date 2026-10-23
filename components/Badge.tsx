type Variant = "neutral" | "pw" | "pd" | "success";

const variants: Record<Variant, string> = {
  neutral: "bg-bg text-ink-muted",
  pw: "bg-primary-soft text-primary-ink",
  pd: "bg-accent-soft text-accent-ink",
  success: "bg-primary-soft text-primary-ink",
};

export function Badge({
  variant = "neutral",
  children,
}: {
  variant?: Variant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${variants[variant]}`}
    >
      {variant === "success" && (
        <svg
          aria-hidden
          className="size-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        >
          <path d="m5 13 4 4L19 7" />
        </svg>
      )}
      {children}
    </span>
  );
}

/** Badge asal IKADI: PW hijau, PD emas, selalu bertulisan (tanpa warna tetap terbaca). */
export function OriginBadge({ type }: { type: string }) {
  return <Badge variant={type === "PD" ? "pd" : "pw"}>{type}</Badge>;
}

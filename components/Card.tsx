export function Card({
  title,
  description,
  headerAction,
  main = false,
  className = "",
  children,
}: {
  title?: string;
  description?: string;
  headerAction?: React.ReactNode;
  /** Kartu utama: radius lebih besar. */
  main?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`border border-border bg-surface shadow-card ${
        main ? "rounded-xl" : "rounded-lg"
      } ${className}`}
    >
      {(title || headerAction) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          {headerAction}
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

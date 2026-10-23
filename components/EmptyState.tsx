export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      <svg
        aria-hidden
        className="size-12 text-control-border"
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="8" y="10" width="32" height="28" rx="3" />
        <path d="M15 19h18M15 25h18M15 31h10" strokeLinecap="round" />
      </svg>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-ink-muted">{description}</p>
      )}
      {action}
    </div>
  );
}

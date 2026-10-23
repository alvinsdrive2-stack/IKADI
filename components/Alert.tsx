type Tone = "success" | "error" | "info";

const tones: Record<Tone, string> = {
  success: "border-primary/20 bg-primary-soft text-primary-ink",
  error: "border-danger-border bg-danger-soft text-danger",
  info: "border-border bg-surface text-ink",
};

export function AlertIcon({ tone }: { tone: Tone }) {
  if (tone === "success") {
    return (
      <svg
        aria-hidden
        className="mt-0.5 size-5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      className="mt-0.5 size-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" strokeLinecap="round" />
    </svg>
  );
}

export function Alert({
  tone = "info",
  children,
  innerRef,
}: {
  tone?: Tone;
  children: React.ReactNode;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={innerRef}
      role={tone === "error" ? "alert" : "status"}
      tabIndex={tone === "error" ? -1 : undefined}
      className={`flex items-start gap-2 rounded-md border p-4 text-sm font-medium ${tones[tone]}`}
    >
      {tone !== "info" && <AlertIcon tone={tone} />}
      <div>{children}</div>
    </div>
  );
}

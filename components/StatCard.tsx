export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-ink">
        {value.toLocaleString("id-ID")}
      </p>
    </div>
  );
}

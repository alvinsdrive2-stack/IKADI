export function Pagination({
  page,
  totalPages,
  total,
  perPage,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const navBtn =
    "inline-flex min-h-11 items-center rounded-md border border-control-border bg-surface px-3 text-sm font-medium hover:bg-bg md:h-10 md:min-h-0";

  return (
    <nav
      aria-label="Navigasi halaman"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-ink-muted">
        Menampilkan {from}–{to} dari {total.toLocaleString("id-ID")} peserta
      </p>
      <div className="flex items-center gap-2">
        {page <= 1 ? (
          <span
            aria-disabled="true"
            aria-label="Halaman sebelumnya, tidak tersedia"
            className={`${navBtn} cursor-not-allowed opacity-50`}
          >
            &larr; Sebelumnya
          </span>
        ) : (
          <button type="button" onClick={onPrev} className={navBtn}>
            &larr; Sebelumnya
          </button>
        )}
        <span className="px-2 text-sm text-ink-muted">
          Halaman <strong className="text-ink">{page}</strong> dari {totalPages}
        </span>
        {page >= totalPages ? (
          <span
            aria-disabled="true"
            aria-label="Halaman berikutnya, tidak tersedia"
            className={`${navBtn} cursor-not-allowed opacity-50`}
          >
            Berikutnya &rarr;
          </span>
        ) : (
          <button type="button" onClick={onNext} className={navBtn}>
            Berikutnya &rarr;
          </button>
        )}
      </div>
    </nav>
  );
}

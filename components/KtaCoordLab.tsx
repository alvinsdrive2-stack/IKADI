"use client";

/**
 * Lab koordinat kartu KTA — global, tidak terikat peserta.
 * Menaruh slot (pas foto, nomor, nama, level, TTD Sekjen, TTD Ketum) di atas
 * artwork asli, lalu menyalin hasilnya sebagai JSON persen yang dibakar ke
 * komponen kartu final. Tidak memanggil API: data contoh statis, jadi tidak
 * memakai kuota cetak.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  KTA_FACE_LABEL,
  KTA_FACE_SRC,
  KTA_LAYOUT,
  KTA_SLOT_LABEL,
  KTA_SLOT_ORDER,
  type KtaAlign,
  type KtaBox,
  type KtaFace,
  type KtaLayout,
  type KtaSlotKey,
  boxStyle,
  fontStyle,
} from "@/lib/kta-layout";

const STORAGE_KEY = "kta-coord-lab-v5";

type SlotKey = KtaSlotKey;
type Box = KtaBox;
type Layout = KtaLayout;

const SLOT_ORDER = KTA_SLOT_ORDER;
const SLOT_LABEL = KTA_SLOT_LABEL;
/** Default = koordinat final di lib/kta-layout.ts; lab boleh menyimpang sementara. */
const DEFAULTS: Layout = KTA_LAYOUT;

const SAMPLE = {
  memberNumber: "6.32.03.26.0001",
  fullName: "H. Ahmad Fauzi, S.Pd.",
  levelLabel: "Anggota | Jawa Barat | Kabupaten Cianjur",
  noteAuth: "Terbit dan berlaku selama terdaftar sebagai anggota IKADI.",
  sekjen: { jabatan: "Sekretaris Jenderal", nama: "H. Abdul Rahman, Lc." },
  ketum: { jabatan: "Ketua Umum", nama: "Dr. KH. Ahmad Zaini, M.A." },
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number) => Math.round(n * 100) / 100;

function parseStored(raw: string | null): Layout | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Layout>;
    const out: Layout = { ...DEFAULTS };
    for (const key of SLOT_ORDER) {
      const b = parsed[key];
      if (!b || typeof b.x !== "number" || typeof b.y !== "number") continue;
      out[key] = {
        x: b.x,
        y: b.y,
        w: typeof b.w === "number" ? b.w : DEFAULTS[key].w,
        size: typeof b.size === "number" ? b.size : DEFAULTS[key].size,
        align: b.align === "center" ? "center" : "left",
      };
    }
    return out;
  } catch {
    return null;
  }
}

export function KtaCoordLab() {
  const [face, setFace] = useState<KtaFace>("depan");
  const [grid, setGrid] = useState(true);
  const [layout, setLayout] = useState<Layout>(DEFAULTS);
  const [selected, setSelected] = useState<SlotKey>("photo");
  const [copied, setCopied] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  // 1em di permukaan preview = lebar kotak, sama seperti `.kta-card` saat cetak.
  const [boxWidth, setBoxWidth] = useState(0);
  const dragRef = useRef<{ key: SlotKey; startX: number; startY: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    setLayout(parseStored(window.localStorage.getItem(STORAGE_KEY)) ?? DEFAULTS);
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // Private mode / storage penuh: abaikan, lab tetap jalan di memori.
    }
  }, [layout]);

  function move(key: SlotKey, dx: number, dy: number) {
    setLayout((l) => ({
      ...l,
      [key]: {
        ...l[key],
        x: round(clamp(l[key].x + dx, -20, 100)),
        y: round(clamp(l[key].y + dy, -20, 100)),
      },
    }));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, key: SlotKey) {
    if (!boxRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { key, startX: e.clientX, startY: e.clientY, ox: layout[key].x, oy: layout[key].y };
    setSelected(key);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    const box = boxRef.current;
    if (!d || !box) return;
    const r = box.getBoundingClientRect();
    const nx = clamp(d.ox + ((e.clientX - d.startX) / r.width) * 100, -20, 100);
    const ny = clamp(d.oy + ((e.clientY - d.startY) / r.height) * 100, -20, 100);
    setLayout((l) => ({ ...l, [d.key]: { ...l[d.key], x: round(nx), y: round(ny) } }));
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>, key: SlotKey) {
    const step = e.shiftKey ? 1 : 0.25;
    const map: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = map[e.key];
    if (!delta) return;
    e.preventDefault();
    setSelected(key);
    move(key, delta[0], delta[1]);
  }

  function setField<K extends keyof Box>(key: SlotKey, field: K, value: Box[K]) {
    if (field !== "align" && typeof value === "number" && !Number.isFinite(value)) return;
    setLayout((l) => ({
      ...l,
      [key]: { ...l[key], [field]: typeof value === "number" ? round(value) : value },
    }));
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(layout, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const sel = layout[selected];

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin"
          className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-4" /> Kembali ke ringkasan
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Lab koordinat kartu</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Geser slot langsung di kartu atau pakai input angka. X/Y persen dari artwork, lebar &amp; ukuran font dalam
          persen lebar kartu. Hasilnya disalin sebagai JSON untuk dibakar ke komponen kartu final — satu set
          koordinat untuk semua anggota.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="rounded-xl border border-border bg-cam p-4 sm:p-6">
          <div
            ref={boxRef}
            className="relative w-full select-none overflow-hidden rounded-lg"
            style={{ aspectRatio: "1050 / 600", fontSize: boxWidth > 0 ? `${boxWidth}px` : undefined }}
          >
            <Image
              src={KTA_FACE_SRC[face]}
              alt={`Artwork KTA ${KTA_FACE_LABEL[face].toLowerCase()}`}
              fill
              priority
              unoptimized
              sizes="(max-width: 1024px) 100vw, 900px"
              className="object-cover"
            />

            {grid && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to right, rgb(255 255 255 / 0.16) 0, rgb(255 255 255 / 0.16) 1px, transparent 1px, transparent 10%), repeating-linear-gradient(to bottom, rgb(255 255 255 / 0.16) 0, rgb(255 255 255 / 0.16) 1px, transparent 1px, transparent 10%)",
                }}
              />
            )}

            {SLOT_ORDER.map((key) => {
              const b = layout[key];
              const active = selected === key;
              const isQr = key === "qrSekjen" || key === "qrKetum";
              // Wrapper = posisi + lebar (em dari font-size permukaan preview).
              // Font-size HANYA di elemen dalam, persis seperti kartu final.
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  aria-label={`Geser ${SLOT_LABEL[key]} — X ${b.x} persen, Y ${b.y} persen`}
                  onPointerDown={(e) => onPointerDown(e, key)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onKeyDown={(e) => onKeyDown(e, key)}
                  className={cn(
                    "absolute cursor-move touch-none rounded-[3px] focus-visible:ring-2 focus-visible:ring-accent",
                    active ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-white/60",
                  )}
                  style={{ ...boxStyle(b), position: "absolute" }}
                >
                  <div style={b.size > 0 ? fontStyle(b) : undefined}>
                    {key === "photo" ? (
                      <div
                        className="grid place-items-center border border-dashed border-white/70 bg-white/15 text-center leading-tight text-white/90"
                        style={{ aspectRatio: "13 / 17", fontSize: "1.6cqw" }}
                      >
                        Pas foto
                      </div>
                    ) : isQr ? (
                      <div
                        className="grid place-items-center bg-white text-center leading-tight text-ink-muted"
                        style={{ aspectRatio: "1 / 1", fontSize: "2cqw", borderRadius: "1mm" }}
                      >
                        QR {key === "qrSekjen" ? "sekjen" : "ketum"}
                      </div>
                    ) : key === "sekjen" || key === "ketum" ? (
                      <div className={cn("leading-tight text-white", b.align === "center" && "text-center")}>
                        <p className="uppercase tracking-wider text-white/70" style={{ fontSize: "80%" }}>
                          {SAMPLE[key].jabatan}
                        </p>
                        <p className="font-semibold" style={{ fontSize: "100%" }}>
                          {SAMPLE[key].nama}
                        </p>
                      </div>
                    ) : (
                      <p
                        className={cn(
                          key === "noteAuth" ? "leading-tight text-white/85" : "truncate leading-tight text-white",
                          b.align === "center" ? "text-center" : "text-left",
                          key === "memberNumber" && "font-mono font-extrabold tracking-wide",
                          key === "fullName" && "font-bold",
                        )}
                      >
                        {SAMPLE[key]}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1" role="group" aria-label="Sisi kartu">
              {(Object.keys(KTA_FACE_SRC) as KtaFace[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFace(f)}
                  className={cn(
                    "inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
                    face === f
                      ? "border-primary bg-primary text-white"
                      : "border-white/25 text-white/80 hover:border-white/50 hover:text-white",
                  )}
                >
                  {KTA_FACE_LABEL[f]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setGrid((g) => !g)}
              aria-pressed={grid}
              className={cn(
                "inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium transition-colors",
                grid
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-white/25 text-white/80 hover:border-white/50 hover:text-white",
              )}
            >
              Grid 10%
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-white">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Slot</h2>
            </div>
            <ul className="divide-y divide-border">
              {SLOT_ORDER.map((key) => {
                const b = layout[key];
                const active = selected === key;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setSelected(key)}
                      aria-pressed={active}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-sm transition-colors",
                        active ? "bg-primary-soft font-semibold text-primary-ink" : "text-ink hover:bg-bg",
                      )}
                    >
                      <span>{SLOT_LABEL[key]}</span>
                      <span className="font-mono text-xs tabular-nums text-ink-muted">
                        {b.x}% · {b.y}%
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-white">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">{SLOT_LABEL[selected]}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <label className="block">
                <span className="text-xs text-ink-muted">X (%)</span>
                <Input
                  className="mt-1"
                  type="number"
                  step={0.1}
                  value={sel.x}
                  onChange={(e) => setField(selected, "x", Number(e.target.value))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-ink-muted">Y (%)</span>
                <Input
                  className="mt-1"
                  type="number"
                  step={0.1}
                  value={sel.y}
                  onChange={(e) => setField(selected, "y", Number(e.target.value))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-ink-muted">Lebar (%)</span>
                <Input
                  className="mt-1"
                  type="number"
                  step={0.1}
                  value={sel.w}
                  onChange={(e) => setField(selected, "w", Number(e.target.value))}
                />
              </label>
              <label className="block">
                <span className="text-xs text-ink-muted">Font (%)</span>
                <Input
                  className="mt-1"
                  type="number"
                  step={0.05}
                  value={sel.size}
                  onChange={(e) => setField(selected, "size", Number(e.target.value))}
                />
              </label>
            </div>

            <div className="border-t border-border px-4 py-3">
              <div className="flex gap-1" role="group" aria-label={`Perataan ${SLOT_LABEL[selected]}`}>
                {(["left", "center"] as KtaAlign[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setField(selected, "align", a)}
                    aria-pressed={sel.align === a}
                    className={cn(
                      "inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                      sel.align === a
                        ? "border-primary bg-primary-soft text-primary-ink"
                        : "border-border text-ink-muted hover:bg-bg",
                    )}
                  >
                    {a === "left" ? "Rata kiri" : "Rata tengah"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
              <Button variant="outline" size="sm" onClick={() => setLayout(DEFAULTS)}>
                <RotateCcw aria-hidden /> Reset semua
              </Button>
              <Button variant="outline" size="sm" onClick={copyJson}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? "Tersalin" : "Salin JSON"}
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-bg">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">JSON</h2>
            </div>
            <pre className="max-h-64 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-ink-muted">
              {JSON.stringify(layout, null, 2)}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}

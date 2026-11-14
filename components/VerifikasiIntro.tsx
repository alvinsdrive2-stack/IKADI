"use client";

import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/Logo";

/**
 * Animasi pembuka halaman verifikasi KTA.
 *
 * Urutan mengikuti storyboard motion graphic: bintang Rub el Hizb membelah →
 * kartu logo muncul → bintang menutup → peta Indonesia dengan pinpoint
 * wilayah → dissolve → halaman verifikasi muncul.
 *
 * Semua warna dan transisi ada di `app/verifikasi.css`; komponen ini hanya
 * mengurus fase dan geometri. Ukuran memakai satuan relatif supaya sama di
 * ponsel (QR discan dari HP) maupun desktop. Animasi dilewati kalau pengguna
 * memilih `prefers-reduced-motion`.
 */

type Phase = "star-intro" | "star-open" | "star-close" | "map" | "dissolve";

/** Titik wilayah — koordinat di dalam viewBox peta 1000 × 450. */
const PINS: { id: string; x: number; y: number; scale: number }[] = [
  { id: "medan", x: 135, y: 152, scale: 0.88 },
  { id: "palembang", x: 225, y: 262, scale: 0.94 },
  { id: "jakarta", x: 288, y: 322, scale: 1.18 },
  { id: "pontianak", x: 348, y: 200, scale: 0.92 },
  { id: "surabaya", x: 395, y: 338, scale: 1.02 },
  { id: "ikn", x: 452, y: 205, scale: 1.06 },
  { id: "bali", x: 450, y: 348, scale: 0.9 },
  { id: "makassar", x: 522, y: 268, scale: 1.02 },
  { id: "manado", x: 582, y: 152, scale: 0.88 },
  { id: "ambon", x: 678, y: 255, scale: 0.9 },
  { id: "sorong", x: 762, y: 208, scale: 0.92 },
  { id: "jayapura", x: 885, y: 248, scale: 1.08 },
];

const LINKS: [string, string][] = [
  ["medan", "palembang"],
  ["palembang", "jakarta"],
  ["jakarta", "pontianak"],
  ["jakarta", "surabaya"],
  ["pontianak", "ikn"],
  ["surabaya", "bali"],
  ["surabaya", "makassar"],
  ["ikn", "makassar"],
  ["ikn", "manado"],
  ["makassar", "ambon"],
  ["manado", "sorong"],
  ["ambon", "sorong"],
  ["sorong", "jayapura"],
];

/** Busur kuadratik antar node; sudut lengkung mirip jaringan pada storyboard. */
function buildArcs(): string[] {
  const byId = new Map(PINS.map((p) => [p.id, p]));
  return LINKS.flatMap(([from, to]) => {
    const a = byId.get(from);
    const b = byId.get(to);
    if (!a || !b) return [];
    const midX = (a.x + b.x) / 2;
    const lift = Math.min(48, Math.hypot(b.x - a.x, b.y - a.y) * 0.24);
    const midY = (a.y + b.y) / 2 - lift;
    return [`M ${a.x},${a.y} Q ${midX.toFixed(1)},${midY.toFixed(1)} ${b.x},${b.y}`];
  });
}

const ARC_PATHS = buildArcs();

/** Siluet kepulauan, viewBox 1000 × 450. */
const ISLANDS: string[] = [
  "M 76,94 L 98,98 L 122,122 L 148,144 L 172,172 L 198,202 L 226,232 L 252,262 L 260,294 L 242,306 L 220,294 L 196,268 L 166,236 L 138,200 L 110,162 L 86,126 Z",
  "M 218,186 L 234,190 L 230,202 L 214,196 Z M 266,246 L 288,252 L 282,268 L 262,260 Z M 298,256 L 314,260 L 310,272 L 294,268 Z",
  "M 262,314 L 292,314 L 326,322 L 364,326 L 404,330 L 436,338 L 432,352 L 394,350 L 352,344 L 308,338 L 272,332 L 258,324 Z",
  "M 402,318 L 430,320 L 428,327 L 400,325 Z",
  "M 442,340 L 460,342 L 456,354 L 440,352 Z M 468,342 L 486,344 L 484,356 L 466,354 Z M 494,344 L 532,346 L 528,358 L 492,356 Z M 542,346 L 598,346 L 596,358 L 540,358 Z M 532,370 L 566,374 L 560,388 L 528,382 Z M 604,358 L 652,348 L 656,362 L 608,376 Z",
  "M 332,174 L 368,152 L 406,146 L 442,114 L 478,104 L 502,126 L 488,158 L 510,182 L 496,216 L 482,252 L 460,276 L 424,272 L 392,280 L 360,264 L 338,236 L 324,202 Z",
  "M 538,162 L 578,144 L 622,140 L 632,154 L 584,164 L 560,184 L 600,194 L 612,210 L 576,218 L 564,238 L 594,264 L 580,290 L 564,278 L 552,248 L 536,286 L 514,284 L 518,234 L 522,192 Z",
  "M 658,142 L 682,130 L 688,158 L 706,170 L 686,188 L 674,212 L 660,202 L 666,174 Z M 652,244 L 704,242 L 708,262 L 656,264 Z M 626,246 L 646,246 L 644,262 L 624,260 Z",
  "M 738,198 L 778,184 L 812,200 L 800,222 L 836,210 L 882,204 L 932,226 L 946,272 L 938,332 L 896,326 L 872,298 L 828,286 L 788,262 L 758,236 L 732,224 Z",
];

export function VerifikasiIntro({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("star-intro");
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      doneRef.current();
      return;
    }
    const list = timers.current;
    const at = (ms: number, fn: () => void) => list.push(window.setTimeout(fn, ms));

    at(450, () => setPhase("star-open"));
    at(3600, () => setPhase("star-close"));
    at(4900, () => setPhase("map"));
    at(8600, () => setPhase("dissolve"));
    at(10200, () => setLeaving(true));
    at(10800, () => doneRef.current());

    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  const skip = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    setLeaving(true);
    window.setTimeout(() => doneRef.current(), 400);
  };

  return (
    <div className="vintro" data-phase={phase} data-leaving={leaving} aria-hidden="true">
      {/* Geometri bintang & pin dipakai dua kali lewat <use>. */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="vintroStarFacet" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="vintro-stop-facet-1" />
            <stop offset="55%" className="vintro-stop-facet-2" />
            <stop offset="100%" className="vintro-stop-facet-3" />
          </linearGradient>
          <linearGradient id="vintroStarRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="vintro-stop-rim-1" />
            <stop offset="50%" className="vintro-stop-rim-2" />
            <stop offset="100%" className="vintro-stop-rim-3" />
          </linearGradient>
          <linearGradient id="vintroIslandFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="vintro-stop-island-1" />
            <stop offset="55%" className="vintro-stop-island-2" />
            <stop offset="100%" className="vintro-stop-island-3" />
          </linearGradient>

          <g id="vintroStarGeometry">
            <rect x="-155" y="-155" width="310" height="310" rx="4" className="vintro-star-face" />
            <rect x="-155" y="-155" width="310" height="310" rx="4" transform="rotate(45)" className="vintro-star-face" />
            <rect x="-124" y="-124" width="248" height="248" fill="none" strokeWidth="7" className="vintro-star-band-a" />
            <rect x="-124" y="-124" width="248" height="248" transform="rotate(45)" fill="none" strokeWidth="7" className="vintro-star-band-a" />
            <rect x="-94" y="-94" width="188" height="188" strokeWidth="5" className="vintro-star-core" />
            <rect x="-94" y="-94" width="188" height="188" transform="rotate(45)" strokeWidth="5" className="vintro-star-core" />
            <rect x="-64" y="-64" width="128" height="128" fill="none" strokeWidth="5" className="vintro-star-band-b" />
            <rect x="-64" y="-64" width="128" height="128" transform="rotate(45)" fill="none" strokeWidth="5" className="vintro-star-band-b" />
            <polygon points="0,-62 18,-18 62,0 18,18 0,62 -18,18 -62,0 -18,-18" className="vintro-star-jewel-a" />
            <polygon points="0,-62 18,-18 62,0 18,18 0,62 -18,18 -62,0 -18,-18" transform="rotate(45)" className="vintro-star-jewel-b" />
            <circle r="20" strokeWidth="4" className="vintro-star-pupil" />
            <g className="vintro-spin">
              <circle r="195" fill="none" strokeWidth="2" strokeDasharray="10 8" className="vintro-star-ring" />
            </g>
          </g>

          {/* Pinpoint: (0,0) = ujung bawah pin, tepat di titik wilayah. */}
          <g id="vintroPin">
            <ellipse rx="14" ry="7" fill="none" strokeWidth="2.2" className="vintro-pin-ripple-inner" />
            <ellipse rx="4.8" ry="2.5" className="vintro-pin-dot" />
            <path
              d="M 0,0 C -4.5,-11 -16.5,-21 -16.5,-33 C -16.5,-42.5 -9,-50 0,-50 C 9,-50 16.5,-42.5 16.5,-33 C 16.5,-21 4.5,-11 0,0 Z"
              strokeWidth="2.2"
              className="vintro-pin-body-shape"
            />
            <g transform="translate(0,-33) scale(0.19)">
              <rect x="-32" y="-32" width="64" height="64" className="vintro-pin-star" />
              <rect x="-32" y="-32" width="64" height="64" transform="rotate(45)" className="vintro-pin-star" />
              <circle r="14" className="vintro-pin-star-core" />
            </g>
          </g>
        </defs>
      </svg>

      {/* Bintang yang membelah: dua salinan geometri, masing-masing dipotong setengah. */}
      <div className="vintro-star">
        <div className="vintro-half vintro-half-left">
          <svg viewBox="-300 -300 600 600" className="size-full">
            <defs>
              <clipPath id="vintroClipLeft">
                <rect x="-300" y="-300" width="301" height="600" />
              </clipPath>
            </defs>
            <g clipPath="url(#vintroClipLeft)">
              <use href="#vintroStarGeometry" />
            </g>
          </svg>
        </div>
        <div className="vintro-half vintro-half-right">
          <svg viewBox="-300 -300 600 600" className="size-full">
            <defs>
              <clipPath id="vintroClipRight">
                <rect x="-1" y="-300" width="301" height="600" />
              </clipPath>
            </defs>
            <g clipPath="url(#vintroClipRight)">
              <use href="#vintroStarGeometry" />
            </g>
          </svg>
        </div>
        <div className="vintro-seam" />
      </div>

      {/* Kartu yang muncul dari dalam bintang. */}
      <div className="vintro-logo">
        <div className="vintro-glow" />
        <div className="vintro-logo-card">
          <div className="vintro-shimmer" />
          <p className="vintro-logo-small">KARTU TANDA ANGGOTA</p>
          {/* Logo asli diputihkan: latarnya gradien hijau, logo berwarna tenggelam. */}
          <LogoMark variant="white" size={102} priority className="vintro-logo-mark" />
        </div>
      </div>

      {/* Peta Indonesia + pinpoint wilayah. */}
      <div className="vintro-map">
        <svg viewBox="0 0 1000 450" className="size-full overflow-visible" aria-hidden="true">
          <g className="vintro-grid">
            <line x1="40" y1="125" x2="960" y2="125" />
            <line x1="20" y1="225" x2="980" y2="225" />
            <line x1="40" y1="325" x2="960" y2="325" />
            <line x1="200" y1="45" x2="200" y2="405" />
            <line x1="500" y1="45" x2="500" y2="405" />
            <line x1="800" y1="45" x2="800" y2="405" />
          </g>

          <g className="vintro-islands">
            {ISLANDS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>

          <g className="vintro-arcs">
            {ARC_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>

          <g className="vintro-pins">
            {PINS.map((p, i) => (
              <g key={p.id} transform={`translate(${p.x}, ${p.y})`} style={{ "--i": i } as React.CSSProperties}>
                <circle r="3" className="vintro-pin-anchor" />
                <g className="vintro-pin-body">
                  <use href="#vintroPin" transform={`scale(${p.scale})`} />
                </g>
              </g>
            ))}
          </g>
        </svg>

        <p className="vintro-map-caption">Memverifikasi ICARD anda...</p>
      </div>

      <button type="button" className="vintro-skip no-print" onClick={skip}>
        Lewati animasi
      </button>
    </div>
  );
}

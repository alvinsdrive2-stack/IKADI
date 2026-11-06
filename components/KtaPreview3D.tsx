"use client";

/**
 * Pratinjau kartu KTA 3D (three.js) untuk halaman cetak admin.
 *
 * Tekstur depan digambar di canvas 2D memakai koordinat yang SAMA dengan
 * `lib/kta-layout.ts` (sumber yang dipakai `KtaCardView`), jadi hasil 3D
 * identik dengan kartu yang dicetak — bukan artwork mentah.
 * Sisi belakang = artwork `kta ikadi belakang.png`.
 *
 * Urutan sengaja: SEMUA tekstur dibangun dulu, baru mesh dibuat. Kalau mesh
 * dibuat lebih dulu dengan material warna solid, lalu tekstur gagal dipasang,
 * kartu tampil hitam.
 *
 * Interaksi: drag untuk memutar. `touch-action: pan-y` supaya scroll ponsel
 * tidak terjebak. Tanpa animasi otomatis saat `prefers-reduced-motion`.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RotateCcw } from "lucide-react";
import { KTA_LAYOUT, type KtaBox } from "@/lib/kta-layout";
import type { KtaCardData } from "@/components/KtaCardView";

const CARD_ASPECT = 1050 / 600;
const TEX_W = 1050;
const TEX_H = 600;
const FONT_STACK = '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Gambar `img` memenuhi kotak x/y/w/h tanpa distorsi (crop tengah). */
function drawCoverIn(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

const px = (pct: number, total: number) => (pct / 100) * total;

function levelWilayah(d: KtaCardData): string {
  return [d.levelLabel, d.provinceName, d.regencyName].filter(Boolean).join(" | ");
}

/** Kanvas tekstur sisi depan: artwork + semua slot kartu. */
async function buildFrontCanvas(data: KtaCardData, compactName: (s: string) => string) {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const L = KTA_LAYOUT;

  const [art, photo, qr] = await Promise.all([
    loadImage("/kta ikadi muka.png"),
    data.photoPath ? loadImage(data.photoPath.startsWith("/") ? data.photoPath : `/${data.photoPath}`) : Promise.resolve(null),
    data.qrPng ? loadImage(data.qrPng) : Promise.resolve(null),
  ]);

  if (art) drawCoverIn(ctx, art, 0, 0, TEX_W, TEX_H);

  // Pas foto (rasio 13:17, sama seperti kartu DOM)
  if (photo) {
    const x = px(L.photo.x, TEX_W);
    const y = px(L.photo.y, TEX_H);
    const w = px(L.photo.w, TEX_W);
    const h = (w * 17) / 13;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    drawCoverIn(ctx, photo, x, y, w, h);
    ctx.restore();
  }

  const text = (b: KtaBox, value: string, weight: number, opts?: { alpha?: number; mono?: boolean }) => {
    const size = px(b.size, TEX_W);
    ctx.save();
    ctx.globalAlpha = opts?.alpha ?? 1;
    ctx.fillStyle = "#ffffff";
    ctx.font = `${weight} ${size}px ${opts?.mono ? 'ui-monospace, "SFMono-Regular", Menlo, monospace' : FONT_STACK}`;
    ctx.textAlign = b.align === "center" ? "center" : "left";
    ctx.textBaseline = "top";
    ctx.fillText(value, px(b.x, TEX_W), px(b.y, TEX_H));
    ctx.restore();
  };

  text(L.fullName, compactName(data.fullName), 700);
  text(L.levelLabel, levelWilayah(data), 400, { alpha: 0.9 });
  text(L.memberNumber, data.memberNumber, 800, { mono: true });
  text(L.noteAuth, data.note?.trim() || "Terbit dan berlaku selama terdaftar sebagai anggota IKADI.", 400, {
    alpha: 0.85,
  });

  // QR + nama pejabat di dua blok tanda tangan.
  for (const [qrKey, sigKey, pejabat] of [
    ["qrSekjen", "sekjen", data.pejabat.sekjen],
    ["qrKetum", "ketum", data.pejabat.ketuaUmum],
  ] as const) {
    const qb = L[qrKey];
    const qx = px(qb.x, TEX_W);
    const qy = px(qb.y, TEX_H);
    const qw = px(qb.w, TEX_W);

    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(qx, qy, qw, qw, qw * 0.12);
    else ctx.rect(qx, qy, qw, qw);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    if (qr) ctx.drawImage(qr, qx, qy, qw, qw);
    ctx.restore();

    const sb = L[sigKey];
    const sx = px(sb.x, TEX_W);
    const sy = px(sb.y, TEX_H);
    const sSize = px(sb.size, TEX_W);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.8;
    ctx.font = `500 ${sSize * 0.8}px ${FONT_STACK}`;
    ctx.fillText(pejabat.jabatan.toUpperCase(), sx, sy);
    ctx.globalAlpha = 1;
    ctx.font = `600 ${sSize}px ${FONT_STACK}`;
    ctx.fillText(pejabat.nama, sx, sy + sSize * 1.05);
    ctx.restore();
  }

  return canvas;
}

/** Kanvas tekstur sisi belakang: artwork apa adanya. */
async function buildBackCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext("2d");
  const art = await loadImage("/kta ikadi belakang.png");
  if (ctx && art) drawCoverIn(ctx, art, 0, 0, TEX_W, TEX_H);
  return canvas;
}

export function KtaPreview3D({
  data,
  compactName,
}: {
  data: KtaCardData;
  compactName: (s: string) => string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported">("loading");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let raf = 0;
    const cleanups: (() => void)[] = [];

    void (async () => {
      const [frontCanvas, backCanvas] = await Promise.all([
        buildFrontCanvas(data, compactName),
        buildBackCanvas(),
      ]);
      if (disposed) return;

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        setStatus("unsupported");
        return;
      }

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const width = mount.clientWidth || 560;
      const height = Math.round(width / CARD_ASPECT) + 48;

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "auto";
      renderer.domElement.style.display = "block";
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
      camera.position.set(0, 0, 4.1);

      const frontTex = new THREE.CanvasTexture(frontCanvas);
      frontTex.colorSpace = THREE.SRGBColorSpace;
      frontTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const backTex = new THREE.CanvasTexture(backCanvas);
      backTex.colorSpace = THREE.SRGBColorSpace;
      backTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const edge = new THREE.MeshBasicMaterial({ color: 0x0b3d20 });
      const front = new THREE.MeshBasicMaterial({ map: frontTex });
      const back = new THREE.MeshBasicMaterial({ map: backTex });

      const W = 3;
      const H = W / CARD_ASPECT;
      const geometry = new THREE.PlaneGeometry(W, H);
      // PlaneGeometry groups: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z (depan), 5 -z (belakang)
      const card = new THREE.Mesh(geometry, [edge, edge, edge, edge, front, back]);

      const group = new THREE.Group();
      group.rotation.y = -0.22;
      group.rotation.x = 0.06;
      group.add(card);
      scene.add(group);

      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let rotX = 0.06;
      let rotY = -0.22;
      let targetX = rotX;
      let targetY = rotY;

      const el = renderer.domElement;
      const onDown = (e: PointerEvent) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        el.setPointerCapture(e.pointerId);
        el.style.cursor = "grabbing";
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        targetY += (e.clientX - lastX) * 0.008;
        targetX = Math.max(-0.5, Math.min(0.5, targetX + (e.clientY - lastY) * 0.005));
        lastX = e.clientX;
        lastY = e.clientY;
      };
      const onUp = () => {
        dragging = false;
        el.style.cursor = "grab";
      };

      el.style.cursor = "grab";
      el.style.touchAction = "pan-y";
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
      cleanups.push(() => {
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
      });

      const tick = () => {
        raf = requestAnimationFrame(tick);
        const ease = reduceMotion ? 1 : 0.14;
        rotY += (targetY - rotY) * ease;
        rotX += (targetX - rotX) * ease;
        group.rotation.y = rotY;
        group.rotation.x = rotX;
        renderer!.render(scene, camera);
      };
      tick();

      resetRef.current = () => {
        targetY = Math.round(targetY / (Math.PI * 2)) * Math.PI * 2 - 0.22;
        targetX = 0.06;
      };

      const ro = new ResizeObserver(() => {
        const w = mount.clientWidth || width;
        const h = Math.round(w / CARD_ASPECT) + 48;
        renderer!.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      ro.observe(mount);
      cleanups.push(() => ro.disconnect());

      cleanups.push(() => {
        frontTex.dispose();
        backTex.dispose();
        geometry.dispose();
        edge.dispose();
        front.dispose();
        back.dispose();
        renderer!.dispose();
        el.remove();
      });

      setStatus("ready");
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
    };
  }, [data, compactName]);

  if (status === "unsupported") {
    return (
      <p className="rounded-lg border border-border bg-bg p-4 text-sm text-ink-muted">
        Browser ini tidak mendukung WebGL, jadi pratinjau 3D tidak bisa ditampilkan. Kartu di bawah tetap bisa dicetak.
      </p>
    );
  }

  return (
    <div className="kta-screen-only">
      <div className="flex items-center justify-between gap-3 pb-2">
        <p className="text-xs text-ink-muted">
          {status === "ready" ? "Tarik kartu untuk memutar" : "Menyiapkan pratinjau 3D…"}
        </p>
        <button
          type="button"
          onClick={() => resetRef.current()}
          className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-muted transition-colors hover:bg-bg hover:text-ink"
        >
          <RotateCcw aria-hidden className="size-3.5" /> Reset sudut
        </button>
      </div>
      <div
        ref={mountRef}
        role="img"
        aria-label={`Pratinjau 3D kartu tanda anggota ${data.fullName}`}
        className="min-h-40 overflow-hidden rounded-xl bg-cam"
      />
    </div>
  );
}

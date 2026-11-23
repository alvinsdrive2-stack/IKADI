"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { cn } from "@/lib/utils";

/**
 * Animasi masuk untuk satu bagian halaman.
 *
 * Dipakai di dashboard supaya perpindahan antar menu tidak terasa seperti
 * halaman yang langsung "jadi" tanpa jeda. Geraknya sengaja kecil (10px, 420ms)
 * dan hanya menyentuh transform + opacity: tata letak tidak bergeser, jadi data
 * yang dibaca tidak melompat di tengah animasi.
 *
 * Konten selalu tampil kalau JS belum jalan atau pengguna memilih
 * `prefers-reduced-motion` — animasi hanya hiasan, bukan syarat terlihat.
 */
export function Enter({
  children,
  className,
  delay = 0,
  y = 10,
  duration = 420,
  staggerChildren = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  duration?: number;
  /** Jarak antar anak (ms). 0 = animasikan wadahnya saja. */
  staggerChildren?: number;
  as?: "div" | "section";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets: HTMLElement[] =
      staggerChildren > 0 ? (Array.from(el.children) as HTMLElement[]) : [el];
    if (targets.length === 0) return;

    const anim = animate(targets, {
      y: [y, 0],
      opacity: [0, 1],
      duration,
      delay: stagger(staggerChildren || 0, { start: delay }),
      ease: "outQuart",
    });

    return () => {
      // `cancel()` menghentikan timer tanpa mengembalikan nilai ke keadaan awal;
      // gaya inline dibersihkan manual supaya tidak ada sisa opacity 0 kalau
      // komponen unmount di tengah animasi.
      anim.cancel();
      for (const t of targets) {
        t.style.removeProperty("transform");
        t.style.removeProperty("opacity");
      }
    };
  }, [delay, duration, staggerChildren, y]);

  return (
    <Tag ref={ref as React.Ref<HTMLDivElement>} className={cn(className)}>
      {children}
    </Tag>
  );
}

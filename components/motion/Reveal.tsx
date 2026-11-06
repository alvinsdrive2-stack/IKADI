"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { cn } from "@/lib/utils";

/**
 * Reveal on scroll pakai anime.js.
 * Hanya menganimasikan transform (bukan opacity) supaya konten selalu
 * terbaca meski observer belum jalan / JS telat. Hormati reduced-motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 16,
  staggerChildren = 0,
  duration = 620,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  staggerChildren?: number;
  duration?: number;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const targets: HTMLElement[] = staggerChildren > 0 ? (Array.from(el.children) as HTMLElement[]) : [el];
    if (targets.length === 0) return;

    let played = false;
    const play = () => {
      if (played) return;
      played = true;
      animate(targets, {
        y: [y, 0],
        duration,
        delay: stagger(staggerChildren || 0, { start: delay }),
        ease: "outQuart",
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          play();
          if (once) io.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -4% 0px" },
    );
    io.observe(el);

    return () => {
      io.disconnect();
    };
  }, [delay, duration, once, staggerChildren, y]);

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}

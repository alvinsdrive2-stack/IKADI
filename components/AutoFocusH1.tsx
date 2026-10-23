"use client";

import { useEffect, useRef } from "react";

/** H1 halaman konfirmasi difokus saat mount (DESIGN.md 4.3). */
export function AutoFocusH1({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h1 ref={ref} tabIndex={-1} className={className}>
      {children}
    </h1>
  );
}

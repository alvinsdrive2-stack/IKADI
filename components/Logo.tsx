import Image from "next/image";
import Link from "next/link";

export function LogoMark({
  size = 40,
  priority = false,
  className = "",
}: {
  size?: number;
  priority?: boolean;
  className?: string;
}) {
  // object-contain: rasio asli logo tidak dipaksa 1:1 (tidak gepeng).
  return (
    <Image
      src="/logo.png"
      alt="Logo IKADI"
      width={size}
      height={size}
      priority={priority}
      style={{ width: size, height: size }}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

export function Logo({
  href = "/",
  onDark = false,
}: {
  href?: string;
  onDark?: boolean;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 no-underline">
      <LogoMark priority />
      <span
        className={`text-base font-semibold ${onDark ? "text-white" : "text-primary-ink"}`}
      >
        Pendataan KTA IKADI
      </span>
    </Link>
  );
}

import Image from "next/image";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils";

/** Shell yang sama dengan halaman publik: header/footer identik, form di tengah. */
export function AuthShell({
  children,
  wide = false,
  image = "/ornaments/1.svg",
}: {
  children: React.ReactNode;
  wide?: boolean;
  image?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main id="main" className="relative flex flex-1 flex-col">
        {/* Background image penuh */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src={image}
            alt=""
            fill
            priority
            unoptimized={image.endsWith(".svg")}
            sizes="100vw"
            className="object-cover"
          />
        </div>

        <div className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
          <div
            className={cn(
              "w-full rounded-xl border border-border bg-white shadow-card",
              wide ? "max-w-3xl p-5 sm:p-8" : "max-w-[420px] p-6 sm:p-8",
            )}
          >
            <Reveal y={8}>{children}</Reveal>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

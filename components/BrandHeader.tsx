import Image from "next/image";
import Link from "next/link";

export function BrandHeader({ admin = false }: { admin?: boolean }) {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/brand/logo-rp.webp" alt="Poleas RP" width={42} height={42} className="h-11 w-auto" priority />
          <div>
            <p className="text-sm font-black uppercase text-rp-orange">Poleas RP</p>
            <p className="text-xs font-bold uppercase text-zinc-500">Transmisión de potencia</p>
          </div>
        </Link>
        {admin && (
          <Link
            href="/"
            className="border border-zinc-300 px-3 py-2 text-sm font-bold text-rp-graphite transition hover:border-rp-orange hover:text-rp-orange"
          >
            Encuesta
          </Link>
        )}
      </div>
    </header>
  );
}

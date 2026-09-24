"use client";

import { BarChart3, ClipboardList, Download, LogOut, Table2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/staff-rp/login");
    router.refresh();
  }

  const exportHref = `/api/export${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  return (
    <div className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/staff-rp/respuestas"
          className={`flex items-center gap-2 border px-3 py-2 text-sm font-black uppercase ${
            pathname.includes("/respuestas") ? "border-rp-orange text-rp-orange" : "border-zinc-300"
          }`}
        >
          <Table2 size={16} /> Respuestas
        </Link>
        <Link
          href="/staff-rp/analisis"
          className={`flex items-center gap-2 border px-3 py-2 text-sm font-black uppercase ${
            pathname.includes("/analisis") ? "border-rp-orange text-rp-orange" : "border-zinc-300"
          }`}
        >
          <BarChart3 size={16} /> Analisis
        </Link>
        <Link href="/staff-rp/plan-de-accion" className={`flex items-center gap-2 border px-3 py-2 text-sm font-black uppercase ${pathname.includes("/plan-de-accion") ? "border-rp-orange text-rp-orange" : "border-zinc-300"}`}>
          <ClipboardList size={16} /> Plan de acción
        </Link>
        <a
          href={exportHref}
          className="ml-auto flex items-center gap-2 border border-zinc-300 px-3 py-2 text-sm font-black uppercase hover:border-rp-orange hover:text-rp-orange"
        >
          <Download size={16} /> CSV
        </a>
        <button
          onClick={logout}
          className="flex items-center gap-2 border border-zinc-300 px-3 py-2 text-sm font-black uppercase hover:border-rp-orange hover:text-rp-orange"
        >
          <LogOut size={16} /> Salir
        </button>
      </div>
    </div>
  );
}

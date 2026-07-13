"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/cliente/fondo", label: "Resumen", exact: true },
  { href: "/cliente/fondo/historial", label: "Historial" },
  { href: "/cliente/fondo/movimientos", label: "Movimientos" },
];

/** Sub-navegación del fondo (pills): así el fondo ocupa un solo slot del menú. */
export function FondoTabs() {
  const pathname = usePathname();
  return (
    <div className="inline-flex rounded-lg bg-brand-cream-200/70 p-1">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

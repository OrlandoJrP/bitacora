"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  FileText,
  Home,
  LineChart,
  PieChart,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Variante del portal según lo que tenga el cliente:
 *  - individual: solo cuenta individual (los 4 tabs de siempre — default).
 *  - ambos: cuenta individual + socio de fondo (5 tabs).
 *  - fondo: solo socio de fondo (4 tabs orientados al fondo). */
export type VarianteNav = "individual" | "ambos" | "fondo";

type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const ITEMS_INDIVIDUAL: Item[] = [
  { href: "/cliente", label: "Resumen", icon: Home, exact: true },
  { href: "/cliente/historial", label: "Historial", icon: LineChart },
  { href: "/cliente/reportes", label: "Reportes", icon: FileText },
  { href: "/cliente/cuenta", label: "Mi cuenta", icon: UserCog },
];

const ITEMS_AMBOS: Item[] = [
  { href: "/cliente", label: "Resumen", icon: Home, exact: true },
  { href: "/cliente/historial", label: "Historial", icon: LineChart },
  { href: "/cliente/fondo", label: "Fondo", icon: PieChart },
  { href: "/cliente/reportes", label: "Reportes", icon: FileText },
  { href: "/cliente/cuenta", label: "Cuenta", icon: UserCog },
];

const ITEMS_FONDO: Item[] = [
  { href: "/cliente/fondo", label: "Fondo", icon: PieChart, exact: true },
  { href: "/cliente/fondo/historial", label: "Historial", icon: LineChart },
  { href: "/cliente/fondo/movimientos", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/cliente/cuenta", label: "Mi cuenta", icon: UserCog },
];

function itemsDe(variante: VarianteNav): Item[] {
  if (variante === "ambos") return ITEMS_AMBOS;
  if (variante === "fondo") return ITEMS_FONDO;
  return ITEMS_INDIVIDUAL;
}

function isActive(pathname: string, item: Item) {
  if (item.exact) return pathname === item.href;
  return pathname.startsWith(item.href);
}

export function ClienteNavDesktop({ variante = "individual" }: { variante?: VarianteNav }) {
  const pathname = usePathname();
  const items = itemsDe(variante);
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item) ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive(pathname, item)
              ? "bg-brand-navy text-brand-cream"
              : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function ClienteNavMobile({ variante = "individual" }: { variante?: VarianteNav }) {
  const pathname = usePathname();
  const items = itemsDe(variante);
  return (
    <nav
      className={cn(
        "safe-bottom fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-card/95 backdrop-blur md:hidden",
        items.length === 5 ? "grid-cols-5" : "grid-cols-4",
      )}
    >
      {items.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              active ? "text-brand-gold-600" : "text-muted-foreground",
            )}
          >
            <Icon className={cn("h-5 w-5", active && "text-brand-gold-600")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

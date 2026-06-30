"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LineChart, FileText, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/cliente", label: "Resumen", icon: Home },
  { href: "/cliente/historial", label: "Historial", icon: LineChart },
  { href: "/cliente/reportes", label: "Reportes", icon: FileText },
  { href: "/cliente/cuenta", label: "Mi cuenta", icon: UserCog },
];

function isActive(pathname: string, href: string) {
  if (href === "/cliente") return pathname === "/cliente";
  return pathname.startsWith(href);
}

export function ClienteNavDesktop() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {ITEMS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive(pathname, href)
              ? "bg-brand-navy text-brand-cream"
              : "text-muted-foreground hover:bg-accent/10 hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function ClienteNavMobile() {
  const pathname = usePathname();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card/95 backdrop-blur md:hidden">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              active ? "text-brand-gold-600" : "text-muted-foreground",
            )}
          >
            <Icon className={cn("h-5 w-5", active && "text-brand-gold-600")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

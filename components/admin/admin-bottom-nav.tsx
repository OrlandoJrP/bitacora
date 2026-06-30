"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_BOTTOM, ADMIN_CTA, isActiveAdmin, type NavItem } from "./admin-nav-items";

/** Barra inferior (4 tabs + FAB central) para móvil/tablet (< md).
 *  Se oculta cuando el drawer está abierto para que no quede por encima de él. */
export function AdminBottomNav({ drawerOpen = false }: { drawerOpen?: boolean }) {
  const pathname = usePathname();
  const izquierda = ADMIN_BOTTOM.slice(0, 2);
  const derecha = ADMIN_BOTTOM.slice(2);

  if (drawerOpen) return null;

  return (
    <>
      {/* FAB: acción principal (cierre mensual), elevado sobre la barra */}
      <Link
        href={ADMIN_CTA.href}
        aria-label={ADMIN_CTA.label}
        aria-current={isActiveAdmin(pathname, ADMIN_CTA.href) ? "page" : undefined}
        className="fixed left-1/2 z-50 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-brand-gold text-brand-navy shadow-lg ring-4 ring-brand-navy transition-transform active:scale-95 md:hidden"
        style={{ bottom: "calc(1.75rem + env(safe-area-inset-bottom))" }}
      >
        <CalendarPlus className="h-6 w-6" />
      </Link>

      {/* Barra inferior */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-brand-navy/95 backdrop-blur md:hidden"
        aria-label="Navegación principal"
      >
        {izquierda.map((item) => (
          <Tab key={item.href} item={item} pathname={pathname} />
        ))}
        <span aria-hidden className="block" />
        {derecha.map((item) => (
          <Tab key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    </>
  );
}

function Tab({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActiveAdmin(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
        active ? "text-brand-gold" : "text-brand-cream/60",
      )}
    >
      <Icon className="h-5 w-5" />
      {item.label}
    </Link>
  );
}

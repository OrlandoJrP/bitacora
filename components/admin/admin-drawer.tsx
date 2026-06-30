"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { ADMIN_CTA, ADMIN_ITEMS, isActiveAdmin } from "./admin-nav-items";

export function AdminDrawer({
  open,
  onClose,
  nombreFondo,
}: {
  open: boolean;
  onClose: () => void;
  nombreFondo: string;
}) {
  const pathname = usePathname();

  // Bloquea el scroll del fondo y cierra con Escape mientras el drawer está abierto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div
      className={cn("fixed inset-0 z-50 md:hidden", open ? "" : "pointer-events-none")}
      aria-hidden={!open}
    >
      {/* Overlay oscuro */}
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/60 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Panel deslizante */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className={cn(
          "safe-top absolute left-0 top-0 flex h-full w-72 max-w-[80vw] flex-col border-r border-white/10 bg-brand-navy shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <Logo size={30} withWordmark nombre={nombreFondo} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-brand-cream/80 transition-colors hover:bg-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {ADMIN_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActiveAdmin(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-gold text-brand-navy"
                    : "text-brand-cream/70 hover:bg-white/5 hover:text-brand-cream",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="safe-bottom shrink-0 border-t border-white/10 p-3">
          <Link
            href={ADMIN_CTA.href}
            onClick={onClose}
            className="flex items-center justify-center gap-2 rounded-md bg-brand-gold px-4 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-gold-600"
          >
            <CalendarCheck className="h-4 w-4" />
            {ADMIN_CTA.label}
          </Link>
        </div>
      </div>
    </div>
  );
}

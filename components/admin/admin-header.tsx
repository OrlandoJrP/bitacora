"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { UserMenu } from "@/components/user-menu";
import { AdminDrawer } from "./admin-drawer";

export function AdminHeader({
  email,
  nombreFondo,
}: {
  email: string;
  nombreFondo: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="safe-top sticky top-0 z-30 border-b border-white/10 bg-brand-navy/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          {/* Móvil: hamburguesa + marca */}
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
              aria-haspopup="dialog"
              aria-expanded={open}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-brand-cream transition-colors hover:bg-white/5"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Logo size={28} />
            <span className="truncate font-serif text-lg font-semibold">Bitácora</span>
          </div>

          {/* Escritorio: etiqueta */}
          <div className="hidden text-sm text-brand-cream/60 md:block">Panel del operador</div>

          <UserMenu email={email} rol="Operador" />
        </div>
      </header>

      <AdminDrawer open={open} onClose={() => setOpen(false)} nombreFondo={nombreFondo} />
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

/**
 * Sugerencia, solo en iPhone/iPad con Safari y fuera de modo "app instalada",
 * para añadir Bitácora a la pantalla de inicio. Se descarta una sola vez.
 */
export function IosInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const ua = window.navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(ua);
      const isSafari = /safari/.test(ua) && !/(crios|fxios|edgios)/.test(ua);
      const nav = window.navigator as Navigator & { standalone?: boolean };
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
      const dismissed = localStorage.getItem("ios-install-dismissed") === "1";
      if (isIOS && isSafari && !standalone && !dismissed) setShow(true);
    } catch {
      /* sin acceso a APIs del navegador */
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem("ios-install-dismissed", "1");
    } catch {
      /* noop */
    }
    setShow(false);
  }

  return (
    <div
      className="fixed inset-x-3 z-40 md:hidden"
      style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-3 rounded-xl border border-brand-gold/40 bg-card p-3 shadow-lg">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-gold/15 text-brand-gold-600">
          <Share className="h-5 w-5" />
        </span>
        <p className="flex-1 text-xs leading-snug">
          Instala Bitácora en tu iPhone: toca <strong>Compartir</strong> y luego{" "}
          <strong>“Añadir a inicio”</strong>.
        </p>
        <button
          onClick={dismiss}
          aria-label="Cerrar"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

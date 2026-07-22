import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { configuracion, type Configuracion } from "@/drizzle/schema";
import type { LedgerConfig } from "@/lib/finance/ledger";
import { num } from "@/lib/finance/ledger";

const DEFAULTS: Omit<Configuracion, "createdAt" | "updatedAt"> = {
  id: 1,
  comisionPct: "35.000",
  usaHighWaterMark: false,
  pierdeSoloCliente: true,
  nombreFondo: "Brújula Markets",
  moneda: "USD",
};

/** Lee la configuración singleton (id=1). No está bajo RLS. */
export async function getConfig(): Promise<Configuracion> {
  const [c] = await db.select().from(configuracion).where(eq(configuracion.id, 1)).limit(1);
  return c ?? (DEFAULTS as Configuracion);
}

/** Convierte la configuración de BD al shape que consume el motor financiero. */
export function toLedgerConfig(c: Configuracion): LedgerConfig {
  return {
    comisionPct: num(c.comisionPct),
    usaHighWaterMark: c.usaHighWaterMark,
    pierdeSoloCliente: c.pierdeSoloCliente,
    politica: c.usaHighWaterMark ? "hwm_saldo" : "normal",
  };
}

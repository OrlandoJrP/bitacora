import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { sql as drizzleSql } from "drizzle-orm";
import type { Session } from "next-auth";
import { withFondoTenant, withTenant } from "@/lib/db";
import { requireCliente, tenantCtx } from "./session";

export interface ContextoPortal {
  session: Session;
  clienteId: string;
  esSocio: boolean;
  fondoId: string | null;
  socioId: string | null;
  /** Tiene actividad en la modalidad individual (capital, movimientos o cierres). */
  tieneIndividual: boolean;
}

/**
 * Resuelve, por lookup en servidor (sin tocar el JWT), si el cliente en sesión
 * es socio de un fondo compartido y si además tiene cuenta individual activa.
 * Decide la variante de navegación del portal: individual / ambos / solo-fondo.
 * Envuelta en React cache(): layout y página comparten UNA sola ejecución por
 * request (evita duplicar transacciones en el camino caliente del portal).
 */
export const contextoPortal = cache(async (): Promise<ContextoPortal> => {
  const { session, clienteId } = await requireCliente();
  const ctx = tenantCtx(session);

  const socio = await withFondoTenant(ctx, async (tx, fondoId) => {
    if (!fondoId) return null;
    const filas = (await tx.execute(
      drizzleSql`select id from fondo_socios where cliente_id = ${clienteId} limit 1`,
    )) as unknown as Array<{ id: string }>;
    return filas[0] ? { fondoId, socioId: filas[0].id } : null;
  });

  // ¿Tiene modalidad individual? Capital inicial > 0, o algún movimiento, o
  // algún cierre mensual. (Los socios-solo-fondo se crean con capital 0.)
  const tieneIndividual = await withTenant(ctx, async (tx) => {
    const filas = (await tx.execute(drizzleSql`
      select
        exists(select 1 from clientes where id = ${clienteId} and capital_inicial <> 0) as cap,
        exists(select 1 from movimientos where cliente_id = ${clienteId}) as mov,
        exists(select 1 from rendimientos_mensuales where cliente_id = ${clienteId}) as rend
    `)) as unknown as Array<{ cap: boolean; mov: boolean; rend: boolean }>;
    const f = filas[0];
    return !!(f && (f.cap || f.mov || f.rend));
  });

  return {
    session,
    clienteId,
    esSocio: !!socio,
    fondoId: socio?.fondoId ?? null,
    socioId: socio?.socioId ?? null,
    tieneIndividual,
  };
});

/** Exige que el cliente en sesión sea socio de un fondo. */
export async function requireSocio(): Promise<ContextoPortal & { fondoId: string }> {
  const ctx = await contextoPortal();
  if (!ctx.esSocio || !ctx.fondoId) redirect("/cliente");
  return ctx as ContextoPortal & { fondoId: string };
}

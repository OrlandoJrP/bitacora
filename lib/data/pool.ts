import "server-only";
import { asc, eq } from "drizzle-orm";
import { withFondoTenant, type TenantCtx } from "@/lib/db";
import {
  fondos,
  fondoSocios,
  fondoMovimientos,
  fondoRendimientos,
  fondoOverrides,
  type Fondo,
  type FondoSocio,
  type FondoMovimiento,
  type FondoRendimiento,
  type FondoOverride,
} from "@/drizzle/schema";
import {
  construirCadenaPool,
  resumenPool,
  type MesPool,
  type PoolInput,
  type ResumenPool,
} from "@/lib/finance/pool";
import { num } from "@/lib/finance/ledger";
import { mesActual } from "@/lib/format";

export interface PoolLedger {
  fondo: Fondo;
  socios: FondoSocio[];
  meses: MesPool[];
  resumen: ResumenPool;
  movimientos: FondoMovimiento[];
  rendimientos: FondoRendimiento[];
  overrides: FondoOverride[];
  /** Entrada exacta que consumió el motor (útil para previews en cliente). */
  input: PoolInput;
}

function armarInput(
  fondo: Fondo,
  socios: FondoSocio[],
  movs: FondoMovimiento[],
  rends: FondoRendimiento[],
  ovrs: FondoOverride[],
): PoolInput {
  return {
    fechaInicio: fondo.fechaInicio,
    hasta: mesActual(),
    socios: socios.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      capitalInicial: s.capitalInicial,
      fechaAlta: s.fechaAlta,
      estado: s.estado,
    })),
    movimientos: movs.map((m) => ({
      socioId: m.socioId,
      tipo: m.tipo,
      monto: m.monto,
      fecha: m.fecha,
      transferenciaId: m.transferenciaId,
      descripcion: m.descripcion,
    })),
    rendimientos: rends.map((r) => ({
      anio: r.anio,
      mes: r.mes,
      modo: r.modo,
      valor: r.valor,
      enCurso: r.enCurso,
      tasaTwr: r.tasaTwr,
      descripcion: r.descripcion,
    })),
    overrides: ovrs.map((o) => ({
      socioId: o.socioId,
      anio: o.anio,
      mes: o.mes,
      saldoFinal: o.saldoFinal,
      motivo: o.motivo,
    })),
    config: {
      comisionPct: num(fondo.comisionPct),
      baseComision: fondo.baseComision,
    },
  };
}

function construir(
  fondo: Fondo,
  socios: FondoSocio[],
  movs: FondoMovimiento[],
  rends: FondoRendimiento[],
  ovrs: FondoOverride[],
): PoolLedger {
  const input = armarInput(fondo, socios, movs, rends, ovrs);
  const meses = construirCadenaPool(input);
  return {
    fondo,
    socios,
    meses,
    resumen: resumenPool(meses, input),
    movimientos: movs,
    rendimientos: rends,
    overrides: ovrs,
    input,
  };
}

/**
 * Carga el ledger completo de UN fondo. RLS (withFondoTenant) + scoping:
 * un socio solo puede cargar SU fondo (cualquier otro id devuelve null).
 */
export async function cargarPool(
  ctx: TenantCtx,
  fondoId: string,
): Promise<PoolLedger | null> {
  return withFondoTenant(ctx, async (tx, fondoDelSocio) => {
    // Scoping explícito además del RLS: cliente solo su propio fondo.
    if (ctx.role === "cliente" && fondoDelSocio !== fondoId) return null;

    const [fondo] = await tx.select().from(fondos).where(eq(fondos.id, fondoId)).limit(1);
    if (!fondo) return null;

    const socios = await tx
      .select()
      .from(fondoSocios)
      .where(eq(fondoSocios.fondoId, fondoId))
      .orderBy(asc(fondoSocios.fechaAlta), asc(fondoSocios.id));

    const movs = await tx
      .select()
      .from(fondoMovimientos)
      .where(eq(fondoMovimientos.fondoId, fondoId))
      .orderBy(asc(fondoMovimientos.fecha), asc(fondoMovimientos.createdAt));

    const rends = await tx
      .select()
      .from(fondoRendimientos)
      .where(eq(fondoRendimientos.fondoId, fondoId))
      .orderBy(asc(fondoRendimientos.anio), asc(fondoRendimientos.mes));

    const ovrs = await tx
      .select()
      .from(fondoOverrides)
      .where(eq(fondoOverrides.fondoId, fondoId))
      .orderBy(asc(fondoOverrides.anio), asc(fondoOverrides.mes));

    return construir(fondo, socios, movs, rends, ovrs);
  });
}

/** El fondo del socio en sesión (o null si no es socio). */
export async function cargarPoolDelSocio(ctx: TenantCtx): Promise<PoolLedger | null> {
  const fondoId = await withFondoTenant(ctx, async (_tx, id) => id);
  if (!fondoId) return null;
  return cargarPool(ctx, fondoId);
}

/** Lista de fondos (admin). */
export async function listarFondos(ctx: TenantCtx): Promise<Fondo[]> {
  return withFondoTenant(ctx, async (tx) =>
    tx.select().from(fondos).orderBy(asc(fondos.createdAt)),
  );
}

/** Todos los ledgers (admin). */
export async function cargarPoolsTodos(ctx: TenantCtx): Promise<PoolLedger[]> {
  const lista = await listarFondos(ctx);
  const out: PoolLedger[] = [];
  for (const f of lista) {
    const l = await cargarPool(ctx, f.id);
    if (l) out.push(l);
  }
  return out;
}

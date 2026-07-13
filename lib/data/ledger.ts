import "server-only";
import { eq, asc } from "drizzle-orm";
import { db, withTenant, type TenantCtx } from "@/lib/db";
import {
  clientes,
  movimientos,
  rendimientosMensuales,
  type Cliente,
  type Movimiento,
  type RendimientoMensual,
} from "@/drizzle/schema";
import {
  construirCadena,
  resumen,
  resumenPorAnio,
  type MesLedger,
  type ResumenLedger,
  type ResumenAnual,
} from "@/lib/finance/ledger";
import { getConfig, toLedgerConfig } from "./config";
import { mesActual } from "@/lib/format";

export interface LedgerCliente {
  cliente: Cliente;
  meses: MesLedger[];
  resumen: ResumenLedger;
  porAnio: ResumenAnual[];
  movimientos: Movimiento[];
  rendimientos: RendimientoMensual[];
}

function construir(
  cliente: Cliente,
  movs: Movimiento[],
  rends: RendimientoMensual[],
  cfg: ReturnType<typeof toLedgerConfig>,
): LedgerCliente {
  const hasta = mesActual();
  const meses = construirCadena({
    capitalInicial: cliente.capitalInicial,
    fechaIngreso: cliente.fechaIngreso,
    hasta,
    config: cfg,
    rendimientos: rends.map((r) => ({
      anio: r.anio,
      mes: r.mes,
      modo: r.modo,
      valor: r.valor,
      descripcion: r.descripcion,
    })),
    movimientos: movs.map((m) => ({
      tipo: m.tipo,
      monto: m.monto,
      fecha: m.fecha,
      descripcion: m.descripcion,
    })),
  });
  return {
    cliente,
    meses,
    resumen: resumen(meses, cliente.capitalInicial, hasta.anio),
    porAnio: resumenPorAnio(meses),
    movimientos: movs,
    rendimientos: rends,
  };
}

/**
 * Carga el ledger completo de UN cliente. El acceso pasa por withTenant (RLS) y
 * por el filtro explícito por clienteId (scoping). Devuelve null si no existe o
 * si la sesión no tiene permiso (RLS lo oculta → fail-closed).
 */
export async function cargarLedgerCliente(
  ctx: TenantCtx,
  clienteId: string,
): Promise<LedgerCliente | null> {
  const cfg = toLedgerConfig(await getConfig());

  return withTenant(ctx, async (tx) => {
    const [cliente] = await tx
      .select()
      .from(clientes)
      .where(eq(clientes.id, clienteId))
      .limit(1);
    if (!cliente) return null;

    const movs = await tx
      .select()
      .from(movimientos)
      .where(eq(movimientos.clienteId, clienteId))
      .orderBy(asc(movimientos.fecha));

    const rends = await tx
      .select()
      .from(rendimientosMensuales)
      .where(eq(rendimientosMensuales.clienteId, clienteId))
      .orderBy(asc(rendimientosMensuales.anio), asc(rendimientosMensuales.mes));

    return construir(cliente, movs, rends, cfg);
  });
}

/**
 * Carga los ledgers de TODOS los clientes (solo admin). 3 queries en lote.
 */
export async function cargarLedgersTodos(ctx: TenantCtx): Promise<LedgerCliente[]> {
  const cfg = toLedgerConfig(await getConfig());

  return withTenant(ctx, async (tx) => {
    // Excluye los clientes "cascarón" (solo acceso de socios del fondo
    // compartido): no pertenecen a la modalidad individual.
    const todos = await tx
      .select()
      .from(clientes)
      .where(eq(clientes.esAccesoFondo, false))
      .orderBy(asc(clientes.nombre));
    const movs = await tx.select().from(movimientos).orderBy(asc(movimientos.fecha));
    const rends = await tx
      .select()
      .from(rendimientosMensuales)
      .orderBy(asc(rendimientosMensuales.anio), asc(rendimientosMensuales.mes));

    const movsPorCliente = new Map<string, Movimiento[]>();
    for (const m of movs) {
      const arr = movsPorCliente.get(m.clienteId) ?? [];
      arr.push(m);
      movsPorCliente.set(m.clienteId, arr);
    }
    const rendsPorCliente = new Map<string, RendimientoMensual[]>();
    for (const r of rends) {
      const arr = rendsPorCliente.get(r.clienteId) ?? [];
      arr.push(r);
      rendsPorCliente.set(r.clienteId, arr);
    }

    return todos.map((cliente) =>
      construir(
        cliente,
        movsPorCliente.get(cliente.id) ?? [],
        rendsPorCliente.get(cliente.id) ?? [],
        cfg,
      ),
    );
  });
}

/** Lista simple de clientes (para selects/tablas). */
export async function listarClientes(ctx: TenantCtx): Promise<Cliente[]> {
  return withTenant(ctx, async (tx) =>
    tx.select().from(clientes).orderBy(asc(clientes.nombre)),
  );
}

/** Métricas globales del fondo para el dashboard del operador. */
export interface MetricasFondo {
  aum: number; // Σ saldo_final último mes de clientes activos
  clientesActivos: number;
  clientesTotal: number;
  comisionMesActual: number;
  comisionAcumulada: number;
  resultadoNetoMesActual: number;
  ledgers: LedgerCliente[];
}

export async function metricasFondo(ctx: TenantCtx): Promise<MetricasFondo> {
  const ledgers = await cargarLedgersTodos(ctx);
  const { anio, mes } = mesActual();

  let aum = 0;
  let comisionAcumulada = 0;
  let comisionMesActual = 0;
  let resultadoNetoMesActual = 0;
  let clientesActivos = 0;

  for (const l of ledgers) {
    const activo = l.cliente.estado === "activo";
    if (activo) {
      clientesActivos += 1;
      aum += l.resumen.saldoActual;
    }
    comisionAcumulada += l.resumen.comisionOperador;
    const mesAct = l.meses.find((m) => m.anio === anio && m.mes === mes);
    if (mesAct) {
      comisionMesActual += mesAct.comision;
      resultadoNetoMesActual += mesAct.rendNeto;
    }
  }

  return {
    aum: Math.round(aum * 100) / 100,
    clientesActivos,
    clientesTotal: ledgers.length,
    comisionMesActual: Math.round(comisionMesActual * 100) / 100,
    comisionAcumulada: Math.round(comisionAcumulada * 100) / 100,
    resultadoNetoMesActual: Math.round(resultadoNetoMesActual * 100) / 100,
    ledgers,
  };
}

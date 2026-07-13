/**
 * lib/finance/pool.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MOTOR FINANCIERO DEL FONDO COMPARTIDO — única fuente de verdad del cálculo.
 *
 * Espejo de ledger.ts para la modalidad de cuenta conjunta: varios socios
 * comparten un fondo; el resultado mensual se registra A NIVEL DEL FONDO y se
 * reparte entre socios proporcional a su capital al inicio del mes (base
 * operativa), salvo `overrides` que fijan el saldo final de un socio en un mes
 * (fidelidad histórica: % negociados, exposición parcial de depósitos).
 *
 * Reglas de oro:
 * - Derive-on-read: solo insumos; los saldos se derivan al leer.
 * - El fondo SIEMPRE se computa como Σ de los socios (jamás en paralelo).
 * - round2 HALF_UP por mes; el residuo del prorrateo se asigna determinista.
 * - La comisión del operador es INFORMATIVA: jamás modifica saldos (los
 *   saldos de los socios son brutos). Solo se reporta cuánto le corresponde.
 * - TWR: compone `tasa_twr ?? (resultado/base)` por mes. `tasa_twr` existe
 *   para meses de exposición parcial (p. ej. un depósito de fin de mes que
 *   solo tomó parte de la pérdida: la tasa de gestión difiere de la contable).
 *   El DINERO usa siempre `resultado`; `tasa_twr` solo afecta la composición.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { monthKey, num, roiCompuesto, round2, type Modo } from "./ledger";

export interface SocioInput {
  id: string;
  nombre: string;
  capitalInicial: number | string; // su parte de la "semilla" del fondo
  fechaAlta: string | Date;
  estado: "activo" | "inactivo";
}

export interface MovimientoFondoInput {
  socioId: string;
  tipo: "deposito" | "retiro"; // deposito = aporte
  monto: number | string; // > 0
  fecha: string | Date;
  transferenciaId?: string | null;
  descripcion?: string | null;
}

export interface RendimientoFondoInput {
  anio: number;
  mes: number;
  modo: Modo; // porcentaje | monto | saldo_final (del FONDO)
  valor: number | string;
  enCurso?: boolean; // mes "flotante" (provisional)
  tasaTwr?: number | string | null; // tasa TWR del mes si difiere de resultado/base
  descripcion?: string | null;
}

export interface OverrideInput {
  socioId: string;
  anio: number;
  mes: number;
  saldoFinal: number | string;
  motivo?: string | null;
}

export interface PoolConfig {
  comisionPct: number; // informativa (35)
  baseComision: "ganancia_neta" | "meses_positivos";
}

export interface PoolInput {
  fechaInicio: string | Date;
  /** Socios en orden estable (fecha_alta asc, id asc): fija el determinismo
   *  del residuo de redondeo. El data layer garantiza este orden. */
  socios: SocioInput[];
  movimientos: MovimientoFondoInput[];
  rendimientos: RendimientoFondoInput[];
  overrides: OverrideInput[];
  hasta?: { anio: number; mes: number };
  config: PoolConfig;
}

export interface SocioMes {
  socioId: string;
  saldoInicial: number;
  aportes: number;
  retiros: number;
  baseOperativa: number; // saldoInicial + aportes − retiros
  participacion: number; // fracción base_i / baseFondo (0 si baseFondo = 0)
  resultado: number; // ganancia/pérdida del socio en el mes (bruta)
  saldoFinal: number;
  participacionFinal: number; // fracción saldoFinal_i / saldoFinalFondo
  origen: "proporcional" | "override" | "sin_capital";
  llevaResiduo: boolean;
}

export interface MesPool {
  anio: number;
  mes: number;
  key: string;
  saldoInicial: number;
  aportes: number;
  retiros: number;
  baseOperativa: number;
  modo: Modo | null;
  valor: number | null;
  resultado: number; // del FONDO (bruto; la comisión nunca se descuenta)
  saldoFinal: number;
  roiMes: number; // resultado / baseOperativa (contable)
  tasaTwr: number; // tasa para composición TWR (override o roiMes)
  enCurso: boolean;
  tieneRendimiento: boolean;
  gananciaAcumulada: number; // Σ resultados hasta este mes inclusive
  comisionAcumulada: number; // informativa, según config.baseComision
  comisionMes: number; // Δ vs. mes anterior (puede ser negativa en ganancia_neta)
  socios: SocioMes[];
  /** ≠ 0 SOLO si todos los socios con capital tienen override y Σ ≠ fondo. */
  descuadre: number;
  movimientos: MovimientoFondoInput[];
  descripcion: string | null;
}

/* ── Calendario (mismas convenciones que ledger.ts) ──────────────────────── */
type YM = { anio: number; mes: number };

function ymOf(fecha: string | Date): YM {
  if (fecha instanceof Date) {
    return { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1 };
  }
  const parts = String(fecha).split("-");
  return { anio: Number(parts[0]), mes: Number(parts[1] ?? "1") };
}

function nextMonth(ym: YM): YM {
  return ym.mes === 12 ? { anio: ym.anio + 1, mes: 1 } : { anio: ym.anio, mes: ym.mes + 1 };
}

function cmpYM(a: YM, b: YM): number {
  return a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes;
}

/* ── Reparto de un mes (exportada para test directo) ─────────────────────── */

export interface SocioBase {
  socioId: string;
  saldoInicial: number;
  aportes: number;
  retiros: number;
  baseOperativa: number;
}

export function repartirMes(
  bases: SocioBase[], // en orden estable
  saldoFinalFondo: number,
  resultadoFondo: number,
  overridesMes: Map<string, number>, // socioId → saldoFinal fijado
): { socios: SocioMes[]; descuadre: number } {
  const baseFondo = round2(bases.reduce((s, b) => s + b.baseOperativa, 0));

  const fijados = bases.filter((b) => overridesMes.has(b.socioId));
  const libres = bases.filter((b) => !overridesMes.has(b.socioId));

  const sumOverrides = round2(
    fijados.reduce((s, b) => s + (overridesMes.get(b.socioId) ?? 0), 0),
  );
  const restSaldo = round2(saldoFinalFondo - sumOverrides);
  const restBase = round2(libres.reduce((s, b) => s + b.baseOperativa, 0));
  const restResultado = round2(restSaldo - restBase);

  const out = new Map<string, SocioMes>();
  let descuadre = 0;

  for (const b of fijados) {
    const saldoFinal = round2(overridesMes.get(b.socioId)!);
    out.set(b.socioId, {
      socioId: b.socioId,
      saldoInicial: b.saldoInicial,
      aportes: b.aportes,
      retiros: b.retiros,
      baseOperativa: b.baseOperativa,
      participacion: baseFondo !== 0 ? b.baseOperativa / baseFondo : 0,
      resultado: round2(saldoFinal - b.baseOperativa),
      saldoFinal,
      participacionFinal: 0, // se completa al final
      origen: "override",
      llevaResiduo: false,
    });
  }

  if (libres.length === 0) {
    // Todos fijados: el motor NO corrige en silencio; expone el descuadre.
    descuadre = restSaldo;
  } else if (restBase === 0) {
    // Nadie libre tiene capital: no hay a quién asignar el resto.
    for (const b of libres) {
      out.set(b.socioId, {
        socioId: b.socioId,
        saldoInicial: b.saldoInicial,
        aportes: b.aportes,
        retiros: b.retiros,
        baseOperativa: b.baseOperativa,
        participacion: 0,
        resultado: 0,
        saldoFinal: b.baseOperativa,
        participacionFinal: 0,
        origen: "sin_capital",
        llevaResiduo: false,
      });
    }
    descuadre = restResultado;
  } else {
    // Prorrateo proporcional a la base operativa + residuo determinista.
    const parciales = libres.map((b) => ({
      b,
      resultado: round2((restResultado * b.baseOperativa) / restBase),
    }));
    const residuo = round2(restResultado - parciales.reduce((s, p) => s + p.resultado, 0));

    let receptor = -1;
    if (residuo !== 0) {
      let maxBase = -Infinity;
      parciales.forEach((p, i) => {
        if (p.b.baseOperativa > maxBase) {
          maxBase = p.b.baseOperativa;
          receptor = i;
        }
      });
    }

    parciales.forEach((p, i) => {
      const resultado = i === receptor ? round2(p.resultado + residuo) : p.resultado;
      out.set(p.b.socioId, {
        socioId: p.b.socioId,
        saldoInicial: p.b.saldoInicial,
        aportes: p.b.aportes,
        retiros: p.b.retiros,
        baseOperativa: p.b.baseOperativa,
        participacion: baseFondo !== 0 ? p.b.baseOperativa / baseFondo : 0,
        resultado,
        saldoFinal: round2(p.b.baseOperativa + resultado),
        participacionFinal: 0,
        origen: "proporcional",
        llevaResiduo: i === receptor,
      });
    });
  }

  // Orden de salida = orden de entrada (estable) + participación final.
  const socios = bases.map((b) => out.get(b.socioId)!);
  const totalFinal = round2(socios.reduce((s, x) => s + x.saldoFinal, 0));
  for (const s of socios) {
    s.participacionFinal = totalFinal !== 0 ? s.saldoFinal / totalFinal : 0;
  }
  return { socios, descuadre };
}

/* ── Cadena mensual del fondo ────────────────────────────────────────────── */

export function construirCadenaPool(input: PoolInput): MesPool[] {
  const start = ymOf(input.fechaInicio);
  const { comisionPct, baseComision } = input.config;

  const rendByKey = new Map<string, RendimientoFondoInput>();
  for (const r of input.rendimientos) rendByKey.set(monthKey(r.anio, r.mes), r);

  // Movimientos por mes; los anteriores al inicio se imputan al primer mes.
  const movByKey = new Map<string, MovimientoFondoInput[]>();
  for (const m of input.movimientos) {
    let ym = ymOf(m.fecha);
    if (cmpYM(ym, start) < 0) ym = start;
    const k = monthKey(ym.anio, ym.mes);
    const arr = movByKey.get(k) ?? [];
    arr.push(m);
    movByKey.set(k, arr);
  }

  // Overrides por mes → Map(socioId → saldoFinal).
  const ovrByKey = new Map<string, Map<string, number>>();
  for (const o of input.overrides) {
    const k = monthKey(o.anio, o.mes);
    const m = ovrByKey.get(k) ?? new Map<string, number>();
    m.set(o.socioId, round2(num(o.saldoFinal)));
    ovrByKey.set(k, m);
  }

  // La semilla (capitalInicial) de cada socio se inyecta en su MES DE ALTA
  // (recortado al inicio del fondo), no siempre en el primer mes: un socio que
  // entra después no debe reescribir la historia previa del fondo.
  const semillaKey = new Map<string, string>();
  for (const s of input.socios) {
    let ym = ymOf(s.fechaAlta);
    if (cmpYM(ym, start) < 0) ym = start;
    semillaKey.set(s.id, monthKey(ym.anio, ym.mes));
  }

  // Mes final de la serie.
  let end: YM = { ...start };
  for (const r of input.rendimientos) {
    const ym = { anio: r.anio, mes: r.mes };
    if (cmpYM(ym, end) > 0) end = ym;
  }
  for (const m of input.movimientos) {
    let ym = ymOf(m.fecha);
    if (cmpYM(ym, start) < 0) ym = start;
    if (cmpYM(ym, end) > 0) end = ym;
  }
  for (const s of input.socios) {
    let ym = ymOf(s.fechaAlta);
    if (cmpYM(ym, start) < 0) ym = start;
    if (cmpYM(ym, end) > 0) end = ym;
  }
  if (input.hasta && cmpYM(input.hasta, end) > 0) end = input.hasta;
  if (cmpYM(end, start) < 0) end = { ...start };

  // Saldos por socio (arrastre). Arrancan en 0; la semilla entra en su mes.
  const saldos = new Map<string, number>();
  for (const s of input.socios) saldos.set(s.id, 0);

  const meses: MesPool[] = [];
  let gananciaAcumulada = 0;
  let sumaPositivos = 0;
  let comisionPrev = 0;

  let cur: YM = { ...start };
  let safety = 0;
  while (cmpYM(cur, end) <= 0 && safety < 12_000) {
    safety++;
    const k = monthKey(cur.anio, cur.mes);
    const movs = movByKey.get(k) ?? [];

    // Bases por socio (orden estable = orden de input.socios).
    const bases: SocioBase[] = input.socios.map((s) => {
      const semilla = semillaKey.get(s.id) === k ? round2(num(s.capitalInicial)) : 0;
      const saldoInicial = round2((saldos.get(s.id) ?? 0) + semilla);
      const aportes = round2(
        movs
          .filter((m) => m.socioId === s.id && m.tipo === "deposito")
          .reduce((sum, m) => sum + num(m.monto), 0),
      );
      const retiros = round2(
        movs
          .filter((m) => m.socioId === s.id && m.tipo === "retiro")
          .reduce((sum, m) => sum + num(m.monto), 0),
      );
      return {
        socioId: s.id,
        saldoInicial,
        aportes,
        retiros,
        baseOperativa: round2(saldoInicial + aportes - retiros),
      };
    });

    const saldoInicialFondo = round2(bases.reduce((s, b) => s + b.saldoInicial, 0));
    const aportesFondo = round2(bases.reduce((s, b) => s + b.aportes, 0));
    const retirosFondo = round2(bases.reduce((s, b) => s + b.retiros, 0));
    const baseFondo = round2(bases.reduce((s, b) => s + b.baseOperativa, 0));

    // Resultado del fondo según modo.
    const r = rendByKey.get(k);
    let resultado = 0;
    let saldoFinalFondo = baseFondo;
    let modo: Modo | null = null;
    let valor: number | null = null;

    if (r) {
      modo = r.modo;
      valor = num(r.valor);
      if (r.modo === "porcentaje") {
        resultado = round2((baseFondo * valor) / 100);
        saldoFinalFondo = round2(baseFondo + resultado);
      } else if (r.modo === "monto") {
        resultado = round2(valor);
        saldoFinalFondo = round2(baseFondo + resultado);
      } else {
        saldoFinalFondo = round2(valor);
        resultado = round2(saldoFinalFondo - baseFondo);
      }
    }

    // Reparto entre socios.
    const { socios, descuadre } = repartirMes(
      bases,
      saldoFinalFondo,
      resultado,
      ovrByKey.get(k) ?? new Map(),
    );

    // Métricas del mes.
    const roiMes = baseFondo !== 0 ? resultado / baseFondo : 0;
    const tasaTwrOverride = r?.tasaTwr != null && r.tasaTwr !== "" ? num(r.tasaTwr) / 100 : null;
    const tasaTwr = tasaTwrOverride ?? roiMes;

    gananciaAcumulada = round2(gananciaAcumulada + resultado);
    if (resultado > 0) sumaPositivos = round2(sumaPositivos + resultado);
    const comisionAcumulada =
      baseComision === "meses_positivos"
        ? round2((sumaPositivos * comisionPct) / 100)
        : round2((Math.max(0, gananciaAcumulada) * comisionPct) / 100);
    const comisionMes = round2(comisionAcumulada - comisionPrev);
    comisionPrev = comisionAcumulada;

    meses.push({
      anio: cur.anio,
      mes: cur.mes,
      key: k,
      saldoInicial: saldoInicialFondo,
      aportes: aportesFondo,
      retiros: retirosFondo,
      baseOperativa: baseFondo,
      modo,
      valor,
      resultado,
      saldoFinal: round2(socios.reduce((s, x) => s + x.saldoFinal, 0)),
      roiMes,
      tasaTwr,
      enCurso: r?.enCurso === true,
      tieneRendimiento: !!r,
      gananciaAcumulada,
      comisionAcumulada,
      comisionMes,
      socios,
      descuadre,
      movimientos: movs,
      descripcion: r?.descripcion ?? null,
    });

    // Arrastre.
    for (const s of socios) saldos.set(s.socioId, s.saldoFinal);
    cur = nextMonth(cur);
  }

  return meses;
}

/* ── Agregados ───────────────────────────────────────────────────────────── */

export interface ResumenSocio {
  socioId: string;
  nombre: string;
  estado: "activo" | "inactivo";
  capitalActual: number;
  participacion: number; // fracción del último mes (sobre saldo final)
  totalAportado: number; // capitalInicial + Σ aportes
  totalRetirado: number;
  gananciaNeta: number; // capitalActual + retiros − totalAportado
  rentabilidad: number; // gananciaNeta / totalAportado (0 si aportado = 0)
}

export interface ResumenPool {
  capitalActual: number; // incluye el flotante si existe
  capitalConfirmado: number; // al último mes con en_curso = false
  flotante: { anio: number; mes: number; roiMes: number; resultado: number } | null;
  totalAportes: number; // incluye capital inicial (semilla)
  totalRetiros: number;
  gananciaAcumulada: number;
  comisionPorCobrar: number; // incluye flotante
  comisionConfirmada: number; // sin flotante
  comisionPct: number;
  twrMes: number; // tasa del último mes con rendimiento
  twrAnual: number; // año del último mes de la serie
  twrDesdeInicio: number;
  socios: ResumenSocio[];
  meses: number;
}

export function resumenPool(meses: MesPool[], input: PoolInput): ResumenPool {
  const last = meses.length ? meses[meses.length - 1]! : null;
  const ultimoConRend = [...meses].reverse().find((m) => m.tieneRendimiento) ?? null;
  const flotanteMes = [...meses].reverse().find((m) => m.enCurso) ?? null;
  const ultimoCerrado =
    [...meses].reverse().find((m) => m.tieneRendimiento && !m.enCurso) ?? null;

  const capitalInicialTotal = round2(
    input.socios.reduce((s, x) => s + num(x.capitalInicial), 0),
  );
  const totalAportes = round2(
    capitalInicialTotal + meses.reduce((s, m) => s + m.aportes, 0),
  );
  const totalRetiros = round2(meses.reduce((s, m) => s + m.retiros, 0));

  const anioRef = last?.anio ?? new Date().getUTCFullYear();
  const mesesTwr = meses.filter((m) => m.tieneRendimiento);
  const twrAnual = roiCompuesto(
    mesesTwr.filter((m) => m.anio === anioRef).map((m) => ({ roiMes: m.tasaTwr })),
  );
  const twrDesdeInicio = roiCompuesto(mesesTwr.map((m) => ({ roiMes: m.tasaTwr })));

  const socios: ResumenSocio[] = input.socios.map((s) => {
    const ultimo = last?.socios.find((x) => x.socioId === s.id);
    const capitalActual = ultimo?.saldoFinal ?? round2(num(s.capitalInicial));
    const aportesMov = round2(
      meses.reduce(
        (sum, m) =>
          sum +
          m.movimientos
            .filter((x) => x.socioId === s.id && x.tipo === "deposito")
            .reduce((a, x) => a + num(x.monto), 0),
        0,
      ),
    );
    const totalRetirado = round2(
      meses.reduce(
        (sum, m) =>
          sum +
          m.movimientos
            .filter((x) => x.socioId === s.id && x.tipo === "retiro")
            .reduce((a, x) => a + num(x.monto), 0),
        0,
      ),
    );
    const totalAportado = round2(num(s.capitalInicial) + aportesMov);
    const gananciaNeta = round2(capitalActual + totalRetirado - totalAportado);
    return {
      socioId: s.id,
      nombre: s.nombre,
      estado: s.estado,
      capitalActual,
      participacion: ultimo?.participacionFinal ?? 0,
      totalAportado,
      totalRetirado,
      gananciaNeta,
      rentabilidad: totalAportado !== 0 ? gananciaNeta / totalAportado : 0,
    };
  });

  // Comisión confirmada = la acumulada al último mes CERRADO.
  const comisionConfirmada = ultimoCerrado?.comisionAcumulada ?? 0;
  const comisionPorCobrar = last?.comisionAcumulada ?? 0;

  return {
    capitalActual: last?.saldoFinal ?? capitalInicialTotal,
    capitalConfirmado: flotanteMes
      ? (ultimoCerrado?.saldoFinal ?? flotanteMes.saldoInicial)
      : (last?.saldoFinal ?? capitalInicialTotal),
    flotante: flotanteMes
      ? {
          anio: flotanteMes.anio,
          mes: flotanteMes.mes,
          roiMes: flotanteMes.roiMes,
          resultado: flotanteMes.resultado,
        }
      : null,
    totalAportes,
    totalRetiros,
    gananciaAcumulada: last?.gananciaAcumulada ?? 0,
    comisionPorCobrar,
    comisionConfirmada,
    comisionPct: input.config.comisionPct,
    twrMes: ultimoConRend?.tasaTwr ?? 0,
    twrAnual,
    twrDesdeInicio,
    socios,
    meses: meses.length,
  };
}

/** Validación para la action de overrides: Σ fijados vs. saldo del fondo. */
export function validarOverridesMes(
  saldoFinalFondo: number,
  overrides: number[],
): { suma: number; diferencia: number } {
  const suma = round2(overrides.reduce((s, v) => s + v, 0));
  return { suma, diferencia: round2(saldoFinalFondo - suma) };
}

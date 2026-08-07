/**
 * lib/finance/ledger.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MOTOR FINANCIERO — única fuente de verdad del cálculo.
 *
 * Filosofía "derive-on-read": NO se almacenan saldos. Se almacenan únicamente
 * los insumos (capital inicial, movimientos de capital y el resultado mensual)
 * y toda la cadena de saldos se RE-DERIVA cada vez que se lee. Por eso editar o
 * eliminar un insumo recalcula automáticamente todos los meses siguientes.
 *
 * Tanto la vista del cliente como la del administrador consumen ESTE módulo.
 * No dupliques cálculo en componentes. Toda la matemática vive aquí, con tests.
 *
 * Ver especificación en §5 del prompt maestro.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type Modo = "porcentaje" | "monto" | "saldo_final";
export type TipoMovimiento = "deposito" | "retiro";

/** Redondeo aritmético a 2 decimales, HALF_UP (en empates, se aleja de cero).
 *  Usa escalado vía string para evitar los artefactos binarios de coma flotante
 *  (p. ej. 1.005 → 1.01, no 1.00). Se redondea POR MES, no al final. */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  // Magnitudes sub-micro son 0 en dinero. Además evita la notación exponencial
  // de JS (|x| < 1e-6) que rompería el escalado por string (p. ej. "1e-7e2").
  if (abs < 1e-6) return 0;
  const scaled = Number(`${abs}e2`);
  // Guarda contra |x| >= 1e21 (notación exponencial ⇒ literal inválido ⇒ NaN).
  if (!Number.isFinite(scaled)) return value;
  // abs es positivo ⇒ Math.round (half-up hacia +∞) equivale a "alejarse de cero".
  const rounded = Math.round(scaled);
  const result = sign * Number(`${rounded}e-2`);
  return result === 0 ? 0 : result; // normaliza -0 a 0
}

/** Convierte numeric de Postgres (string) o number a number de forma segura. */
export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export interface RendimientoInput {
  anio: number;
  mes: number; // 1–12
  modo: Modo;
  valor: number | string; // interpretación según `modo`
  /** Base de comisión del mes cuando difiere del resultado del mes (null =
   *  se comisiona el resultado completo). Permite dejar fuera del reparto
   *  conceptos que son 100% del cliente (recompensas del bróker, dividendos). */
  resultadoComisionable?: number | string | null;
  descripcion?: string | null;
}

export interface MovimientoInput {
  tipo: TipoMovimiento;
  monto: number | string; // siempre > 0; el signo lo da el tipo
  fecha: string | Date; // se usa solo para ubicar el mes (YYYY-MM-DD recomendado)
  descripcion?: string | null;
}

/** Política de comisión del operador:
 *  - "normal": % sobre todo mes positivo.
 *  - "hwm_saldo": solo sobre lo que excede el pico histórico del SALDO.
 *  - "deficit_pnl": las pérdidas crean un déficit acumulado EN PNL; los meses
 *    positivos primero recuperan ese déficit y solo el excedente paga comisión.
 *    (A diferencia de hwm_saldo, los depósitos/retiros no distorsionan el
 *    cálculo: el déficit vive en resultados, no en el nivel del saldo.) */
export type PoliticaComision = "normal" | "hwm_saldo" | "deficit_pnl";

export interface LedgerConfig {
  /** Comisión del operador en % (p. ej. 35 = 35%). */
  comisionPct: number;
  /** Si true, solo se cobra comisión por encima del pico histórico (high-water mark). */
  usaHighWaterMark: boolean;
  /** Si true (default), el operador NO comparte pérdidas; los meses negativos no le restan. */
  pierdeSoloCliente: boolean;
  /** Si se omite, se deriva: usaHighWaterMark ? "hwm_saldo" : "normal". */
  politica?: PoliticaComision;
  /** true = la comisión se DEVENGA pero no se descuenta del saldo (informativa).
   *  Se usa cuando los saldos cargados son BRUTOS y el operador ya cobró por
   *  fuera de la cuenta (caso Daniel Flores: el cliente retiraba y le pasaba el
   *  35%). Con false (default) la comisión reduce el saldo, como siempre.
   *  Aplica a los TRES modos: en una cuenta de saldos brutos el saldo nunca
   *  puede llevar la comisión descontada o se separaría del saldo real. */
  comisionInformativa?: boolean;
}

export interface LedgerInput {
  capitalInicial: number | string;
  fechaIngreso: string | Date; // define el primer mes de la serie
  /** Último mes a computar (inclusive). Si se omite, se usa el mes más reciente con datos. */
  hasta?: { anio: number; mes: number };
  rendimientos: RendimientoInput[];
  movimientos: MovimientoInput[];
  config: LedgerConfig;
}

export interface MesLedger {
  anio: number;
  mes: number; // 1–12
  key: string; // "2024-09"
  saldoInicial: number;
  depositos: number;
  retiros: number;
  baseOperativa: number;
  modo: Modo | null; // null si el mes no tiene rendimiento cargado
  valor: number | null;
  rendBruto: number;
  /** Importe sobre el que se calculó la comisión. Igual a rendBruto salvo que
   *  el mes traiga una base propia (conceptos que no entran en el reparto). */
  baseComision: number;
  comision: number;
  rendNeto: number;
  saldoFinal: number;
  roiMes: number; // fracción (0.052 = +5.20%)
  hwm: number; // high-water mark al cierre del mes
  /** Déficit PNL pendiente de recuperar al cierre del mes (solo política
   *  "deficit_pnl"; 0 en las demás). El operador no cobra mientras sea > 0. */
  deficitAcum: number;
  descripcion: string | null;
  tieneRendimiento: boolean;
  movimientos: MovimientoInput[]; // movimientos imputados a este mes (para detalle)
}

/* ── Utilidades de calendario (año, mes) ─────────────────────────────────── */

type YM = { anio: number; mes: number };

export function monthKey(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

function ymOf(fecha: string | Date): YM {
  if (fecha instanceof Date) {
    return { anio: fecha.getUTCFullYear(), mes: fecha.getUTCMonth() + 1 };
  }
  // "YYYY-MM-DD" o "YYYY-MM"
  const parts = String(fecha).split("-");
  return { anio: Number(parts[0]), mes: Number(parts[1] ?? "1") };
}

function nextMonth(ym: YM): YM {
  return ym.mes === 12 ? { anio: ym.anio + 1, mes: 1 } : { anio: ym.anio, mes: ym.mes + 1 };
}

/** Comparador: <0 si a antes que b, 0 igual, >0 si a después que b. */
function cmpYM(a: YM, b: YM): number {
  return a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes;
}

/* ── Construcción de la cadena mensual continua ──────────────────────────── */

/** Base de comisión del mes: la propia si está cargada, si no el resultado.
 *  Trata null/undefined/"" como ausente, pero respeta un 0 explícito. */
function baseComisionable(r: RendimientoInput, rendBruto: number): number {
  const v = r.resultadoComisionable;
  if (v === null || v === undefined || v === "") return rendBruto;
  return round2(num(v));
}

export function construirCadena(input: LedgerInput): MesLedger[] {
  const start = ymOf(input.fechaIngreso);
  const { comisionPct, pierdeSoloCliente } = input.config;
  const comisionInformativa = input.config.comisionInformativa === true;

  // Índice de rendimientos por mes (único por mes garantizado en BD).
  const rendByKey = new Map<string, RendimientoInput>();
  for (const r of input.rendimientos) rendByKey.set(monthKey(r.anio, r.mes), r);

  // Índice de movimientos por mes. Los anteriores al primer mes se imputan al
  // primer mes para no perder capital.
  const movByKey = new Map<string, MovimientoInput[]>();
  for (const m of input.movimientos) {
    let ym = ymOf(m.fecha);
    if (cmpYM(ym, start) < 0) ym = start;
    const k = monthKey(ym.anio, ym.mes);
    const arr = movByKey.get(k) ?? [];
    arr.push(m);
    movByKey.set(k, arr);
  }

  // Mes final: el mayor entre start, último rendimiento, último movimiento, o `hasta`.
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
  if (input.hasta && cmpYM(input.hasta, end) > 0) end = input.hasta;
  if (cmpYM(end, start) < 0) end = { ...start };

  const meses: MesLedger[] = [];
  let saldoInicial = round2(num(input.capitalInicial));
  let hwm = round2(num(input.capitalInicial));
  // Política efectiva (compat: sin `politica`, se deriva del flag global).
  const politica: PoliticaComision =
    input.config.politica ?? (input.config.usaHighWaterMark ? "hwm_saldo" : "normal");
  let deficitAcum = 0; // solo se usa en "deficit_pnl"

  let cur: YM = { ...start };
  let safety = 0;
  while (cmpYM(cur, end) <= 0 && safety < 12_000) {
    safety++;
    const k = monthKey(cur.anio, cur.mes);
    const movs = movByKey.get(k) ?? [];

    const depositos = round2(
      movs.filter((m) => m.tipo === "deposito").reduce((s, m) => s + num(m.monto), 0),
    );
    const retiros = round2(
      movs.filter((m) => m.tipo === "retiro").reduce((s, m) => s + num(m.monto), 0),
    );
    const baseOperativa = round2(saldoInicial + depositos - retiros);

    const r = rendByKey.get(k);
    let rendBruto = 0;
    let baseCom = 0;
    let comision = 0;
    let rendNeto = 0;
    let saldoFinal = baseOperativa;
    let modo: Modo | null = null;
    let valor: number | null = null;

    if (r) {
      modo = r.modo;
      valor = num(r.valor);

      if (r.modo === "saldo_final") {
        // El operador escribe directamente el saldo final. El saldo MANDA:
        // nunca se le resta nada derivado.
        saldoFinal = round2(valor);
        rendNeto = round2(saldoFinal - baseOperativa);
        rendBruto = rendNeto; // sin concepto de "bruto" separado en este modo

        if (comisionInformativa) {
          // El saldo cargado es BRUTO y el operador ya cobró por fuera: la
          // comisión se DEVENGA (informativa) y no toca el saldo. La base
          // puede ser menor que el resultado del mes si hay conceptos que son
          // 100% del cliente (recompensas del bróker, dividendos).
          const baseCom = baseComisionable(r, rendBruto);

          if (politica === "deficit_pnl") {
            if (baseCom < 0) {
              deficitAcum = round2(deficitAcum - baseCom);
              comision = 0;
            } else if (baseCom > 0) {
              const recuperado = Math.min(baseCom, deficitAcum);
              const facturable = round2(baseCom - recuperado);
              deficitAcum = round2(deficitAcum - recuperado);
              comision = round2((facturable * comisionPct) / 100);
            } else {
              comision = 0;
            }
          } else if (baseCom > 0) {
            let facturable = baseCom;
            if (politica === "hwm_saldo") {
              facturable = Math.max(0, Math.min(baseCom, round2(saldoFinal - hwm)));
            }
            comision = round2((facturable * comisionPct) / 100);
          } else if (baseCom < 0 && !pierdeSoloCliente) {
            comision = round2((baseCom * comisionPct) / 100);
          } else {
            comision = 0;
          }
        } else {
          comision = 0;
          // En deficit_pnl el déficit sigue vivo aunque el mes venga "fijado":
          // así el histórico importado por saldo_final arrastra el déficit real.
          if (politica === "deficit_pnl") {
            deficitAcum =
              rendNeto < 0
                ? round2(deficitAcum - rendNeto)
                : Math.max(0, round2(deficitAcum - rendNeto));
          }
        }
      } else {
        if (r.modo === "porcentaje") {
          rendBruto = round2((baseOperativa * valor) / 100);
        } else {
          rendBruto = round2(valor); // modo "monto": rendimiento bruto directo en USD
        }

        // Con comisión informativa la base puede ser menor que el resultado
        // (recompensas del bróker y demás conceptos que son 100% del cliente).
        const baseCom = comisionInformativa ? baseComisionable(r, rendBruto) : rendBruto;

        if (politica === "deficit_pnl") {
          // Las pérdidas alimentan el déficit; las ganancias primero lo
          // recuperan y solo el excedente paga comisión.
          if (baseCom < 0) {
            deficitAcum = round2(deficitAcum - baseCom);
            comision = 0;
          } else if (baseCom > 0) {
            const recuperado = Math.min(baseCom, deficitAcum);
            const billable = round2(baseCom - recuperado);
            deficitAcum = round2(deficitAcum - recuperado);
            comision = round2((billable * comisionPct) / 100);
          } else {
            comision = 0;
          }
        } else if (baseCom > 0) {
          let billable = baseCom;
          if (politica === "hwm_saldo") {
            const preFee = baseOperativa + rendBruto;
            billable = Math.max(0, Math.min(baseCom, round2(preFee - hwm)));
          }
          comision = round2((billable * comisionPct) / 100);
        } else if (baseCom < 0 && !pierdeSoloCliente) {
          // El operador comparte la pérdida (clawback): comisión negativa que
          // amortigua la pérdida del cliente. Solo si pierde_solo_cliente = false.
          comision = round2((baseCom * comisionPct) / 100);
        } else {
          comision = 0; // default: las pérdidas no generan comisión
        }

        if (comisionInformativa) {
          // Saldos BRUTOS: la comisión ya se liquidó fuera de la cuenta, así que
          // NO puede volver a restarse aquí (si no, el saldo del portal se
          // separaría del saldo real del bróker mes a mes).
          rendNeto = rendBruto;
        } else {
          rendNeto = round2(rendBruto - comision);
        }
        saldoFinal = round2(baseOperativa + rendNeto);
      }
    }

    const roiMes = baseOperativa !== 0 ? rendNeto / baseOperativa : 0;
    hwm = Math.max(hwm, saldoFinal);

    meses.push({
      anio: cur.anio,
      mes: cur.mes,
      key: k,
      saldoInicial,
      depositos,
      retiros,
      baseOperativa,
      modo,
      valor,
      rendBruto,
      baseComision: baseCom,
      comision,
      rendNeto,
      saldoFinal,
      roiMes,
      hwm,
      deficitAcum,
      descripcion: r?.descripcion ?? null,
      tieneRendimiento: !!r,
      movimientos: movs,
    });

    saldoInicial = saldoFinal;
    cur = nextMonth(cur);
  }

  return meses;
}

/* ── Métricas agregadas ──────────────────────────────────────────────────── */

/** ROI compuesto sobre un conjunto de meses: Π(1 + roi_mes) − 1.
 *  Acepta cualquier serie con `roiMes` (la usa también el fondo compartido). */
export function roiCompuesto(meses: ReadonlyArray<{ roiMes: number }>): number {
  return meses.reduce((acc, m) => acc * (1 + m.roiMes), 1) - 1;
}

/** ROI de un año concreto. */
export function roiAnual(meses: MesLedger[], anio: number): number {
  return roiCompuesto(meses.filter((m) => m.anio === anio));
}

/** ROI acumulado desde el ingreso (todos los meses). */
export function roiAcumulado(meses: MesLedger[]): number {
  return roiCompuesto(meses);
}

export interface ResumenLedger {
  saldoActual: number;
  capitalInicial: number;
  totalDepositos: number;
  totalRetiros: number;
  aporteNeto: number; // capital inicial + depósitos − retiros
  gananciaNeta: number; // Σ rend_neto
  comisionOperador: number; // Σ comisión (el ingreso del operador)
  rendBrutoTotal: number; // Σ rend_bruto
  roiAcumulado: number;
  roiAnioActual: number;
  ultimoMes: MesLedger | null;
  meses: number; // cantidad de meses en la serie
}

/** Resumen agregado de una cadena ya construida. */
export function resumen(
  meses: MesLedger[],
  capitalInicial: number | string,
  anioReferencia?: number,
): ResumenLedger {
  const last = meses.length ? meses[meses.length - 1]! : null;
  const totalDepositos = round2(meses.reduce((s, m) => s + m.depositos, 0));
  const totalRetiros = round2(meses.reduce((s, m) => s + m.retiros, 0));
  const gananciaNeta = round2(meses.reduce((s, m) => s + m.rendNeto, 0));
  const comisionOperador = round2(meses.reduce((s, m) => s + m.comision, 0));
  const rendBrutoTotal = round2(meses.reduce((s, m) => s + m.rendBruto, 0));
  const cap = round2(num(capitalInicial));
  const anio = anioReferencia ?? last?.anio ?? new Date().getUTCFullYear();

  return {
    saldoActual: last?.saldoFinal ?? cap,
    capitalInicial: cap,
    totalDepositos,
    totalRetiros,
    aporteNeto: round2(cap + totalDepositos - totalRetiros),
    gananciaNeta,
    comisionOperador,
    rendBrutoTotal,
    roiAcumulado: roiAcumulado(meses),
    roiAnioActual: roiAnual(meses, anio),
    ultimoMes: last,
    meses: meses.length,
  };
}

/** Agrupa una cadena por año con métricas anuales (para reportes anuales). */
export interface ResumenAnual {
  anio: number;
  depositos: number;
  retiros: number;
  rendNeto: number;
  comision: number;
  roiAnual: number;
  saldoFinal: number; // saldo al cierre del último mes del año
}

/** Estadísticas descriptivas de una cadena (para dashboards). Solo considera
 *  meses con rendimiento registrado. */
export interface EstadisticasLedger {
  mejorMes: MesLedger | null;
  peorMes: MesLedger | null;
  promedioRoiMensual: number; // media aritmética del roi de los meses con resultado
  mesesPositivos: number;
  mesesNegativos: number;
  mesesConRendimiento: number;
}

export function estadisticas(meses: MesLedger[]): EstadisticasLedger {
  const conRend = meses.filter((m) => m.tieneRendimiento);
  let mejor: MesLedger | null = null;
  let peor: MesLedger | null = null;
  for (const m of conRend) {
    if (!mejor || m.roiMes > mejor.roiMes) mejor = m;
    if (!peor || m.roiMes < peor.roiMes) peor = m;
  }
  const promedio = conRend.length
    ? conRend.reduce((s, m) => s + m.roiMes, 0) / conRend.length
    : 0;
  return {
    mejorMes: mejor,
    peorMes: peor,
    promedioRoiMensual: promedio,
    mesesPositivos: conRend.filter((m) => m.rendNeto > 0).length,
    mesesNegativos: conRend.filter((m) => m.rendNeto < 0).length,
    mesesConRendimiento: conRend.length,
  };
}

export function resumenPorAnio(meses: MesLedger[]): ResumenAnual[] {
  const anios = [...new Set(meses.map((m) => m.anio))].sort((a, b) => a - b);
  return anios.map((anio) => {
    const delAnio = meses.filter((m) => m.anio === anio);
    const last = delAnio[delAnio.length - 1]!;
    return {
      anio,
      depositos: round2(delAnio.reduce((s, m) => s + m.depositos, 0)),
      retiros: round2(delAnio.reduce((s, m) => s + m.retiros, 0)),
      rendNeto: round2(delAnio.reduce((s, m) => s + m.rendNeto, 0)),
      comision: round2(delAnio.reduce((s, m) => s + m.comision, 0)),
      roiAnual: roiCompuesto(delAnio),
      saldoFinal: last.saldoFinal,
    };
  });
}

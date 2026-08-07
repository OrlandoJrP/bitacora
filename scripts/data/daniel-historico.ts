/**
 * Transcripción del historial COMPLETO de la cuenta MT5 75057535 (Exness) de
 * Daniel Flores, generada desde ReportHistory-75057535.html (01-sep-2025 →
 * 07-ago-2026, 1.731 movimientos de balance, cadena verificada sin desfases).
 *
 * REGLAS DEL ACUERDO (confirmadas por el operador el 07-ago-2026):
 * - Reparto 65/35: el 35% del profit es del operador. Daniel retiraba de la
 *   cuenta y le pasaba su parte POR FUERA ⇒ los saldos de aquí son BRUTOS y la
 *   comisión se registra como INFORMATIVA (devengada, nunca descontada dos
 *   veces). Por eso `comisionInformativa: true`.
 * - Política `deficit_pnl`: el operador no cobra nada hasta recuperar la
 *   pérdida acumulada.
 * - Las recompensas del bróker (cashback EXD, D-INCCOMP, D-SOF_VERI) y los
 *   ajustes por dividendos NO son profit del operador: son 100% de Daniel.
 *   Suman al saldo pero quedan FUERA de la base de comisión ⇒ cada mes lleva
 *   `resultadoComisionable` = resultado de TRADING puro.
 *
 * Cada mes se importa como `saldo_final` = balance de cierre del propio MT5,
 * así el saldo del portal es exactamente el de la cuenta real.
 */

export const CLIENTE = {
  nombre: "Daniel Flores",
  email: "danielflores@gmail.com",
  fechaIngreso: "2025-09-01",
  capitalInicial: "989.67", // primer depósito (01-sep-2025)
  comisionPct: "35.000",
  politicaComision: "deficit_pnl" as const,
  comisionInformativa: true,
  estado: "activo" as const,
  notas:
    "Cuenta MT5 75057535 (Exness). Reparto 65/35 con déficit: el operador no cobra hasta recuperar la pérdida acumulada. Saldos brutos; la comisión se devenga informativa porque el cliente la pagaba por fuera. Recompensas del bróker y dividendos son 100% del cliente (fuera de la base de comisión). Cuenta de alto riesgo.",
};

export interface MovHistorico {
  tipo: "deposito" | "retiro";
  monto: string;
  fecha: string;
  descripcion: string;
}

/** Depósitos y retiros REALES de capital (las recompensas del bróker NO están
 *  aquí: son resultado, no aporte). El primer depósito es el capital inicial. */
export const MOVIMIENTOS: MovHistorico[] = [
  { tipo: "retiro", monto: "10.00", fecha: "2025-09-02", descripcion: "Retiro · W-BINANCEU-USD-594167545860" },
  { tipo: "deposito", monto: "20.00", fecha: "2025-09-03", descripcion: "Aporte de capital · D-ALLINT-USD-INT-85085446149" },
  { tipo: "deposito", monto: "100.00", fecha: "2025-10-07", descripcion: "Aporte de capital · D-ALLINT-USD-INT-150611214341" },
  { tipo: "deposito", monto: "58900.00", fecha: "2025-10-07", descripcion: "Aporte de capital · D-ALLINT-USD-INT-150629236741" },
  { tipo: "retiro", monto: "10000.00", fecha: "2025-10-20", descripcion: "Retiro · W-ALLINT-USD-INT-185856204805" },
  { tipo: "retiro", monto: "1084.33", fecha: "2025-10-31", descripcion: "Retiro · W-ALLINT-USD-INT-218968260613" },
  { tipo: "deposito", monto: "1499.00", fecha: "2025-11-02", descripcion: "Aporte de capital · D-ALLINT-USD-INT-220991832069" },
  { tipo: "deposito", monto: "37001.00", fecha: "2025-11-02", descripcion: "Aporte de capital · D-ALLINT-USD-INT-220994207749" },
  { tipo: "retiro", monto: "12876.75", fecha: "2025-11-12", descripcion: "Retiro · W-ALLINT-USD-INT-246779228165" },
  { tipo: "deposito", monto: "1.28", fecha: "2025-11-12", descripcion: "Aporte de capital · D-ALLINT-USD-INT-246791995397" },
  { tipo: "retiro", monto: "5000.00", fecha: "2025-12-15", descripcion: "Retiro · W-ALLINT-USD-INT-325541826565" },
  { tipo: "retiro", monto: "9806.00", fecha: "2025-12-19", descripcion: "Retiro · W-ALLINT-USD-INT-336729337861" },
  { tipo: "retiro", monto: "100.00", fecha: "2025-12-26", descripcion: "Retiro · W-ALLINT-USD-INT-351159095301" },
  { tipo: "retiro", monto: "2100.00", fecha: "2025-12-26", descripcion: "Retiro · W-ALLINT-USD-INT-351165665285" },
  { tipo: "retiro", monto: "5260.00", fecha: "2025-12-29", descripcion: "Retiro · W-ALLINT-USD-INT-353247211525" },
  { tipo: "retiro", monto: "100.00", fecha: "2026-01-13", descripcion: "Retiro · W-ALLINT-USD-INT-389475545093" },
  { tipo: "retiro", monto: "20217.79", fecha: "2026-01-13", descripcion: "Retiro · W-ALLINT-USD-INT-389497630725" },
  { tipo: "retiro", monto: "6562.65", fecha: "2026-01-13", descripcion: "Retiro · W-ALLINT-USD-INT-392218423301" },
  { tipo: "retiro", monto: "2407.80", fecha: "2026-01-13", descripcion: "Retiro · W-ALLINT-USD-INT-392567443461" },
  { tipo: "deposito", monto: "200.38", fecha: "2026-01-14", descripcion: "Aporte de capital · D-ALLINT-USD-INT-395588943877" },
  { tipo: "deposito", monto: "251.00", fecha: "2026-01-15", descripcion: "Aporte de capital · D-ALLINT-USD-INT-399485018117" },
  { tipo: "deposito", monto: "1341.59", fecha: "2026-01-15", descripcion: "Aporte de capital · D-ALLINT-USD-INT-400340688901" },
  { tipo: "retiro", monto: "1536.32", fecha: "2026-01-20", descripcion: "Retiro · W-ALLINT-USD-INT-409091510277" },
  { tipo: "retiro", monto: "5000.00", fecha: "2026-01-30", descripcion: "Retiro · W-ALLINT-USD-INT-457853739013" },
  { tipo: "retiro", monto: "9923.50", fecha: "2026-02-04", descripcion: "Retiro · W-ALLINT-USD-INT-480064344066" },
  { tipo: "retiro", monto: "5124.00", fecha: "2026-02-04", descripcion: "Retiro · W-ALLINT-USD-INT-481788964866" },
  { tipo: "retiro", monto: "2000.00", fecha: "2026-02-05", descripcion: "Retiro · W-ALLINT-USD-INT-483519401986" },
  { tipo: "retiro", monto: "9624.20", fecha: "2026-02-11", descripcion: "Retiro · W-ALLINT-USD-INT-508173799426" },
  { tipo: "retiro", monto: "12883.70", fecha: "2026-02-12", descripcion: "Retiro · W-ALLINT-USD-INT-511961911298" },
  { tipo: "retiro", monto: "7443.84", fecha: "2026-02-17", descripcion: "Retiro · W-ALLINT-USD-INT-523295137794" },
  { tipo: "retiro", monto: "5239.00", fecha: "2026-02-17", descripcion: "Retiro · W-ALLINT-USD-INT-525148438530" },
  { tipo: "retiro", monto: "4514.60", fecha: "2026-02-18", descripcion: "Retiro · W-ALLINT-USD-INT-528686727170" },
  { tipo: "retiro", monto: "5386.12", fecha: "2026-02-23", descripcion: "Retiro · W-ALLINT-USD-INT-538787782658" },
  { tipo: "retiro", monto: "7373.61", fecha: "2026-03-12", descripcion: "Retiro · W-ALLINT-USD-INT-590955655170" },
  { tipo: "retiro", monto: "3804.69", fecha: "2026-03-19", descripcion: "Retiro · W-ALLINT-USD-INT-611989524482" },
  { tipo: "retiro", monto: "9449.24", fecha: "2026-03-23", descripcion: "Retiro · W-ALLINT-USD-INT-622631686149" },
  { tipo: "retiro", monto: "4550.00", fecha: "2026-03-24", descripcion: "Retiro · W-ALLINT-USD-INT-626317922309" },
  { tipo: "retiro", monto: "2391.80", fecha: "2026-03-25", descripcion: "Retiro · W-ALLINT-USD-INT-631894011909" },
  { tipo: "retiro", monto: "3390.50", fecha: "2026-03-26", descripcion: "Retiro · W-ALLINT-USD-INT-635619160069" },
  { tipo: "retiro", monto: "10601.70", fecha: "2026-04-13", descripcion: "Retiro · W-ALLINT-USD-INT-679613337605" },
];

export interface RendHistorico {
  anio: number;
  mes: number;
  /** Balance de cierre del mes según MT5. */
  valor: string;
  /** Base de comisión: resultado de TRADING puro (sin recompensas ni dividendos). */
  resultadoComisionable: string;
  descripcion: string;
}

export const RENDIMIENTOS: RendHistorico[] = [
  { anio: 2025, mes: 9, valor: "1090.16", resultadoComisionable: "90.49", descripcion: "trading +90.49 · comisión operador 31.67" },
  { anio: 2025, mes: 10, valor: "51500.00", resultadoComisionable: "2494.17", descripcion: "trading +2,494.17 · comisión operador 872.96" },
  { anio: 2025, mes: 11, valor: "87886.01", resultadoComisionable: "9085.93", descripcion: "trading +9,085.93 · recompensas/dividendos +1,675.55 · comisión operador 3,180.08" },
  { anio: 2025, mes: 12, valor: "89189.73", resultadoComisionable: "23569.72", descripcion: "trading +23,569.72 · comisión operador 8,249.40" },
  { anio: 2026, mes: 1, valor: "95184.50", resultadoComisionable: "40026.36", descripcion: "trading +40,026.36 · comisión operador 14,009.23" },
  { anio: 2026, mes: 2, valor: "84202.50", resultadoComisionable: "51205.11", descripcion: "trading +51,205.11 · recompensas/dividendos -48.15 · comisión operador 17,921.79" },
  { anio: 2026, mes: 3, valor: "125314.00", resultadoComisionable: "72082.57", descripcion: "trading +72,082.57 · recompensas/dividendos -11.23 · comisión operador 25,228.90" },
  { anio: 2026, mes: 4, valor: "65909.08", resultadoComisionable: "-48778.92", descripcion: "trading -48,778.92 · recompensas/dividendos -24.30 · déficit 48,778.92" },
  { anio: 2026, mes: 5, valor: "50621.69", resultadoComisionable: "-15249.18", descripcion: "trading -15,249.18 · recompensas/dividendos -38.21 · déficit 64,028.10" },
  { anio: 2026, mes: 6, valor: "58788.27", resultadoComisionable: "6788.89", descripcion: "trading +6,788.89 · recompensas/dividendos +1,377.69 · déficit 57,239.21" },
  { anio: 2026, mes: 7, valor: "15099.97", resultadoComisionable: "-43688.30", descripcion: "trading -43,688.30 · déficit 100,927.51" },
  { anio: 2026, mes: 8, valor: "16346.13", resultadoComisionable: "1243.20", descripcion: "trading +1,243.20 · recompensas/dividendos +2.96 · déficit 99,684.31" },
];

/** Verificación al centavo: saldo, comisión devengada y déficit por mes. */
export const ESPERADO: ReadonlyArray<{
  anio: number;
  mes: number;
  saldoFinal: number;
  comision: number;
  deficit: number;
}> = [
  { anio: 2025, mes: 9, saldoFinal: 1090.16, comision: 31.67, deficit: 0.0 },
  { anio: 2025, mes: 10, saldoFinal: 51500.0, comision: 872.96, deficit: 0.0 },
  { anio: 2025, mes: 11, saldoFinal: 87886.01, comision: 3180.08, deficit: 0.0 },
  { anio: 2025, mes: 12, saldoFinal: 89189.73, comision: 8249.4, deficit: 0.0 },
  { anio: 2026, mes: 1, saldoFinal: 95184.5, comision: 14009.23, deficit: 0.0 },
  { anio: 2026, mes: 2, saldoFinal: 84202.5, comision: 17921.79, deficit: 0.0 },
  { anio: 2026, mes: 3, saldoFinal: 125314.0, comision: 25228.9, deficit: 0.0 },
  { anio: 2026, mes: 4, saldoFinal: 65909.08, comision: 0.0, deficit: 48778.92 },
  { anio: 2026, mes: 5, saldoFinal: 50621.69, comision: 0.0, deficit: 64028.1 },
  { anio: 2026, mes: 6, saldoFinal: 58788.27, comision: 0.0, deficit: 57239.21 },
  { anio: 2026, mes: 7, saldoFinal: 15099.97, comision: 0.0, deficit: 100927.51 },
  { anio: 2026, mes: 8, saldoFinal: 16346.13, comision: 0.0, deficit: 99684.31 },
];

export const APORTADO_ESPERADO = 100303.92;   // incluye el capital inicial
export const RETIRADO_ESPERADO = 185762.14;
export const SALDO_ACTUAL_ESPERADO = 16346.13;
export const COMISION_DEVENGADA_ESPERADA = 69494.03;
export const DEFICIT_PENDIENTE_ESPERADO = 99684.31;

/** Anclas INDEPENDIENTES tomadas del propio reporte de Exness, no derivadas de
 *  esta transcripción: son las que detectan un error de captura.
 *  - "Total Net Profit" del bloque Results = 779.070,34 − 680.200,30. */
export const RESULTADO_TRADING_ESPERADO = 98870.04;
/** Resultado total = trading + recompensas del bróker (+2.934,31 netos de los
 *  ajustes por dividendos). Es lo que movió el saldo de la cuenta. */
export const RESULTADO_TOTAL_ESPERADO = 101804.35;

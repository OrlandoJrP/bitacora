/**
 * Cuenta MT5 75057535 (Exness) de Daniel Flores — historial completo
 * 01-sep-2025 → 07-ago-2026, generado del reporte del bróker y CONTRASTADO con
 * la conversación de WhatsApp y los comprobantes de pago en USDT.
 *
 * CÓMO SE LIQUIDA ESTA CUENTA (no es mensual):
 * Hay un CAPITAL BASE pactado. Se opera por encima de él y cada vez que la
 * cuenta lo supera se reparte la ganancia 65/35; el saldo que queda pasa a ser
 * la base nueva. El 35% se cobra sobre la ganancia COMPLETA (se retire o no).
 * Si el cliente retira estando por debajo de la base, eso es capital: no genera
 * comisión y la base baja en ese monto.
 *
 * Validado al centavo contra tres comprobantes del chat:
 *   13-ene: 35% de 8.562,65 = 2.996,93 → pago de 3.000 USDT
 *   13-ene: 35% de 5.407,80 = 1.892,73 → pago de 1.893 USDT
 *   19-ene: 35% de 1.536,32 =   537,71 → pago de   538 USDT
 * Y contra las bases que aparecen escritas en el chat: 95.000, 100.000,
 * 102.000, 105.000, 110.000, 115.000, 120.000, 125.000 y 130.000.
 *
 * Por eso cada mes lleva `resultadoComisionable` = GANANCIA LIQUIDADA de ese
 * mes (no el resultado contable del mes) y la política es `normal`: el 35% sale
 * exacto. La comisión es INFORMATIVA: los saldos son los reales del bróker y el
 * cliente ya pagó por fuera.
 *
 * Última liquidación: 13-abr-2026, saldo 140.601,70 → retiro 10.601,70 → base
 * 130.000,00. Desde ahí la cuenta solo ha perdido: no se cobra comisión hasta
 * volver a 130.000.
 */

export const CLIENTE = {
  nombre: "Daniel Flores",
  email: "danielflores@gmail.com",
  fechaIngreso: "2025-09-01",
  capitalInicial: "989.67", // primer depósito (01-sep-2025)
  comisionPct: "35.000",
  politicaComision: "normal" as const,
  /** El cliente pagaba el 35% por fuera: los saldos del bróker son BRUTOS. */
  tratamientoComision: "pagada_aparte" as const,
  /** Capital base pactado vigente. No se cobra comisión hasta superarlo. */
  capitalBase: "130000.00",
  estado: "activo" as const,
  notas:
    "Cuenta MT5 75057535 (Exness), alto riesgo. Reparto 65/35 sobre un CAPITAL BASE pactado: se cobra el 35% de la ganancia que supera la base y el saldo que queda es la base nueva. Base vigente $130.000 desde el 13-abr-2026; no se cobra nada hasta volver a ese nivel. Comisión informativa: los saldos son brutos porque el cliente la pagaba por fuera.",
};

export interface MovHistorico {
  tipo: "deposito" | "retiro";
  monto: string;
  fecha: string;
  descripcion: string;
}

/** Depósitos y retiros REALES de capital (las recompensas del bróker no están
 *  aquí: son resultado, no aporte). El primero es el capital inicial. */
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
  /** GANANCIA LIQUIDADA del mes: la base sobre la que se cobró el 35%. */
  resultadoComisionable: string;
  descripcion: string;
}

export const RENDIMIENTOS: RendHistorico[] = [
  { anio: 2025, mes: 9, valor: "1090.16", resultadoComisionable: "0.00", descripcion: "resultado +90.49 · sin liquidación · base 999.67" },
  { anio: 2025, mes: 10, valor: "51500.00", resultadoComisionable: "2584.66", descripcion: "resultado +2,494.17 · ganancia liquidada 2,584.66 → tu 35% = 904.63 · base 51,500.00" },
  { anio: 2025, mes: 11, valor: "87886.01", resultadoComisionable: "22876.75", descripcion: "resultado +10,761.48 · ganancia liquidada 22,876.75 → tu 35% = 8,006.86 · base 100,001.28" },
  { anio: 2025, mes: 12, valor: "89189.73", resultadoComisionable: "22264.93", descripcion: "resultado +23,569.72 · ganancia liquidada 22,264.93 → tu 35% = 7,792.73 · base 100,000.21" },
  { anio: 2026, mes: 1, valor: "95184.50", resultadoComisionable: "49031.38", descripcion: "resultado +40,026.36 · ganancia liquidada 49,031.38 → tu 35% = 17,160.98 · base 115,000.00" },
  { anio: 2026, mes: 2, valor: "84202.50", resultadoComisionable: "67138.96", descripcion: "resultado +51,156.96 · ganancia liquidada 67,138.96 → tu 35% = 23,498.64 · base 120,000.00" },
  { anio: 2026, mes: 3, valor: "125314.00", resultadoComisionable: "35959.84", descripcion: "resultado +72,071.34 · ganancia liquidada 35,959.84 → tu 35% = 12,585.94 · base 125,000.00" },
  { anio: 2026, mes: 4, valor: "65909.08", resultadoComisionable: "15601.70", descripcion: "resultado -48,803.22 · ganancia liquidada 15,601.70 → tu 35% = 5,460.60 · base 130,000.00" },
  { anio: 2026, mes: 5, valor: "50621.69", resultadoComisionable: "0.00", descripcion: "resultado -15,287.39 · sin liquidación · base 130,000.00" },
  { anio: 2026, mes: 6, valor: "58788.27", resultadoComisionable: "0.00", descripcion: "resultado +8,166.58 · sin liquidación · base 130,000.00" },
  { anio: 2026, mes: 7, valor: "15099.97", resultadoComisionable: "0.00", descripcion: "resultado -43,688.30 · sin liquidación · base 130,000.00" },
  { anio: 2026, mes: 8, valor: "16346.13", resultadoComisionable: "0.00", descripcion: "resultado +1,246.16 · sin liquidación · base 130,000.00" },
];

/** Verificación al centavo: saldo y comisión devengada por mes. */
export const ESPERADO: ReadonlyArray<{
  anio: number; mes: number; saldoFinal: number; comision: number;
}> = [
  { anio: 2025, mes: 9, saldoFinal: 1090.16, comision: 0.0 },
  { anio: 2025, mes: 10, saldoFinal: 51500.0, comision: 904.63 },
  { anio: 2025, mes: 11, saldoFinal: 87886.01, comision: 8006.86 },
  { anio: 2025, mes: 12, saldoFinal: 89189.73, comision: 7792.73 },
  { anio: 2026, mes: 1, saldoFinal: 95184.5, comision: 17160.98 },
  { anio: 2026, mes: 2, saldoFinal: 84202.5, comision: 23498.64 },
  { anio: 2026, mes: 3, saldoFinal: 125314.0, comision: 12585.94 },
  { anio: 2026, mes: 4, saldoFinal: 65909.08, comision: 5460.6 },
  { anio: 2026, mes: 5, saldoFinal: 50621.69, comision: 0.0 },
  { anio: 2026, mes: 6, saldoFinal: 58788.27, comision: 0.0 },
  { anio: 2026, mes: 7, saldoFinal: 15099.97, comision: 0.0 },
  { anio: 2026, mes: 8, saldoFinal: 16346.13, comision: 0.0 },
];

export const APORTADO_ESPERADO = 100303.92;   // incluye el capital inicial
export const RETIRADO_ESPERADO = 185762.14;
export const SALDO_ACTUAL_ESPERADO = 16346.13;
export const GANANCIA_LIQUIDADA_ESPERADA = 215458.22;
export const COMISION_DEVENGADA_ESPERADA = 75410.38;
/** Suma de las 30 liquidaciones con reparto: 75410.39. Difiere en
 *  1 centavo de COMISION_DEVENGADA_ESPERADA porque cada liquidación se redondeó
 *  por separado al pagarse, mientras el portal aplica el 35% al total del mes. */
export const COMISION_SUMA_LIQUIDACIONES = 75410.39;
export const CAPITAL_BASE = 130000.0;
/** Lo que falta para volver a la base y poder cobrar de nuevo. */
export const FALTA_PARA_BASE_ESPERADO = 113653.87;

/** Anclas INDEPENDIENTES del propio reporte de Exness (detectan un error de captura). */
export const RESULTADO_TRADING_ESPERADO = 98870.04;   // "Total Net Profit" del reporte
export const RESULTADO_TOTAL_ESPERADO = 101804.35;    // trading + recompensas − dividendos

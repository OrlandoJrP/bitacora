/**
 * Transcripción fiel de REPORTE_FONDO_JUL2026.xlsx (hojas CUADRO HISTORICO y
 * MOVIMIENTOS, incluidas las notas de celda). Consumida por scripts/seed-fondo.ts.
 *
 * Reglas de transcripción:
 * - Cada mes cerrado se importa como modo `saldo_final` del FONDO con valor =
 *   Σ de los saldos por socio del cuadro (así el descuadre es 0 por
 *   construcción). Nota: nov-2025 el cuadro trae capital final 55,586.33 pero
 *   los socios suman 55,586.32 — mandan los saldos por socio (son lo que cada
 *   socio ve como suyo; el RESUMEN del Excel también suma posiciones).
 * - abr-2026 lleva tasa_twr = −13.98 (exposición parcial del depósito del
 *   29-abr, nota E8/F21): la tasa TWR reportada difiere de resultado/base.
 * - jul-2026 cerró definitivo en −7,8% sobre el capital (antes iba flotante
 *   +6,6 al corte 09/07). ago-2026 va como porcentaje −5,54 con en_curso =
 *   true (flotante al 07/08/2026), tras el retiro de Arlet de 5.000.
 * - Reparto: overrides por socio sep-24→abr-26 (% negociados históricos);
 *   may-26 y jun-26 proporcional puro (nota K22) — verificado que reproduce
 *   el cuadro al centavo.
 * - La salida de Railen (feb-25) y la compra de Arlet (mar-25) van enlazadas
 *   como transferencia (ref T1). El saldo de Railen en feb lo deriva el motor
 *   (base 20.43 − 20.43 de pérdida = 0), sin override.
 */

export const FONDO = {
  // OJO: el fondo fue renombrado en Admin; el seed lo busca por ESTE nombre y
  // aborta si no lo encuentra habiendo otros fondos (guardia anti-duplicados).
  nombre: "Fondo Compartido Arlet y lenin",
  fechaInicio: "2024-09-01",
  capitalInicial: "6125.00", // semilla (Lenin)
  comisionPct: "35.000",
  baseComision: "ganancia_neta" as const,
  notas:
    "Importado del Excel REPORTE_FONDO_JUL2026 (corte 09/07/2026). Actualizado 07/08/2026: julio cerró −7,8%, retiro Arlet 5.000 y agosto flotante −5,54%.",
};

export const SOCIOS = [
  { ref: "LENIN", nombre: "Lenin", capitalInicial: "6125.00", fechaAlta: "2024-09-01", estado: "activo" as const },
  { ref: "ARLET", nombre: "Arlet", capitalInicial: "0.00", fechaAlta: "2024-09-01", estado: "activo" as const },
  { ref: "RAILEN", nombre: "Railen", capitalInicial: "0.00", fechaAlta: "2024-09-01", estado: "inactivo" as const },
];

export interface MovHistorico {
  socio: string;
  tipo: "deposito" | "retiro";
  monto: string;
  fecha: string;
  descripcion: string;
  transferRef?: string;
}

export const MOVIMIENTOS: MovHistorico[] = [
  { socio: "ARLET", tipo: "deposito", monto: "8000.00", fecha: "2024-09-01", descripcion: "Entrada al fondo" },
  { socio: "RAILEN", tipo: "deposito", monto: "3000.00", fecha: "2024-09-01", descripcion: "Entrada al fondo" },
  { socio: "RAILEN", tipo: "deposito", monto: "1000.00", fecha: "2024-12-01", descripcion: "Aporte adicional" },
  { socio: "RAILEN", tipo: "retiro", monto: "4915.65", fecha: "2025-02-28", descripcion: "Salida del fondo (saldo final)", transferRef: "T1" },
  { socio: "ARLET", tipo: "deposito", monto: "4915.65", fecha: "2025-03-01", descripcion: "Compra la cuenta de Railen", transferRef: "T1" },
  { socio: "ARLET", tipo: "deposito", monto: "3000.00", fecha: "2025-09-01", descripcion: "Aporte" },
  { socio: "ARLET", tipo: "deposito", monto: "5500.00", fecha: "2025-10-01", descripcion: "Aporte (los pasó Felipe)" },
  { socio: "ARLET", tipo: "deposito", monto: "700.00", fecha: "2025-12-01", descripcion: "Aporte" },
  { socio: "ARLET", tipo: "deposito", monto: "2902.60", fecha: "2026-01-01", descripcion: "Aporte" },
  { socio: "LENIN", tipo: "retiro", monto: "800.00", fecha: "2026-01-15", descripcion: "Ropa" },
  { socio: "LENIN", tipo: "retiro", monto: "100.00", fecha: "2026-03-15", descripcion: "Cable" },
  { socio: "ARLET", tipo: "retiro", monto: "500.00", fecha: "2026-04-16", descripcion: "Sonido" },
  { socio: "ARLET", tipo: "retiro", monto: "600.00", fecha: "2026-04-16", descripcion: "Boga evento" },
  { socio: "ARLET", tipo: "retiro", monto: "2500.00", fecha: "2026-04-24", descripcion: "Trasmisor" },
  { socio: "ARLET", tipo: "deposito", monto: "24760.18", fecha: "2026-04-29", descripcion: "Depósito fin de mes (expuesto solo -1,5% en abril)" },
  { socio: "ARLET", tipo: "retiro", monto: "721.00", fecha: "2026-05-04", descripcion: "Cable radio" },
  { socio: "ARLET", tipo: "retiro", monto: "500.00", fecha: "2026-05-08", descripcion: "Sonido" },
  { socio: "ARLET", tipo: "retiro", monto: "300.00", fecha: "2026-05-09", descripcion: "Willian Ocanto" },
  { socio: "ARLET", tipo: "retiro", monto: "40.00", fecha: "2026-05-14", descripcion: "Flete dron" },
  { socio: "ARLET", tipo: "retiro", monto: "1760.00", fecha: "2026-05-14", descripcion: "Abogado" },
  { socio: "ARLET", tipo: "retiro", monto: "870.00", fecha: "2026-05-15", descripcion: "Abogado" },
  { socio: "ARLET", tipo: "retiro", monto: "100.00", fecha: "2026-05-20", descripcion: "Dinero personal" },
  { socio: "ARLET", tipo: "retiro", monto: "50.00", fecha: "2026-05-20", descripcion: "Dinero personal" },
  { socio: "ARLET", tipo: "retiro", monto: "50.00", fecha: "2026-05-20", descripcion: "Bolígrafo" },
  { socio: "ARLET", tipo: "retiro", monto: "10.00", fecha: "2026-06-03", descripcion: "Dinero personal" },
  { socio: "ARLET", tipo: "retiro", monto: "3000.00", fecha: "2026-06-16", descripcion: "A Binance Naudy" },
  // Retiro posterior al cierre negativo de julio (sale de la base de agosto).
  { socio: "ARLET", tipo: "retiro", monto: "5000.00", fecha: "2026-08-01", descripcion: "Maquina retroexcavadora de china" },
];

export interface RendHistorico {
  anio: number;
  mes: number;
  modo: "porcentaje" | "monto" | "saldo_final";
  valor: string;
  enCurso?: boolean;
  tasaTwr?: string;
  descripcion?: string;
}

export const RENDIMIENTOS: RendHistorico[] = [
  { anio: 2024, mes: 9, modo: "saldo_final", valor: "19370.00", descripcion: "Inicio del fondo" },
  { anio: 2024, mes: 10, modo: "saldo_final", valor: "19074.00", descripcion: "Mes negativo" },
  { anio: 2024, mes: 11, modo: "saldo_final", valor: "23674.00", descripcion: "Buen mes" },
  { anio: 2024, mes: 12, modo: "saldo_final", valor: "24119.00", descripcion: "Mes negativo / aporte Railen 1.000" },
  { anio: 2025, mes: 1, modo: "saldo_final", valor: "23762.00", descripcion: "Mes negativo" },
  { anio: 2025, mes: 2, modo: "saldo_final", valor: "18758.35", descripcion: "Sale Railen con su saldo exacto" },
  { anio: 2025, mes: 3, modo: "saldo_final", valor: "23832.00", descripcion: "Arlet compra la cuenta de Railen" },
  { anio: 2025, mes: 4, modo: "saldo_final", valor: "24387.00" },
  { anio: 2025, mes: 5, modo: "saldo_final", valor: "24742.00" },
  { anio: 2025, mes: 6, modo: "saldo_final", valor: "26797.00", descripcion: "Buen mes" },
  { anio: 2025, mes: 7, modo: "saldo_final", valor: "27964.00" },
  { anio: 2025, mes: 8, modo: "saldo_final", valor: "31731.31", descripcion: "Máximo histórico del período" },
  { anio: 2025, mes: 9, modo: "saldo_final", valor: "33622.31", descripcion: "Aporte Arlet 3.000" },
  { anio: 2025, mes: 10, modo: "saldo_final", valor: "45647.00", descripcion: "Ganancia +16,7% + aporte Arlet 5.500" },
  // Nota: el cuadro trae 55,586.33 pero los socios suman 55,586.32 (mandan los socios).
  { anio: 2025, mes: 11, modo: "saldo_final", valor: "55586.32", descripcion: "Ganancia +21,8%" },
  { anio: 2025, mes: 12, modo: "saldo_final", valor: "59997.38", descripcion: "Ganancia +6,6% / aporte Arlet 700" },
  { anio: 2026, mes: 1, modo: "saldo_final", valor: "65666.48", descripcion: "Ganancia +6% / aporte Arlet 2.902,60 / retiro 800 Lenin" },
  { anio: 2026, mes: 2, modo: "saldo_final", valor: "64217.29", descripcion: "Pérdida -2,21%" },
  { anio: 2026, mes: 3, modo: "saldo_final", valor: "69817.32", descripcion: "Ganancia +8,89% / retiro 100 Lenin" },
  {
    anio: 2026, mes: 4, modo: "saldo_final", valor: "81348.91", tasaTwr: "-13.98",
    descripcion: "Pérdida -13,98% cap. previo; depósito Arlet 24.760,18 (29-abr) solo -1,5%",
  },
  { anio: 2026, mes: 5, modo: "saldo_final", valor: "74556.83", descripcion: "Pérdida -3,12% / retiros Arlet 4.391" },
  { anio: 2026, mes: 6, modo: "saldo_final", valor: "77199.02", descripcion: "Ganancia +7,9% / retiros Arlet 3.010" },
  { anio: 2026, mes: 7, modo: "porcentaje", valor: "-7.8", descripcion: "Pérdida -7,8% (cierre definitivo; al 09/07 iba +6,6 flotante)" },
  { anio: 2026, mes: 8, modo: "porcentaje", valor: "-5.54", enCurso: true, descripcion: "Mes en curso al 07/08/2026: resultado flotante / retiro Arlet 5.000" },
];

export interface OverrideHistorico {
  socio: string;
  anio: number;
  mes: number;
  saldoFinal: string;
}

/** Saldos por socio del CUADRO HISTORICO (reparto negociado sep-24 → abr-26).
 *  Railen solo hasta ene-25: su salida (feb-25) y los meses siguientes los
 *  deriva el motor (queda en 0). may-26 y jun-26 son proporcionales puros. */
export const OVERRIDES: OverrideHistorico[] = [
  { socio: "LENIN", anio: 2024, mes: 9, saldoFinal: "6927.81" },
  { socio: "ARLET", anio: 2024, mes: 9, saldoFinal: "9048.19" },
  { socio: "RAILEN", anio: 2024, mes: 9, saldoFinal: "3394.00" },
  { socio: "LENIN", anio: 2024, mes: 10, saldoFinal: "6821.96" },
  { socio: "ARLET", anio: 2024, mes: 10, saldoFinal: "8909.99" },
  { socio: "RAILEN", anio: 2024, mes: 10, saldoFinal: "3342.05" },
  { socio: "LENIN", anio: 2024, mes: 11, saldoFinal: "8466.92" },
  { socio: "ARLET", anio: 2024, mes: 11, saldoFinal: "11057.73" },
  { socio: "RAILEN", anio: 2024, mes: 11, saldoFinal: "4149.35" },
  { socio: "LENIN", anio: 2024, mes: 12, saldoFinal: "8284.83" },
  { socio: "ARLET", anio: 2024, mes: 12, saldoFinal: "10815.19" },
  { socio: "RAILEN", anio: 2024, mes: 12, saldoFinal: "5018.98" },
  { socio: "LENIN", anio: 2025, mes: 1, saldoFinal: "8167.27" },
  { socio: "ARLET", anio: 2025, mes: 1, saldoFinal: "10658.65" },
  { socio: "RAILEN", anio: 2025, mes: 1, saldoFinal: "4936.08" },
  { socio: "LENIN", anio: 2025, mes: 2, saldoFinal: "8138.29" },
  { socio: "ARLET", anio: 2025, mes: 2, saldoFinal: "10620.06" },
  { socio: "LENIN", anio: 2025, mes: 3, saldoFinal: "8193.27" },
  { socio: "ARLET", anio: 2025, mes: 3, saldoFinal: "15638.73" },
  { socio: "LENIN", anio: 2025, mes: 4, saldoFinal: "8386.41" },
  { socio: "ARLET", anio: 2025, mes: 4, saldoFinal: "16000.59" },
  { socio: "LENIN", anio: 2025, mes: 5, saldoFinal: "8509.95" },
  { socio: "ARLET", anio: 2025, mes: 5, saldoFinal: "16232.05" },
  { socio: "LENIN", anio: 2025, mes: 6, saldoFinal: "9225.09" },
  { socio: "ARLET", anio: 2025, mes: 6, saldoFinal: "17571.91" },
  { socio: "LENIN", anio: 2025, mes: 7, saldoFinal: "9631.21" },
  { socio: "ARLET", anio: 2025, mes: 7, saldoFinal: "18332.79" },
  { socio: "LENIN", anio: 2025, mes: 8, saldoFinal: "10942.23" },
  { socio: "ARLET", anio: 2025, mes: 8, saldoFinal: "20789.08" },
  { socio: "LENIN", anio: 2025, mes: 9, saldoFinal: "10556.30" },
  { socio: "ARLET", anio: 2025, mes: 9, saldoFinal: "23066.01" },
  { socio: "LENIN", anio: 2025, mes: 10, saldoFinal: "12338.19" },
  { socio: "ARLET", anio: 2025, mes: 10, saldoFinal: "33308.81" },
  { socio: "LENIN", anio: 2025, mes: 11, saldoFinal: "15052.62" },
  { socio: "ARLET", anio: 2025, mes: 11, saldoFinal: "40533.70" },
  { socio: "LENIN", anio: 2025, mes: 12, saldoFinal: "16053.87" },
  { socio: "ARLET", anio: 2025, mes: 12, saldoFinal: "43943.51" },
  { socio: "LENIN", anio: 2026, mes: 1, saldoFinal: "16176.16" },
  { socio: "ARLET", anio: 2026, mes: 1, saldoFinal: "49490.32" },
  { socio: "LENIN", anio: 2026, mes: 2, saldoFinal: "15801.40" },
  { socio: "ARLET", anio: 2026, mes: 2, saldoFinal: "48415.89" },
  { socio: "LENIN", anio: 2026, mes: 3, saldoFinal: "17169.16" },
  { socio: "ARLET", anio: 2026, mes: 3, saldoFinal: "52648.16" },
  { socio: "LENIN", anio: 2026, mes: 4, saldoFinal: "14768.91" },
  { socio: "ARLET", anio: 2026, mes: 4, saldoFinal: "66580.00" },
];

export interface EsperadoMes {
  anio: number;
  mes: number;
  fondo: number;
  LENIN: number;
  ARLET: number;
  RAILEN: number;
}

/** Tabla de verificación (CUADRO HISTORICO): el seed --check compara la cadena
 *  derivada contra estos valores AL CENTAVO. */
export const ESPERADO: EsperadoMes[] = [
  { anio: 2024, mes: 9, fondo: 19370.0, LENIN: 6927.81, ARLET: 9048.19, RAILEN: 3394.0 },
  { anio: 2024, mes: 10, fondo: 19074.0, LENIN: 6821.96, ARLET: 8909.99, RAILEN: 3342.05 },
  { anio: 2024, mes: 11, fondo: 23674.0, LENIN: 8466.92, ARLET: 11057.73, RAILEN: 4149.35 },
  { anio: 2024, mes: 12, fondo: 24119.0, LENIN: 8284.83, ARLET: 10815.19, RAILEN: 5018.98 },
  { anio: 2025, mes: 1, fondo: 23762.0, LENIN: 8167.27, ARLET: 10658.65, RAILEN: 4936.08 },
  { anio: 2025, mes: 2, fondo: 18758.35, LENIN: 8138.29, ARLET: 10620.06, RAILEN: 0 },
  { anio: 2025, mes: 3, fondo: 23832.0, LENIN: 8193.27, ARLET: 15638.73, RAILEN: 0 },
  { anio: 2025, mes: 4, fondo: 24387.0, LENIN: 8386.41, ARLET: 16000.59, RAILEN: 0 },
  { anio: 2025, mes: 5, fondo: 24742.0, LENIN: 8509.95, ARLET: 16232.05, RAILEN: 0 },
  { anio: 2025, mes: 6, fondo: 26797.0, LENIN: 9225.09, ARLET: 17571.91, RAILEN: 0 },
  { anio: 2025, mes: 7, fondo: 27964.0, LENIN: 9631.21, ARLET: 18332.79, RAILEN: 0 },
  { anio: 2025, mes: 8, fondo: 31731.31, LENIN: 10942.23, ARLET: 20789.08, RAILEN: 0 },
  { anio: 2025, mes: 9, fondo: 33622.31, LENIN: 10556.3, ARLET: 23066.01, RAILEN: 0 },
  { anio: 2025, mes: 10, fondo: 45647.0, LENIN: 12338.19, ARLET: 33308.81, RAILEN: 0 },
  { anio: 2025, mes: 11, fondo: 55586.32, LENIN: 15052.62, ARLET: 40533.7, RAILEN: 0 },
  { anio: 2025, mes: 12, fondo: 59997.38, LENIN: 16053.87, ARLET: 43943.51, RAILEN: 0 },
  { anio: 2026, mes: 1, fondo: 65666.48, LENIN: 16176.16, ARLET: 49490.32, RAILEN: 0 },
  { anio: 2026, mes: 2, fondo: 64217.29, LENIN: 15801.4, ARLET: 48415.89, RAILEN: 0 },
  { anio: 2026, mes: 3, fondo: 69817.32, LENIN: 17169.16, ARLET: 52648.16, RAILEN: 0 },
  { anio: 2026, mes: 4, fondo: 81348.91, LENIN: 14768.91, ARLET: 66580.0, RAILEN: 0 },
  { anio: 2026, mes: 5, fondo: 74556.83, LENIN: 14308.12, ARLET: 60248.71, RAILEN: 0 },
  { anio: 2026, mes: 6, fondo: 77199.02, LENIN: 15438.46, ARLET: 61760.56, RAILEN: 0 },
  { anio: 2026, mes: 7, fondo: 71177.5, LENIN: 14234.26, ARLET: 56943.24, RAILEN: 0 },
  { anio: 2026, mes: 8, fondo: 62511.27, LENIN: 13445.68, ARLET: 49065.59, RAILEN: 0 },
];

/** TWR desde el inicio esperado, en %, con el flotante de agosto. */
export const TWR_ESPERADO_PCT = 129.63;
export const TWR_2026_ESPERADO_PCT = -11.82;

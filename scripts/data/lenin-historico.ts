/**
 * Transcripción del "Reporte Ejecutivo — Lenin Rodríguez" (Excel) a constantes.
 *
 * Cuenta INDIVIDUAL con condiciones propias: reparto 66.66/33.33 (comisión
 * 33.333%) y política "deficit_pnl" (las pérdidas crean déficit en PNL; el
 * operador no cobra hasta recuperarlo).
 *
 * FIDELIDAD: cada mes se importa como modo `saldo_final` = CAPITAL FINAL del
 * Excel (los flujos internos del operador —préstamo $1,500 nov-24, abono $275
 * may-25 y retenciones de fase de deuda— quedan absorbidos por el saldo).
 * Los movimientos registrados son SOLO los retiros del inversor (Σ = 3,258.00,
 * igual al "Total Retirado (Inversor)" del reporte).
 *
 * El déficit PNL pendiente al corte (jul-2026, mes en proceso) es 778.23:
 * el motor lo deriva de la propia cadena y el --check lo exige.
 */

export const CLIENTE = {
  nombre: "Lenin Rodríguez",
  // Placeholder: sin login todavía (no hay correo en el reporte). Al darle
  // acceso real, edita el correo en Admin → Clientes.
  email: "lenin.rodriguez@bitacora.local",
  fechaIngreso: "2024-11-01",
  capitalInicial: "3000.00",
  comisionPct: "33.333",
  politicaComision: "deficit_pnl" as const,
  notas:
    "Cuenta 66.66/33.33 con déficit PNL (el operador no cobra hasta recuperar pérdidas). Historial importado del Reporte Ejecutivo (nov-2024 → jul-2026).",
};

export const MOVIMIENTOS = [
  { tipo: "retiro", monto: "400.00", fecha: "2024-11-15", descripcion: "Retiro del inversor" },
  { tipo: "retiro", monto: "202.00", fecha: "2025-06-15", descripcion: "Nelly" },
  { tipo: "retiro", monto: "200.00", fecha: "2025-08-15", descripcion: "Nelly" },
  { tipo: "retiro", monto: "300.00", fecha: "2025-11-15", descripcion: "Nelly" },
  { tipo: "retiro", monto: "150.00", fecha: "2026-01-15", descripcion: "Nelly" },
  { tipo: "retiro", monto: "650.00", fecha: "2026-02-10", descripcion: "1era cuota de programación" },
  { tipo: "retiro", monto: "678.00", fecha: "2026-03-15", descripcion: "2da cuota de programación" },
  { tipo: "retiro", monto: "678.00", fecha: "2026-04-13", descripcion: "3era cuota academia de programación" },
] as const;

/** CAPITAL FINAL por mes (columna del Excel), importado como saldo_final. */
export const RENDIMIENTOS = [
  { anio: 2024, mes: 11, valor: "4100.00", descripcion: "Inicio de la cuenta (PNL +3,000; préstamo operador $1,500)" },
  { anio: 2024, mes: 12, valor: "4141.00", descripcion: null },
  { anio: 2025, mes: 1, valor: "3988.00", descripcion: "Mes negativo (−153)" },
  { anio: 2025, mes: 2, valor: "3935.00", descripcion: "Mes negativo (−53)" },
  { anio: 2025, mes: 3, valor: "3993.00", descripcion: null },
  { anio: 2025, mes: 4, valor: "3993.00", descripcion: "No se operó en esta cuenta" },
  { anio: 2025, mes: 5, valor: "4401.00", descripcion: "Abono deuda de Orlando (+$275)" },
  { anio: 2025, mes: 6, valor: "4709.00", descripcion: null },
  { anio: 2025, mes: 7, valor: "5063.33", descripcion: "Deuda del operador saldada; primer retiro limpio" },
  { anio: 2025, mes: 8, valor: "5390.97", descripcion: null },
  { anio: 2025, mes: 9, valor: "5390.97", descripcion: "Error sistema (copytrading falló): PNL 0" },
  { anio: 2025, mes: 10, valor: "5711.86", descripcion: null },
  { anio: 2025, mes: 11, valor: "6319.58", descripcion: "PNL bruto +1,361.58" },
  { anio: 2025, mes: 12, valor: "6641.10", descripcion: null },
  { anio: 2026, mes: 1, valor: "6833.85", descripcion: null },
  { anio: 2026, mes: 2, valor: "5996.31", descripcion: "Pérdida −187.54; inicia déficit" },
  { anio: 2026, mes: 3, valor: "5585.89", descripcion: "Recupera déficit y cobra sobre 120.07" },
  { anio: 2026, mes: 4, valor: "4126.99", descripcion: "Pérdida −13.98% + retiro academia" },
  { anio: 2026, mes: 5, valor: "3996.57", descripcion: "Pérdida −130.42" },
  { anio: 2026, mes: 6, valor: "4129.66", descripcion: "Recuperación +3.33% (recupera parte del déficit; quedan 778.23)" },
  { anio: 2026, mes: 7, valor: "4129.66", descripcion: "Mes en curso (en proceso)" },
] as const;

/** Verificación: saldo final por mes + déficit PNL esperado al cierre del mes. */
export const ESPERADO: ReadonlyArray<{
  anio: number;
  mes: number;
  saldoFinal: number;
  deficit?: number;
}> = [
  { anio: 2024, mes: 11, saldoFinal: 4100.0 },
  { anio: 2024, mes: 12, saldoFinal: 4141.0 },
  { anio: 2025, mes: 1, saldoFinal: 3988.0, deficit: 153.0 },
  { anio: 2025, mes: 2, saldoFinal: 3935.0, deficit: 206.0 },
  { anio: 2025, mes: 3, saldoFinal: 3993.0, deficit: 148.0 },
  { anio: 2025, mes: 4, saldoFinal: 3993.0, deficit: 148.0 },
  { anio: 2025, mes: 5, saldoFinal: 4401.0 },
  { anio: 2025, mes: 6, saldoFinal: 4709.0, deficit: 0 },
  { anio: 2025, mes: 7, saldoFinal: 5063.33, deficit: 0 },
  { anio: 2025, mes: 8, saldoFinal: 5390.97 },
  { anio: 2025, mes: 9, saldoFinal: 5390.97 },
  { anio: 2025, mes: 10, saldoFinal: 5711.86 },
  { anio: 2025, mes: 11, saldoFinal: 6319.58 },
  { anio: 2025, mes: 12, saldoFinal: 6641.1 },
  { anio: 2026, mes: 1, saldoFinal: 6833.85, deficit: 0 },
  { anio: 2026, mes: 2, saldoFinal: 5996.31, deficit: 187.54 },
  { anio: 2026, mes: 3, saldoFinal: 5585.89, deficit: 0 },
  { anio: 2026, mes: 4, saldoFinal: 4126.99, deficit: 780.9 },
  { anio: 2026, mes: 5, saldoFinal: 3996.57, deficit: 911.32 },
  { anio: 2026, mes: 6, saldoFinal: 4129.66, deficit: 778.23 },
  { anio: 2026, mes: 7, saldoFinal: 4129.66, deficit: 778.23 },
];

export const TOTAL_RETIRADO_ESPERADO = 3258.0; // "Total Retirado (Inversor)"
export const SALDO_ACTUAL_ESPERADO = 4129.66; // "CAPITAL FINAL ACTUAL"
export const DEFICIT_PENDIENTE_ESPERADO = 778.23;

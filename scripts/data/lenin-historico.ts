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
 * Cada mes lleva además `resultadoComisionable` = PNL BRUTO del mes, tomado de
 * la columna "Resultado del Mes (PNL)" del Excel. Con eso el motor reproduce el
 * déficit y la "Ganancia Operador (33%)" del propio reporte: las pérdidas
 * alimentan el déficit, las ganancias lo recuperan primero y solo el excedente
 * paga comisión. Sin ese dato el portal mostraba $0 de comisión en esta cuenta,
 * porque un mes en modo `saldo_final` no tiene de dónde derivarla.
 *
 * OJO con julio y agosto de 2026: aquel Excel es anterior al cierre. Trae una
 * fila de julio con PNL 0 y saldo 4.129,66 ("en proceso") que YA NO es válida —
 * julio terminó en 2.900,00 — y no trae agosto. Por eso el PNL de esos dos meses
 * se deriva de los saldos reales: jul 4.129,66 → 2.900,00 = −1.229,66; ago,
 * retiro total de 2.900, PNL 0.
 */

export const CLIENTE = {
  nombre: "Lenin Rodríguez",
  email: "leninrpetit@gmail.com",
  fechaIngreso: "2024-11-01",
  capitalInicial: "3000.00",
  comisionPct: "33.333",
  politicaComision: "deficit_pnl" as const,
  /** Los saldos importados son el CAPITAL FINAL del cliente: el operador ya
   *  retiró su parte de la cuenta, así que vienen NETOS. La comisión se devenga
   *  para dejar constancia, pero no puede volver a restarse del saldo. */
  tratamientoComision: "ya_retirada" as const,
  estado: "inactivo" as const, // se retiró totalmente en ago-2026
  notas:
    "Cuenta 66.66/33.33 con déficit PNL (el operador no cobra hasta recuperar pérdidas). Historial nov-2024 → ago-2026. CERRADA: retiro total de $2,900.00 el 07-ago-2026.",
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
  { tipo: "retiro", monto: "2900.00", fecha: "2026-08-07", descripcion: "Retiro total — cierre de la cuenta" },
] as const;

/** CAPITAL FINAL por mes (columna del Excel), importado como saldo_final. */
export const RENDIMIENTOS = [
  { anio: 2024, mes: 11, valor: "4100.00", descripcion: "Inicio de la cuenta (PNL +3,000; préstamo operador $1,500)" , resultadoComisionable: "3000.00" },
  { anio: 2024, mes: 12, valor: "4141.00", descripcion: null , resultadoComisionable: "41.00" },
  { anio: 2025, mes: 1, valor: "3988.00", descripcion: "Mes negativo (−153)" , resultadoComisionable: "-153.00" },
  { anio: 2025, mes: 2, valor: "3935.00", descripcion: "Mes negativo (−53)" , resultadoComisionable: "-53.00" },
  { anio: 2025, mes: 3, valor: "3993.00", descripcion: null , resultadoComisionable: "58.00" },
  { anio: 2025, mes: 4, valor: "3993.00", descripcion: "No se operó en esta cuenta" , resultadoComisionable: "0.00" },
  { anio: 2025, mes: 5, valor: "4401.00", descripcion: "Abono deuda de Orlando (+$275)" , resultadoComisionable: "133.00" },
  { anio: 2025, mes: 6, valor: "4709.00", descripcion: null , resultadoComisionable: "510.00" },
  { anio: 2025, mes: 7, valor: "5063.33", descripcion: "Deuda del operador saldada; primer retiro limpio" , resultadoComisionable: "462.00" },
  { anio: 2025, mes: 8, valor: "5390.97", descripcion: null , resultadoComisionable: "791.46" },
  { anio: 2025, mes: 9, valor: "5390.97", descripcion: "Error sistema (copytrading falló): PNL 0" , resultadoComisionable: "0.00" },
  { anio: 2025, mes: 10, valor: "5711.86", descripcion: null , resultadoComisionable: "481.33" },
  { anio: 2025, mes: 11, valor: "6319.58", descripcion: "PNL bruto +1,361.58" , resultadoComisionable: "1361.58" },
  { anio: 2025, mes: 12, valor: "6641.10", descripcion: null , resultadoComisionable: "482.28" },
  { anio: 2026, mes: 1, valor: "6833.85", descripcion: null , resultadoComisionable: "514.12" },
  { anio: 2026, mes: 2, valor: "5996.31", descripcion: "Pérdida −187.54; inicia déficit" , resultadoComisionable: "-187.54" },
  { anio: 2026, mes: 3, valor: "5585.89", descripcion: "Recupera déficit y cobra sobre 120.07" , resultadoComisionable: "307.61" },
  { anio: 2026, mes: 4, valor: "4126.99", descripcion: "Pérdida −13.98% + retiro academia" , resultadoComisionable: "-780.91" },
  { anio: 2026, mes: 5, valor: "3996.57", descripcion: "Pérdida −130.41" , resultadoComisionable: "-130.41" },
  { anio: 2026, mes: 6, valor: "4129.66", descripcion: "Recuperación +3.33% (recupera parte del déficit; quedan 778.23)" , resultadoComisionable: "133.09" },
  { anio: 2026, mes: 7, valor: "2900.00", descripcion: "Pérdida del mes (−1,229.66); último período operado" , resultadoComisionable: "-1229.66" },
] as const;

/** Verificación: saldo final por mes + déficit PNL esperado al cierre del mes. */
export const ESPERADO: ReadonlyArray<{
  anio: number;
  mes: number;
  saldoFinal: number;
  deficit?: number;
  comision: number;
}> = [
  { anio: 2024, mes: 11, saldoFinal: 4100.0 , comision: 999.99 },
  { anio: 2024, mes: 12, saldoFinal: 4141.0 , comision: 13.67 },
  { anio: 2025, mes: 1, saldoFinal: 3988.0, deficit: 153.0 , comision: 0.0 },
  { anio: 2025, mes: 2, saldoFinal: 3935.0, deficit: 206.0 , comision: 0.0 },
  { anio: 2025, mes: 3, saldoFinal: 3993.0, deficit: 148.0 , comision: 0.0 },
  { anio: 2025, mes: 4, saldoFinal: 3993.0, deficit: 148.0 , comision: 0.0 },
  { anio: 2025, mes: 5, saldoFinal: 4401.0 , comision: 0.0 },
  { anio: 2025, mes: 6, saldoFinal: 4709.0, deficit: 0 , comision: 165.0 },
  { anio: 2025, mes: 7, saldoFinal: 5063.33, deficit: 0 , comision: 154.0 },
  { anio: 2025, mes: 8, saldoFinal: 5390.97 , comision: 263.82 },
  { anio: 2025, mes: 9, saldoFinal: 5390.97 , comision: 0.0 },
  { anio: 2025, mes: 10, saldoFinal: 5711.86 , comision: 160.44 },
  { anio: 2025, mes: 11, saldoFinal: 6319.58 , comision: 453.86 },
  { anio: 2025, mes: 12, saldoFinal: 6641.1 , comision: 160.76 },
  { anio: 2026, mes: 1, saldoFinal: 6833.85, deficit: 0 , comision: 171.37 },
  { anio: 2026, mes: 2, saldoFinal: 5996.31, deficit: 187.54 , comision: 0.0 },
  { anio: 2026, mes: 3, saldoFinal: 5585.89, deficit: 0 , comision: 40.02 },
  { anio: 2026, mes: 4, saldoFinal: 4126.99, deficit: 780.91, comision: 0.0 }, // 780,91 es el valor del Excel; el 780,90 anterior se derivaba del neto, no del PNL
  { anio: 2026, mes: 5, saldoFinal: 3996.57, deficit: 911.32 , comision: 0.0 },
  { anio: 2026, mes: 6, saldoFinal: 4129.66, deficit: 778.23 , comision: 0.0 },
  { anio: 2026, mes: 7, saldoFinal: 2900.0, deficit: 2007.89 , comision: 0.0 },
  { anio: 2026, mes: 8, saldoFinal: 0, deficit: 2007.89 , comision: 0.0 }, // retiro total; cuenta cerrada
];

export const TOTAL_RETIRADO_ESPERADO = 6158.0; // 3,258 + retiro final 2,900
export const SALDO_ACTUAL_ESPERADO = 0; // cuenta cerrada (ago-2026)
export const DEFICIT_PENDIENTE_ESPERADO = 2007.89;
/** Lo que el operador ganó con esta cuenta en toda su vida. El Excel original
 *  suma 2.582,94 aplicando exactamente 1/3; aquí sale 2,582.93 porque la
 *  comisión del cliente está guardada como 33,333% (el campo admite 3 decimales).
 *  La diferencia es de 0.01 y viene toda de nov-2024. */
export const COMISION_OPERADOR_ESPERADA = 2582.93;

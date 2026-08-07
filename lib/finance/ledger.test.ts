import { describe, it, expect } from "vitest";
import {
  construirCadena,
  estadisticas,
  resumen,
  resumenPorAnio,
  roiAnual,
  roiAcumulado,
  round2,
  num,
  type LedgerConfig,
  type MesLedger,
} from "./ledger";

const CFG_DEFAULT: LedgerConfig = {
  comisionPct: 35,
  usaHighWaterMark: false,
  pierdeSoloCliente: true,
};

const mes = (meses: MesLedger[], key: string): MesLedger => {
  const m = meses.find((x) => x.key === key);
  if (!m) throw new Error(`mes ${key} no encontrado`);
  return m;
};

describe("round2 (HALF_UP, robusto contra coma flotante)", () => {
  it("redondea correctamente los casos clásicos de coma flotante", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(608.176)).toBe(608.18);
    expect(round2(212.863)).toBe(212.86);
  });
  it("empates se alejan de cero (HALF_UP simétrico)", () => {
    expect(round2(2.5 / 100)).toBe(0.03); // 0.025 → 0.03
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(-0.125)).toBe(-0.13);
  });
  it("normaliza -0 a 0", () => {
    expect(Object.is(round2(-0.0001), 0)).toBe(true);
  });
  it("magnitudes sub-micro y extremas devuelven número finito (nunca NaN)", () => {
    expect(round2(1e-7)).toBe(0);
    expect(round2(-1e-7)).toBe(0);
    expect(round2(1.7763568394002505e-15)).toBe(0); // residuo típico de coma flotante
    expect(round2(1e-6)).toBe(0);
    expect(Number.isFinite(round2(1e21))).toBe(true);
  });
});

describe("HWM: residuo de coma flotante no produce NaN (regresión)", () => {
  const meses = construirCadena({
    capitalInicial: 9.53,
    fechaIngreso: "2024-01-01",
    rendimientos: [
      { anio: 2024, mes: 1, modo: "saldo_final", valor: 7.04 }, // pérdida
      { anio: 2024, mes: 2, modo: "monto", valor: 2.49 }, // base 7.04 + 2.49 == pico 9.53
    ],
    movimientos: [],
    config: { ...CFG_DEFAULT, usaHighWaterMark: true },
  });
  it("feb: base+bruto coincide con el pico ⇒ comisión 0 y saldo 9.53 (no NaN)", () => {
    const m = mes(meses, "2024-02");
    expect(Number.isNaN(m.comision)).toBe(false);
    expect(m.comision).toBe(0);
    expect(m.saldoFinal).toBe(9.53);
    expect(Number.isFinite(m.hwm)).toBe(true);
  });
});

describe("num (parseo seguro de numeric de Postgres)", () => {
  it("convierte strings y maneja nulos", () => {
    expect(num("10000.00")).toBe(10000);
    expect(num("15204.40")).toBe(15204.4);
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num("")).toBe(0);
    expect(num(42)).toBe(42);
  });
});

describe("§5.4 — caso verificable canónico (HWM off, comisión 35%)", () => {
  const meses = construirCadena({
    capitalInicial: 10000,
    fechaIngreso: "2024-09-01",
    rendimientos: [
      { anio: 2024, mes: 9, modo: "porcentaje", valor: 8 },
      { anio: 2024, mes: 10, modo: "porcentaje", valor: -3 },
      { anio: 2024, mes: 11, modo: "porcentaje", valor: 4 },
    ],
    movimientos: [
      { tipo: "deposito", monto: 5000, fecha: "2024-11-15", descripcion: "Aporte adicional" },
    ],
    config: CFG_DEFAULT,
  });

  it("genera exactamente 3 meses continuos", () => {
    expect(meses.map((m) => m.key)).toEqual(["2024-09", "2024-10", "2024-11"]);
  });

  it("sep-24: base 10,000 → bruto 800 → comisión 280 → neto 520 → saldo 10,520 (+5.20%)", () => {
    const m = mes(meses, "2024-09");
    expect(m.saldoInicial).toBe(10000);
    expect(m.baseOperativa).toBe(10000);
    expect(m.rendBruto).toBe(800);
    expect(m.comision).toBe(280);
    expect(m.rendNeto).toBe(520);
    expect(m.saldoFinal).toBe(10520);
    expect(round2(m.roiMes * 100)).toBe(5.2);
  });

  it("oct-24: base 10,520 → bruto -315.60 → comisión 0 → saldo 10,204.40 (-3.00%)", () => {
    const m = mes(meses, "2024-10");
    expect(m.baseOperativa).toBe(10520);
    expect(m.rendBruto).toBe(-315.6);
    expect(m.comision).toBe(0);
    expect(m.rendNeto).toBe(-315.6);
    expect(m.saldoFinal).toBe(10204.4);
    expect(round2(m.roiMes * 100)).toBe(-3);
  });

  it("nov-24: +5,000 dep → base 15,204.40 → bruto 608.18 → comisión 212.86 → saldo 15,599.72 (+2.60%)", () => {
    const m = mes(meses, "2024-11");
    expect(m.depositos).toBe(5000);
    expect(m.baseOperativa).toBe(15204.4);
    expect(m.rendBruto).toBe(608.18);
    expect(m.comision).toBe(212.86);
    expect(m.rendNeto).toBe(395.32);
    expect(m.saldoFinal).toBe(15599.72);
    expect(round2(m.roiMes * 100)).toBe(2.6);
  });

  it("resumen agregado del caso §5.4", () => {
    const r = resumen(meses, 10000);
    expect(r.saldoActual).toBe(15599.72);
    expect(r.totalDepositos).toBe(5000);
    expect(r.totalRetiros).toBe(0);
    expect(r.aporteNeto).toBe(15000);
    expect(r.comisionOperador).toBe(280 + 0 + 212.86); // 492.86
    expect(r.gananciaNeta).toBe(round2(520 - 315.6 + 395.32)); // 599.72
    // ROI acumulado = (1.052)(0.97)(1.026) − 1
    expect(round2(r.roiAcumulado * 100)).toBe(
      round2(((1.052 * 0.97 * 1.026) - 1) * 100),
    );
  });

  it("ROI anual 2024 = Π(1+roi_mes) − 1", () => {
    const esperado = 1.052 * 0.97 * 1.026 - 1;
    expect(round2(roiAnual(meses, 2024) * 100)).toBe(round2(esperado * 100));
    expect(round2(roiAcumulado(meses) * 100)).toBe(round2(esperado * 100));
  });
});

describe("modo 'monto' — rendimiento bruto directo en USD", () => {
  const meses = construirCadena({
    capitalInicial: 10000,
    fechaIngreso: "2024-09-01",
    rendimientos: [{ anio: 2024, mes: 9, modo: "monto", valor: 800 }],
    movimientos: [],
    config: CFG_DEFAULT,
  });
  it("monto 800 → comisión 280 → neto 520 → saldo 10,520", () => {
    const m = mes(meses, "2024-09");
    expect(m.rendBruto).toBe(800);
    expect(m.comision).toBe(280);
    expect(m.rendNeto).toBe(520);
    expect(m.saldoFinal).toBe(10520);
  });
});

describe("modo 'saldo_final' — el operador escribe el saldo neto directamente", () => {
  const meses = construirCadena({
    capitalInicial: 10000,
    fechaIngreso: "2024-09-01",
    rendimientos: [{ anio: 2024, mes: 9, modo: "saldo_final", valor: 10500 }],
    movimientos: [],
    config: CFG_DEFAULT,
  });
  it("saldo_final 10,500 → comisión 0, neto 500, roi +5%", () => {
    const m = mes(meses, "2024-09");
    expect(m.saldoFinal).toBe(10500);
    expect(m.rendNeto).toBe(500);
    expect(m.comision).toBe(0);
    expect(round2(m.roiMes * 100)).toBe(5);
  });
});

describe("retiros de capital", () => {
  const meses = construirCadena({
    capitalInicial: 10000,
    fechaIngreso: "2024-09-01",
    rendimientos: [{ anio: 2024, mes: 10, modo: "porcentaje", valor: 10 }],
    movimientos: [{ tipo: "retiro", monto: 2000, fecha: "2024-09-10" }],
    config: CFG_DEFAULT,
  });
  it("sep: retiro 2,000 sin rendimiento → saldo 8,000", () => {
    const m = mes(meses, "2024-09");
    expect(m.retiros).toBe(2000);
    expect(m.baseOperativa).toBe(8000);
    expect(m.saldoFinal).toBe(8000);
  });
  it("oct: base 8,000 → +10% → comisión 280 → saldo 8,520", () => {
    const m = mes(meses, "2024-10");
    expect(m.baseOperativa).toBe(8000);
    expect(m.rendBruto).toBe(800);
    expect(m.comision).toBe(280);
    expect(m.saldoFinal).toBe(8520);
  });
});

describe("base operativa = 0 (sin división por cero)", () => {
  const meses = construirCadena({
    capitalInicial: 5000,
    fechaIngreso: "2024-09-01",
    rendimientos: [{ anio: 2024, mes: 10, modo: "porcentaje", valor: 10 }],
    movimientos: [{ tipo: "retiro", monto: 5000, fecha: "2024-09-05" }],
    config: CFG_DEFAULT,
  });
  it("sep: base 0 → saldo 0, roi 0", () => {
    const m = mes(meses, "2024-09");
    expect(m.baseOperativa).toBe(0);
    expect(m.saldoFinal).toBe(0);
    expect(m.roiMes).toBe(0);
  });
  it("oct: base 0 → bruto 0 → roi 0 (no NaN/Infinity)", () => {
    const m = mes(meses, "2024-10");
    expect(m.baseOperativa).toBe(0);
    expect(m.rendBruto).toBe(0);
    expect(m.roiMes).toBe(0);
    expect(Number.isFinite(m.roiMes)).toBe(true);
  });
});

describe("mes de pérdida: comisión = 0 (pierde_solo_cliente = true)", () => {
  const meses = construirCadena({
    capitalInicial: 10000,
    fechaIngreso: "2024-09-01",
    rendimientos: [{ anio: 2024, mes: 9, modo: "porcentaje", valor: -5 }],
    movimientos: [],
    config: CFG_DEFAULT,
  });
  it("-5% → bruto -500, comisión 0, saldo 9,500", () => {
    const m = mes(meses, "2024-09");
    expect(m.rendBruto).toBe(-500);
    expect(m.comision).toBe(0);
    expect(m.rendNeto).toBe(-500);
    expect(m.saldoFinal).toBe(9500);
  });
});

describe("pierde_solo_cliente = false (el operador comparte la pérdida)", () => {
  const meses = construirCadena({
    capitalInicial: 10000,
    fechaIngreso: "2024-09-01",
    rendimientos: [{ anio: 2024, mes: 9, modo: "porcentaje", valor: -10 }],
    movimientos: [],
    config: { ...CFG_DEFAULT, pierdeSoloCliente: false },
  });
  it("-10% → bruto -1,000, comisión -350 (clawback), neto -650, saldo 9,350", () => {
    const m = mes(meses, "2024-09");
    expect(m.rendBruto).toBe(-1000);
    expect(m.comision).toBe(-350);
    expect(m.rendNeto).toBe(-650);
    expect(m.saldoFinal).toBe(9350);
  });
});

describe("high-water mark ENCENDIDO (recuperación de drawdown sin comisión)", () => {
  const meses = construirCadena({
    capitalInicial: 10000,
    fechaIngreso: "2024-01-01",
    rendimientos: [
      { anio: 2024, mes: 1, modo: "porcentaje", valor: 10 }, // sube
      { anio: 2024, mes: 2, modo: "porcentaje", valor: -20 }, // drawdown
      { anio: 2024, mes: 3, modo: "porcentaje", valor: 10 }, // recupera bajo el pico
      { anio: 2024, mes: 4, modo: "porcentaje", valor: 20 }, // supera el pico
    ],
    movimientos: [],
    config: { ...CFG_DEFAULT, usaHighWaterMark: true },
  });

  it("ene: +10% → comisión 350, saldo 10,650, hwm 10,650", () => {
    const m = mes(meses, "2024-01");
    expect(m.rendBruto).toBe(1000);
    expect(m.comision).toBe(350);
    expect(m.saldoFinal).toBe(10650);
    expect(m.hwm).toBe(10650);
  });
  it("feb: -20% → comisión 0, saldo 8,520, hwm sigue 10,650", () => {
    const m = mes(meses, "2024-02");
    expect(m.rendBruto).toBe(-2130);
    expect(m.comision).toBe(0);
    expect(m.saldoFinal).toBe(8520);
    expect(m.hwm).toBe(10650);
  });
  it("mar: +10% pero bajo el pico → comisión 0, saldo 9,372, hwm sigue 10,650", () => {
    const m = mes(meses, "2024-03");
    expect(m.rendBruto).toBe(852);
    expect(m.comision).toBe(0); // 9,372 < pico 10,650 ⇒ nada facturable
    expect(m.saldoFinal).toBe(9372);
    expect(m.hwm).toBe(10650);
  });
  it("abr: +20% supera el pico → solo se cobra sobre el excedente (596.40)", () => {
    const m = mes(meses, "2024-04");
    expect(m.rendBruto).toBe(1874.4);
    // facturable = preFee(11,246.40) − pico(10,650) = 596.40
    expect(m.comision).toBe(208.74); // 35% de 596.40
    expect(m.rendNeto).toBe(1665.66);
    expect(m.saldoFinal).toBe(11037.66);
    expect(m.hwm).toBe(11037.66);
  });
});

describe("continuidad: meses sin rendimiento se rellenan (sin huecos)", () => {
  const meses = construirCadena({
    capitalInicial: 10000,
    fechaIngreso: "2024-09-01",
    rendimientos: [
      { anio: 2024, mes: 9, modo: "porcentaje", valor: 5 },
      { anio: 2024, mes: 12, modo: "porcentaje", valor: 5 },
    ],
    movimientos: [],
    config: CFG_DEFAULT,
  });
  it("genera sep, oct, nov, dic (4 meses continuos)", () => {
    expect(meses.map((m) => m.key)).toEqual([
      "2024-09",
      "2024-10",
      "2024-11",
      "2024-12",
    ]);
  });
  it("oct y nov tienen rendimiento 0 y conservan el saldo", () => {
    const oct = mes(meses, "2024-10");
    const nov = mes(meses, "2024-11");
    expect(oct.tieneRendimiento).toBe(false);
    expect(oct.rendBruto).toBe(0);
    expect(oct.saldoFinal).toBe(oct.saldoInicial);
    expect(nov.saldoInicial).toBe(oct.saldoFinal);
  });
});

describe("extensión hasta el mes actual con `hasta`", () => {
  it("rellena meses vacíos hasta el mes solicitado", () => {
    const meses = construirCadena({
      capitalInicial: 10000,
      fechaIngreso: "2024-09-01",
      hasta: { anio: 2025, mes: 1 },
      rendimientos: [{ anio: 2024, mes: 9, modo: "porcentaje", valor: 5 }],
      movimientos: [],
      config: CFG_DEFAULT,
    });
    expect(meses.map((m) => m.key)).toEqual([
      "2024-09",
      "2024-10",
      "2024-11",
      "2024-12",
      "2025-01",
    ]);
  });
});

describe("estadisticas — mejor/peor mes y promedios (caso §5.4)", () => {
  const meses = construirCadena({
    capitalInicial: 10000,
    fechaIngreso: "2024-09-01",
    rendimientos: [
      { anio: 2024, mes: 9, modo: "porcentaje", valor: 8 },
      { anio: 2024, mes: 10, modo: "porcentaje", valor: -3 },
      { anio: 2024, mes: 11, modo: "porcentaje", valor: 4 },
    ],
    movimientos: [{ tipo: "deposito", monto: 5000, fecha: "2024-11-15" }],
    config: CFG_DEFAULT,
  });

  it("identifica mejor (sep) y peor (oct) mes y cuenta signos", () => {
    const s = estadisticas(meses);
    expect(s.mejorMes?.key).toBe("2024-09");
    expect(s.peorMes?.key).toBe("2024-10");
    expect(s.mesesPositivos).toBe(2);
    expect(s.mesesNegativos).toBe(1);
    expect(s.mesesConRendimiento).toBe(3);
    const esperado = (0.052 + -315.6 / 10520 + 395.32 / 15204.4) / 3;
    expect(s.promedioRoiMensual).toBeCloseTo(esperado, 12);
  });

  it("cadena vacía de resultados → estadísticas neutras", () => {
    const sinRend = construirCadena({
      capitalInicial: 1000,
      fechaIngreso: "2024-09-01",
      rendimientos: [],
      movimientos: [],
      config: CFG_DEFAULT,
    });
    const s = estadisticas(sinRend);
    expect(s.mejorMes).toBeNull();
    expect(s.promedioRoiMensual).toBe(0);
    expect(s.mesesConRendimiento).toBe(0);
  });
});

/* ══ Política "deficit_pnl" (cuenta Lenin Rodríguez, 66.66/33.33) ══════════ */
describe("política deficit_pnl: déficit sobre PNL, no sobre el saldo", () => {
  const CFG_DEFICIT: LedgerConfig = {
    comisionPct: 33.333,
    usaHighWaterMark: false,
    pierdeSoloCliente: true,
    politica: "deficit_pnl",
  };

  it("feb→mar-26 (Excel real de Lenin): cobra solo sobre el excedente del déficit", () => {
    // feb-26: pérdida −187.54 con retiro 650 (el retiro NO crea déficit).
    // mar-26: +307.61 → recupera 187.54 y cobra 33.333% de 120.07 = 40.02.
    const meses = construirCadena({
      capitalInicial: 6833.85,
      fechaIngreso: "2026-02-01",
      rendimientos: [
        { anio: 2026, mes: 2, modo: "monto", valor: -187.54 },
        { anio: 2026, mes: 3, modo: "monto", valor: 307.61 },
      ],
      movimientos: [
        { tipo: "retiro", monto: 650, fecha: "2026-02-10" },
        { tipo: "retiro", monto: 678, fecha: "2026-03-20" },
      ],
      config: CFG_DEFICIT,
    });
    const feb = meses.find((m) => m.key === "2026-02")!;
    const mar = meses.find((m) => m.key === "2026-03")!;
    expect(feb.comision).toBe(0);
    expect(feb.deficitAcum).toBe(187.54);
    expect(feb.saldoFinal).toBe(5996.31); // idéntico al Excel
    expect(mar.comision).toBe(40.02); // 33.333% de 120.07
    expect(mar.deficitAcum).toBe(0);
    // 5,585.90 exacto al centavo (el Excel muestra .89 por decimales ocultos;
    // el histórico se importa por saldo_final, fiel al reporte).
    expect(mar.saldoFinal).toBe(5585.9);
  });

  it("un retiro grande NO genera déficit (a diferencia del hwm_saldo)", () => {
    const base = {
      capitalInicial: 10000,
      fechaIngreso: "2026-01-01" as const,
      rendimientos: [
        { anio: 2026, mes: 1, modo: "monto" as const, valor: 500 },
        { anio: 2026, mes: 2, modo: "monto" as const, valor: 500 },
      ],
      movimientos: [{ tipo: "retiro" as const, monto: 5000, fecha: "2026-01-20" }],
    };
    const deficit = construirCadena({ ...base, config: CFG_DEFICIT });
    const hwm = construirCadena({
      ...base,
      config: { comisionPct: 33.333, usaHighWaterMark: true, pierdeSoloCliente: true },
    });
    // deficit_pnl: cobra los dos meses completos (no hubo pérdidas).
    expect(deficit[0]!.comision).toBeGreaterThan(0);
    expect(deficit[1]!.comision).toBeGreaterThan(0);
    // hwm_saldo: el retiro hunde el saldo bajo el pico y deja de cobrar (por
    // eso esa política NO sirve para la cuenta de Lenin).
    expect(hwm[1]!.comision).toBe(0);
  });

  it("los meses saldo_final arrastran el déficit (histórico importado de Lenin)", () => {
    // mar→jul-26 del Excel: mar fija 5,585.89; abr −780.90 → déficit; may
    // −130.42 → 911.32; jun +133.09 → 778.23; jul sin cambio (en proceso).
    const meses = construirCadena({
      capitalInicial: 5996.31,
      fechaIngreso: "2026-03-01",
      rendimientos: [
        { anio: 2026, mes: 3, modo: "saldo_final", valor: 5585.89 },
        { anio: 2026, mes: 4, modo: "saldo_final", valor: 4126.99 },
        { anio: 2026, mes: 5, modo: "saldo_final", valor: 3996.57 },
        { anio: 2026, mes: 6, modo: "saldo_final", valor: 4129.66 },
        { anio: 2026, mes: 7, modo: "saldo_final", valor: 4129.66 },
      ],
      movimientos: [
        { tipo: "retiro", monto: 678, fecha: "2026-03-20" },
        { tipo: "retiro", monto: 678, fecha: "2026-04-13" },
      ],
      config: CFG_DEFICIT,
    });
    const por = (k: string) => meses.find((m) => m.key === k)!;
    expect(por("2026-04").deficitAcum).toBe(780.9);
    expect(por("2026-05").deficitAcum).toBe(911.32);
    expect(por("2026-06").deficitAcum).toBe(778.23); // el número del reporte
    expect(por("2026-07").deficitAcum).toBe(778.23);
    expect(por("2026-07").saldoFinal).toBe(4129.66);
    // El siguiente mes positivo en modo monto cobraría solo sobre el excedente:
    const conAgosto = construirCadena({
      capitalInicial: 5996.31,
      fechaIngreso: "2026-03-01",
      rendimientos: [
        { anio: 2026, mes: 3, modo: "saldo_final", valor: 5585.89 },
        { anio: 2026, mes: 4, modo: "saldo_final", valor: 4126.99 },
        { anio: 2026, mes: 5, modo: "saldo_final", valor: 3996.57 },
        { anio: 2026, mes: 6, modo: "saldo_final", valor: 4129.66 },
        { anio: 2026, mes: 8, modo: "monto", valor: 900 },
      ],
      movimientos: [
        { tipo: "retiro", monto: 678, fecha: "2026-03-20" },
        { tipo: "retiro", monto: 678, fecha: "2026-04-13" },
      ],
      config: CFG_DEFICIT,
    });
    const ago = conAgosto.find((m) => m.key === "2026-08")!;
    // 900 − 778.23 = 121.77 facturables → 33.333% = 40.59
    expect(ago.comision).toBe(40.59);
    expect(ago.deficitAcum).toBe(0);
  });

  it("reparto 1/3 exacto en meses limpios (ago-25 del Excel: 791.46 → 263.82)", () => {
    const meses = construirCadena({
      capitalInicial: 5063.33,
      fechaIngreso: "2025-08-01",
      rendimientos: [{ anio: 2025, mes: 8, modo: "monto", valor: 791.46 }],
      movimientos: [{ tipo: "retiro", monto: 200, fecha: "2025-08-15" }],
      config: CFG_DEFICIT,
    });
    expect(meses[0]!.comision).toBe(263.82);
    expect(meses[0]!.saldoFinal).toBe(5390.97); // idéntico al Excel
  });

  it("modo porcentaje: la pérdida crea déficit y la ganancia cobra solo el excedente", () => {
    const meses = construirCadena({
      capitalInicial: 10000,
      fechaIngreso: "2026-01-01",
      rendimientos: [
        { anio: 2026, mes: 1, modo: "porcentaje", valor: -3 },
        { anio: 2026, mes: 2, modo: "porcentaje", valor: 5 },
      ],
      movimientos: [],
      config: CFG_DEFICIT,
    });
    const ene = meses.find((m) => m.key === "2026-01")!;
    const feb = meses.find((m) => m.key === "2026-02")!;
    expect(ene.comision).toBe(0);
    expect(ene.deficitAcum).toBe(300); // 3% de 10,000
    expect(ene.saldoFinal).toBe(9700);
    expect(feb.rendBruto).toBe(485); // 5% de 9,700
    expect(feb.comision).toBe(61.67); // 33.333% de (485 − 300) = 185
    expect(feb.deficitAcum).toBe(0);
    expect(feb.saldoFinal).toBe(10123.33);
  });

  it("las políticas existentes no cambian (deficitAcum = 0 fuera de deficit_pnl)", () => {
    const meses = construirCadena({
      capitalInicial: 10000,
      fechaIngreso: "2024-09-01",
      rendimientos: [{ anio: 2024, mes: 9, modo: "porcentaje", valor: -5 }],
      movimientos: [],
      config: CFG_DEFAULT,
    });
    expect(meses[0]!.deficitAcum).toBe(0);
  });
});

describe("resumenPorAnio — agregación anual", () => {
  const meses = construirCadena({
    capitalInicial: 10000,
    fechaIngreso: "2024-11-01",
    rendimientos: [
      { anio: 2024, mes: 11, modo: "porcentaje", valor: 5 },
      { anio: 2024, mes: 12, modo: "porcentaje", valor: 5 },
      { anio: 2025, mes: 1, modo: "porcentaje", valor: 5 },
    ],
    movimientos: [],
    config: CFG_DEFAULT,
  });
  it("agrupa 2024 y 2025 con su saldo de cierre", () => {
    const porAnio = resumenPorAnio(meses);
    expect(porAnio.map((a) => a.anio)).toEqual([2024, 2025]);
    const a2024 = porAnio.find((a) => a.anio === 2024)!;
    const a2025 = porAnio.find((a) => a.anio === 2025)!;
    expect(a2024.saldoFinal).toBe(mes(meses, "2024-12").saldoFinal);
    expect(a2025.saldoFinal).toBe(mes(meses, "2025-01").saldoFinal);
  });
});

/* ══ Comisión informativa (cuenta Daniel Flores: saldos BRUTOS) ═══════════ */
describe("comisionInformativa — la comisión se devenga pero NO toca el saldo", () => {
  const CFG_INF: LedgerConfig = {
    comisionPct: 35,
    usaHighWaterMark: false,
    pierdeSoloCliente: true,
    politica: "deficit_pnl",
    comisionInformativa: true,
  };

  it("saldo_final: el saldo cargado manda y la comisión sale aparte", () => {
    const meses = construirCadena({
      capitalInicial: 1000,
      fechaIngreso: "2025-09-01",
      rendimientos: [{ anio: 2025, mes: 9, modo: "saldo_final", valor: 2000 }],
      movimientos: [],
      config: CFG_INF,
    });
    const m = mes(meses, "2025-09");
    expect(m.saldoFinal).toBe(2000); // intacto: no se le resta la comisión
    expect(m.rendNeto).toBe(1000);
    expect(m.comision).toBe(350); // 35% de 1,000, informativa
    expect(m.deficitAcum).toBe(0);
  });

  it("resultadoComisionable deja fuera del reparto lo que es 100% del cliente", () => {
    const meses = construirCadena({
      capitalInicial: 1000,
      fechaIngreso: "2025-09-01",
      // El mes subió 1,000 pero solo 800 son trading: 200 son recompensas.
      rendimientos: [
        { anio: 2025, mes: 9, modo: "saldo_final", valor: 2000, resultadoComisionable: 800 },
      ],
      movimientos: [],
      config: CFG_INF,
    });
    const m = mes(meses, "2025-09");
    expect(m.saldoFinal).toBe(2000);
    expect(m.rendNeto).toBe(1000); // el saldo subió 1,000
    expect(m.comision).toBe(280); // pero solo se comisionan 800 → 35% = 280
  });

  it("el déficit se lleva sobre la base comisionable, no sobre el saldo", () => {
    const meses = construirCadena({
      capitalInicial: 10000,
      fechaIngreso: "2025-09-01",
      rendimientos: [
        // Pierde 1,000 de trading pero recibe 100 de recompensas (saldo −900).
        { anio: 2025, mes: 9, modo: "saldo_final", valor: 9100, resultadoComisionable: -1000 },
        // Gana 1,500 de trading: recupera 1,000 y comisiona sobre 500.
        { anio: 2025, mes: 10, modo: "saldo_final", valor: 10600, resultadoComisionable: 1500 },
      ],
      movimientos: [],
      config: CFG_INF,
    });
    const sep = mes(meses, "2025-09");
    const oct = mes(meses, "2025-10");
    expect(sep.comision).toBe(0);
    expect(sep.deficitAcum).toBe(1000);
    expect(sep.saldoFinal).toBe(9100);
    expect(oct.deficitAcum).toBe(0);
    expect(oct.comision).toBe(175); // 35% de (1,500 − 1,000)
    expect(oct.saldoFinal).toBe(10600); // el saldo NO baja por la comisión
  });

  it("REGRESIÓN: sin el flag, saldo_final sigue con comisión 0 (cuenta de Lenin)", () => {
    const rendimientos = [
      { anio: 2025, mes: 9, modo: "saldo_final" as const, valor: 2000 },
    ];
    const base = { capitalInicial: 1000, fechaIngreso: "2025-09-01", rendimientos, movimientos: [] };
    const sinFlag = construirCadena({
      ...base,
      config: { comisionPct: 33.333, usaHighWaterMark: false, pierdeSoloCliente: true, politica: "deficit_pnl" },
    });
    expect(mes(sinFlag, "2025-09").comision).toBe(0);
    expect(mes(sinFlag, "2025-09").saldoFinal).toBe(2000);
  });

  it("en porcentaje/monto la comisión TAMPOCO reduce el saldo con el flag activo", () => {
    // Clave para el cierre mensual: el desplegable arranca en "porcentaje", así
    // que si el flag solo valiera para saldo_final, cerrar un mes normal
    // separaría el saldo del portal del saldo real del bróker.
    const rendimientos = [{ anio: 2025, mes: 9, modo: "porcentaje" as const, valor: 10 }];
    const base = { capitalInicial: 10000, fechaIngreso: "2025-09-01", rendimientos, movimientos: [] };
    const con = construirCadena({ ...base, config: { ...CFG_INF, politica: "normal" } });
    const sin = construirCadena({
      ...base,
      config: { comisionPct: 35, usaHighWaterMark: false, pierdeSoloCliente: true, politica: "normal" },
    });
    expect(mes(con, "2025-09").comision).toBe(350); // devengada
    expect(mes(con, "2025-09").rendNeto).toBe(1000); // el resultado no se recorta
    expect(mes(con, "2025-09").saldoFinal).toBe(11000); // saldo bruto, intacto
    expect(mes(sin, "2025-09").saldoFinal).toBe(10650); // sin el flag sí se descuenta
  });

  it("en modo monto la base propia también manda (porcentaje/monto + resultadoComisionable)", () => {
    const meses = construirCadena({
      capitalInicial: 10000,
      fechaIngreso: "2025-09-01",
      rendimientos: [
        { anio: 2025, mes: 9, modo: "monto", valor: 1000, resultadoComisionable: 600 },
      ],
      movimientos: [],
      config: { ...CFG_INF, politica: "normal" },
    });
    const m = mes(meses, "2025-09");
    expect(m.saldoFinal).toBe(11000);
    expect(m.comision).toBe(210); // 35% de 600, no de 1,000
  });

  it("resumen: comisionOperador agrega la comisión devengada", () => {
    const meses = construirCadena({
      capitalInicial: 1000,
      fechaIngreso: "2025-09-01",
      rendimientos: [
        { anio: 2025, mes: 9, modo: "saldo_final", valor: 2000 },
        { anio: 2025, mes: 10, modo: "saldo_final", valor: 3000 },
      ],
      movimientos: [],
      config: CFG_INF,
    });
    const r = resumen(meses, 1000);
    expect(r.saldoActual).toBe(3000);
    expect(r.comisionOperador).toBe(700); // 350 + 350
  });
});

/* ══ Capital base pactado (cuenta Daniel Flores) ═══════════════════════════ */
describe("capitalBase — cuánto falta para volver a cobrar", () => {
  const CFG: LedgerConfig = {
    comisionPct: 35,
    usaHighWaterMark: false,
    pierdeSoloCliente: true,
    politica: "normal",
    comisionInformativa: true,
    capitalBase: 130000,
  };
  const meses = construirCadena({
    capitalInicial: 100000,
    fechaIngreso: "2026-03-01",
    rendimientos: [
      // Mes con liquidación: subió 20,000 pero solo 15,000 se repartieron.
      { anio: 2026, mes: 3, modo: "saldo_final", valor: 120000, resultadoComisionable: 15000 },
      // Mes en pérdida: no hay liquidación, la base propia es 0.
      { anio: 2026, mes: 4, modo: "saldo_final", valor: 16346.13, resultadoComisionable: 0 },
    ],
    movimientos: [],
    config: CFG,
  });

  it("cobra el 35% solo de la ganancia liquidada, sin tocar el saldo", () => {
    const m = mes(meses, "2026-03");
    expect(m.saldoFinal).toBe(120000);
    expect(m.rendNeto).toBe(20000);
    expect(m.baseComision).toBe(15000);
    expect(m.comision).toBe(5250); // 35% de 15,000
  });

  it("un mes sin liquidación (base 0) no genera comisión aunque el saldo suba", () => {
    const m = mes(meses, "2026-04");
    expect(m.baseComision).toBe(0);
    expect(m.comision).toBe(0);
    expect(m.saldoFinal).toBe(16346.13);
  });

  it("resumen: expone la base y lo que falta para volver a ella", () => {
    const r = resumen(meses, 100000, 2026, 130000);
    expect(r.capitalBase).toBe(130000);
    expect(r.saldoActual).toBe(16346.13);
    expect(r.faltaParaBase).toBe(113653.87);
  });

  it("si el saldo supera la base, faltaParaBase es 0 (nunca negativo)", () => {
    const arriba = construirCadena({
      capitalInicial: 100000,
      fechaIngreso: "2026-03-01",
      rendimientos: [{ anio: 2026, mes: 3, modo: "saldo_final", valor: 140000, resultadoComisionable: 40000 }],
      movimientos: [],
      config: CFG,
    });
    const r = resumen(arriba, 100000, 2026, 130000);
    expect(r.faltaParaBase).toBe(0);
    expect(r.capitalBase).toBe(130000);
  });

  it("sin capitalBase el resumen no inventa nada", () => {
    const r = resumen(meses, 100000, 2026);
    expect(r.capitalBase).toBeNull();
    expect(r.faltaParaBase).toBe(0);
  });
});

/* ══ Guarda: capital base ⇒ la comisión NO se deriva del saldo ═════════════ */
describe("capitalBase — un mes sin base cargada NO factura comisión", () => {
  const CFG_BASE: LedgerConfig = {
    comisionPct: 35,
    usaHighWaterMark: false,
    pierdeSoloCliente: true,
    politica: "normal",
    comisionInformativa: true,
    capitalBase: 130000,
  };

  it("cuenta con capital base: sin resultadoComisionable la comisión es 0, no 35% del mes", () => {
    // El escenario peligroso: el operador cierra el mes y deja el campo vacío.
    // Antes esto devengaba 35% de TODO el resultado y le cobraba de más al cliente.
    const meses = construirCadena({
      capitalInicial: 16000,
      fechaIngreso: "2026-09-01",
      rendimientos: [{ anio: 2026, mes: 9, modo: "porcentaje", valor: 10 }],
      movimientos: [],
      config: CFG_BASE,
    });
    const m = mes(meses, "2026-09");
    expect(m.rendBruto).toBe(1600);
    expect(m.baseComision).toBe(0);
    expect(m.comision).toBe(0);
    expect(m.saldoFinal).toBe(17600); // el saldo no se toca
  });

  it("lo mismo en modo saldo_final (el camino del histórico importado)", () => {
    const meses = construirCadena({
      capitalInicial: 16000,
      fechaIngreso: "2026-09-01",
      rendimientos: [{ anio: 2026, mes: 9, modo: "saldo_final", valor: 20000 }],
      movimientos: [],
      config: CFG_BASE,
    });
    const m = mes(meses, "2026-09");
    expect(m.rendNeto).toBe(4000);
    expect(m.comision).toBe(0);
    expect(m.saldoFinal).toBe(20000);
  });

  it("con la base cargada sí cobra, y solo sobre ella", () => {
    const meses = construirCadena({
      capitalInicial: 16000,
      fechaIngreso: "2026-09-01",
      rendimientos: [
        { anio: 2026, mes: 9, modo: "porcentaje", valor: 10, resultadoComisionable: 1000 },
      ],
      movimientos: [],
      config: CFG_BASE,
    });
    const m = mes(meses, "2026-09");
    expect(m.baseComision).toBe(1000);
    expect(m.comision).toBe(350);
  });

  it("SIN capital base el comportamiento anterior no cambia (comisiona el resultado)", () => {
    const meses = construirCadena({
      capitalInicial: 16000,
      fechaIngreso: "2026-09-01",
      rendimientos: [{ anio: 2026, mes: 9, modo: "porcentaje", valor: 10 }],
      movimientos: [],
      config: { ...CFG_BASE, capitalBase: undefined },
    });
    expect(mes(meses, "2026-09").comision).toBe(560); // 35% de 1,600
  });
});

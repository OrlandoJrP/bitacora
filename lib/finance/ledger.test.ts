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

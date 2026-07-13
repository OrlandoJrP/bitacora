import { describe, it, expect } from "vitest";
import {
  construirCadenaPool,
  repartirMes,
  resumenPool,
  validarOverridesMes,
  type PoolConfig,
  type PoolInput,
  type MesPool,
} from "./pool";
import { round2 } from "./ledger";

const CFG: PoolConfig = { comisionPct: 35, baseComision: "ganancia_neta" };

const mes = (meses: MesPool[], key: string): MesPool => {
  const m = meses.find((x) => x.key === key);
  if (!m) throw new Error(`mes ${key} no encontrado`);
  return m;
};
const socio = (m: MesPool, id: string) => {
  const s = m.socios.find((x) => x.socioId === id);
  if (!s) throw new Error(`socio ${id} no encontrado en ${m.key}`);
  return s;
};

/* ══ 1. sep-24 histórico real: override total (reparto negociado) ══════════ */
describe("sep-24 (Excel real): fondo 17,125 + 2,245 → 19,370 con overrides", () => {
  const input: PoolInput = {
    fechaInicio: "2024-09-01",
    socios: [
      { id: "L", nombre: "Lenin", capitalInicial: 6125, fechaAlta: "2024-09-01", estado: "activo" },
      { id: "A", nombre: "Arlet", capitalInicial: 0, fechaAlta: "2024-09-01", estado: "activo" },
      { id: "R", nombre: "Railen", capitalInicial: 0, fechaAlta: "2024-09-01", estado: "activo" },
    ],
    movimientos: [
      { socioId: "A", tipo: "deposito", monto: 8000, fecha: "2024-09-05" },
      { socioId: "R", tipo: "deposito", monto: 3000, fecha: "2024-09-05" },
    ],
    rendimientos: [{ anio: 2024, mes: 9, modo: "monto", valor: 2245 }],
    overrides: [
      { socioId: "L", anio: 2024, mes: 9, saldoFinal: 6927.81 },
      { socioId: "A", anio: 2024, mes: 9, saldoFinal: 9048.19 },
      { socioId: "R", anio: 2024, mes: 9, saldoFinal: 3394.0 },
    ],
    config: CFG,
  };
  const meses = construirCadenaPool(input);
  const m = mes(meses, "2024-09");

  it("fondo: base 17,125 → saldo final 19,370.00 sin descuadre", () => {
    expect(m.baseOperativa).toBe(17125);
    expect(m.resultado).toBe(2245);
    expect(m.saldoFinal).toBe(19370);
    expect(m.descuadre).toBe(0);
  });
  it("socios exactos al centavo (I1) con origen override", () => {
    expect(socio(m, "L").saldoFinal).toBe(6927.81);
    expect(socio(m, "A").saldoFinal).toBe(9048.19);
    expect(socio(m, "R").saldoFinal).toBe(3394.0);
    expect(m.socios.every((s) => s.origen === "override")).toBe(true);
    expect(round2(m.socios.reduce((s, x) => s + x.saldoFinal, 0))).toBe(m.saldoFinal);
  });
  it("comisión informativa: 35% de 2,245 = 785.75 (y no altera saldos)", () => {
    expect(m.comisionAcumulada).toBe(785.75);
  });
});

/* ══ 2. feb/mar-25: salida de Railen + compra por Arlet (transferencia) ════ */
describe("feb-25 salida de Railen y mar-25 compra por Arlet (Excel real)", () => {
  const input: PoolInput = {
    fechaInicio: "2025-02-01",
    socios: [
      { id: "L", nombre: "Lenin", capitalInicial: 8167.27, fechaAlta: "2025-02-01", estado: "activo" },
      { id: "A", nombre: "Arlet", capitalInicial: 10658.65, fechaAlta: "2025-02-01", estado: "activo" },
      { id: "R", nombre: "Railen", capitalInicial: 4936.08, fechaAlta: "2025-02-01", estado: "inactivo" },
    ],
    movimientos: [
      { socioId: "R", tipo: "retiro", monto: 4915.65, fecha: "2025-02-20", transferenciaId: "T1" },
      { socioId: "A", tipo: "deposito", monto: 4915.65, fecha: "2025-03-10", transferenciaId: "T1" },
    ],
    rendimientos: [
      { anio: 2025, mes: 2, modo: "monto", valor: -88 },
      { anio: 2025, mes: 3, modo: "monto", valor: 158 },
    ],
    overrides: [
      { socioId: "L", anio: 2025, mes: 2, saldoFinal: 8138.29 },
      { socioId: "A", anio: 2025, mes: 2, saldoFinal: 10620.06 },
      { socioId: "R", anio: 2025, mes: 2, saldoFinal: 0 },
      { socioId: "L", anio: 2025, mes: 3, saldoFinal: 8193.27 },
      { socioId: "A", anio: 2025, mes: 3, saldoFinal: 15638.73 },
      { socioId: "R", anio: 2025, mes: 3, saldoFinal: 0 },
    ],
    config: CFG,
  };
  const meses = construirCadenaPool(input);
  const feb = mes(meses, "2025-02");
  const mar = mes(meses, "2025-03");

  it("feb: fondo 23,762 − retiro 4,915.65 − 88 = 18,758.35; Railen queda en 0", () => {
    expect(feb.saldoInicial).toBe(23762);
    expect(feb.retiros).toBe(4915.65);
    expect(feb.saldoFinal).toBe(18758.35);
    expect(feb.descuadre).toBe(0);
    expect(socio(feb, "R").saldoFinal).toBe(0);
  });
  it("mar: el aporte de Arlet (misma transferencia) recompone el fondo → 23,832", () => {
    expect(mar.aportes).toBe(4915.65);
    expect(mar.saldoFinal).toBe(23832);
    expect(socio(mar, "A").saldoFinal).toBe(15638.73);
    expect(socio(mar, "R").saldoFinal).toBe(0);
  });
  it("continuidad I3 por socio entre feb y mar", () => {
    for (const id of ["L", "A", "R"]) {
      expect(socio(mar, id).saldoInicial).toBe(socio(feb, id).saldoFinal);
    }
  });
});

/* ══ 3. abr-26: exposición parcial (el override es imprescindible) ═════════ */
describe("abr-26 (Excel real): depósito de fin de mes con exposición parcial", () => {
  const base: Omit<PoolInput, "overrides"> = {
    fechaInicio: "2026-04-01",
    socios: [
      { id: "L", nombre: "Lenin", capitalInicial: 17169.16, fechaAlta: "2026-04-01", estado: "activo" },
      { id: "A", nombre: "Arlet", capitalInicial: 52648.16, fechaAlta: "2026-04-01", estado: "activo" },
    ],
    movimientos: [
      { socioId: "A", tipo: "retiro", monto: 500, fecha: "2026-04-16" },
      { socioId: "A", tipo: "retiro", monto: 600, fecha: "2026-04-16" },
      { socioId: "A", tipo: "retiro", monto: 2500, fecha: "2026-04-24" },
      { socioId: "A", tipo: "deposito", monto: 24760.18, fecha: "2026-04-29" },
    ],
    rendimientos: [
      { anio: 2026, mes: 4, modo: "saldo_final", valor: 81348.91, tasaTwr: -13.98 },
    ],
    config: CFG,
  };

  it("con overrides reproduce el Excel exacto (Lenin 14,768.91 / Arlet 66,580.00)", () => {
    const meses = construirCadenaPool({
      ...base,
      overrides: [
        { socioId: "L", anio: 2026, mes: 4, saldoFinal: 14768.91 },
        { socioId: "A", anio: 2026, mes: 4, saldoFinal: 66580.0 },
      ],
    });
    const m = mes(meses, "2026-04");
    expect(m.baseOperativa).toBe(90977.5);
    expect(m.resultado).toBe(-9628.59);
    expect(m.saldoFinal).toBe(81348.91);
    expect(m.descuadre).toBe(0);
    expect(socio(m, "L").saldoFinal).toBe(14768.91);
    expect(socio(m, "A").saldoFinal).toBe(66580.0);
  });
  it("SIN override el proporcional daría otro número (por eso existe el override)", () => {
    const meses = construirCadenaPool({ ...base, overrides: [] });
    const m = mes(meses, "2026-04");
    expect(socio(m, "L").saldoFinal).not.toBe(14768.91);
    expect(m.saldoFinal).toBe(81348.91); // el fondo no cambia (I4)
  });
  it("tasaTwr del mes es la reportada (−13.98%), no la contable (−10.58%)", () => {
    const meses = construirCadenaPool({ ...base, overrides: [] });
    const m = mes(meses, "2026-04");
    expect(round2(m.tasaTwr * 100)).toBe(-13.98);
    expect(round2(m.roiMes * 100)).toBe(-10.58);
  });
});

/* ══ 4. Cadena 2026 completa: proporcional may/jun + flotante jul + TWR ════ */
describe("2026 completo (Excel real): overrides ene-abr, proporcional may-jun, jul flotante", () => {
  const input: PoolInput = {
    fechaInicio: "2026-01-01",
    socios: [
      { id: "L", nombre: "Lenin", capitalInicial: 16053.87, fechaAlta: "2026-01-01", estado: "activo" },
      { id: "A", nombre: "Arlet", capitalInicial: 43943.51, fechaAlta: "2026-01-01", estado: "activo" },
    ],
    movimientos: [
      { socioId: "A", tipo: "deposito", monto: 2902.6, fecha: "2026-01-10" },
      { socioId: "L", tipo: "retiro", monto: 800, fecha: "2026-01-15" },
      { socioId: "L", tipo: "retiro", monto: 100, fecha: "2026-03-15" },
      { socioId: "A", tipo: "retiro", monto: 500, fecha: "2026-04-16" },
      { socioId: "A", tipo: "retiro", monto: 600, fecha: "2026-04-16" },
      { socioId: "A", tipo: "retiro", monto: 2500, fecha: "2026-04-24" },
      { socioId: "A", tipo: "deposito", monto: 24760.18, fecha: "2026-04-29" },
      { socioId: "A", tipo: "retiro", monto: 721, fecha: "2026-05-04" },
      { socioId: "A", tipo: "retiro", monto: 500, fecha: "2026-05-08" },
      { socioId: "A", tipo: "retiro", monto: 300, fecha: "2026-05-09" },
      { socioId: "A", tipo: "retiro", monto: 40, fecha: "2026-05-14" },
      { socioId: "A", tipo: "retiro", monto: 1760, fecha: "2026-05-14" },
      { socioId: "A", tipo: "retiro", monto: 870, fecha: "2026-05-15" },
      { socioId: "A", tipo: "retiro", monto: 100, fecha: "2026-05-20" },
      { socioId: "A", tipo: "retiro", monto: 50, fecha: "2026-05-20" },
      { socioId: "A", tipo: "retiro", monto: 50, fecha: "2026-05-20" },
      { socioId: "A", tipo: "retiro", monto: 10, fecha: "2026-06-03" },
      { socioId: "A", tipo: "retiro", monto: 3000, fecha: "2026-06-16" },
    ],
    rendimientos: [
      { anio: 2026, mes: 1, modo: "saldo_final", valor: 65666.48 },
      { anio: 2026, mes: 2, modo: "saldo_final", valor: 64217.29 },
      { anio: 2026, mes: 3, modo: "saldo_final", valor: 69817.32 },
      { anio: 2026, mes: 4, modo: "saldo_final", valor: 81348.91, tasaTwr: -13.98 },
      { anio: 2026, mes: 5, modo: "saldo_final", valor: 74556.83 },
      { anio: 2026, mes: 6, modo: "saldo_final", valor: 77199.02 },
      { anio: 2026, mes: 7, modo: "porcentaje", valor: 6.6, enCurso: true },
    ],
    overrides: [
      { socioId: "L", anio: 2026, mes: 1, saldoFinal: 16176.16 },
      { socioId: "A", anio: 2026, mes: 1, saldoFinal: 49490.32 },
      { socioId: "L", anio: 2026, mes: 2, saldoFinal: 15801.4 },
      { socioId: "A", anio: 2026, mes: 2, saldoFinal: 48415.89 },
      { socioId: "L", anio: 2026, mes: 3, saldoFinal: 17169.16 },
      { socioId: "A", anio: 2026, mes: 3, saldoFinal: 52648.16 },
      { socioId: "L", anio: 2026, mes: 4, saldoFinal: 14768.91 },
      { socioId: "A", anio: 2026, mes: 4, saldoFinal: 66580.0 },
      // may y jun SIN override: reparto proporcional puro
    ],
    config: CFG,
  };
  const meses = construirCadenaPool(input);

  it("may-26 proporcional reproduce el Excel: Lenin 14,308.12 / Arlet 60,248.71", () => {
    const m = mes(meses, "2026-05");
    expect(m.retiros).toBe(4391);
    expect(m.saldoFinal).toBe(74556.83);
    expect(socio(m, "L").saldoFinal).toBe(14308.12);
    expect(socio(m, "A").saldoFinal).toBe(60248.71);
    expect(socio(m, "L").origen).toBe("proporcional");
  });
  it("jun-26 proporcional reproduce el Excel: Lenin 15,438.46 / Arlet 61,760.56", () => {
    const m = mes(meses, "2026-06");
    expect(m.saldoFinal).toBe(77199.02);
    expect(socio(m, "L").saldoFinal).toBe(15438.46);
    expect(socio(m, "A").saldoFinal).toBe(61760.56);
  });
  it("jul-26 flotante +6.6%: fondo 82,294.16; Lenin 16,457.40; Arlet 65,836.76", () => {
    const m = mes(meses, "2026-07");
    expect(m.enCurso).toBe(true);
    expect(m.resultado).toBe(5095.14);
    expect(m.saldoFinal).toBe(82294.16);
    expect(socio(m, "L").saldoFinal).toBe(16457.4);
    expect(socio(m, "A").saldoFinal).toBe(65836.76);
  });
  it("TWR 2026 compone a +7.93% (con tasa_twr de abril) — el número del Excel", () => {
    const r = resumenPool(meses, input);
    expect(round2(r.twrAnual * 100)).toBe(7.93);
    expect(round2(r.twrDesdeInicio * 100)).toBe(7.93); // esta serie empieza en 2026
  });
  it("resumen: capital actual 82,294.16 (flotante) vs confirmado 77,199.02", () => {
    const r = resumenPool(meses, input);
    expect(r.capitalActual).toBe(82294.16);
    expect(r.capitalConfirmado).toBe(77199.02);
    expect(r.flotante).not.toBeNull();
    expect(round2((r.flotante?.roiMes ?? 0) * 100)).toBe(6.6);
  });
  it("invariantes I1/I2/I3 en toda la cadena", () => {
    for (let i = 0; i < meses.length; i++) {
      const m = meses[i]!;
      expect(round2(m.socios.reduce((s, x) => s + x.saldoFinal, 0))).toBe(m.saldoFinal); // I1
      expect(round2(m.socios.reduce((s, x) => s + x.baseOperativa, 0))).toBe(m.baseOperativa); // I2
      if (i > 0) {
        const prev = meses[i - 1]!;
        expect(m.saldoInicial).toBe(prev.saldoFinal); // I3 fondo
        for (const s of m.socios) {
          expect(s.saldoInicial).toBe(prev.socios.find((x) => x.socioId === s.socioId)!.saldoFinal);
        }
      }
    }
  });
});

/* ══ 5. Residuo de redondeo determinista ═══════════════════════════════════ */
describe("residuo de redondeo (I1 al centavo)", () => {
  function chain(valor: number) {
    return construirCadenaPool({
      fechaInicio: "2025-01-01",
      socios: [
        { id: "S1", nombre: "S1", capitalInicial: 1000, fechaAlta: "2025-01-01", estado: "activo" },
        { id: "S2", nombre: "S2", capitalInicial: 1000, fechaAlta: "2025-01-01", estado: "activo" },
        { id: "S3", nombre: "S3", capitalInicial: 1000, fechaAlta: "2025-01-01", estado: "activo" },
      ],
      movimientos: [],
      rendimientos: [{ anio: 2025, mes: 1, modo: "monto", valor }],
      overrides: [],
      config: CFG,
    });
  }
  it("+100 sobre 3×1,000 → 33.34/33.33/33.33 (residuo al primero)", () => {
    const m = mes(chain(100), "2025-01");
    expect(m.socios.map((s) => s.resultado)).toEqual([33.34, 33.33, 33.33]);
    expect(m.socios.filter((s) => s.llevaResiduo).length).toBe(1);
    expect(m.saldoFinal).toBe(3100);
  });
  it("−100 → −33.34/−33.33/−33.33 y Σ exacta", () => {
    const m = mes(chain(-100), "2025-01");
    expect(m.socios.map((s) => s.resultado)).toEqual([-33.34, -33.33, -33.33]);
    expect(m.saldoFinal).toBe(2900);
  });
});

/* ══ 6. Comisión informativa: nunca toca saldos ════════════════════════════ */
describe("comisión informativa (ganancia_neta vs meses_positivos)", () => {
  const base = (config: PoolConfig): PoolInput => ({
    fechaInicio: "2024-09-01",
    socios: [
      { id: "U", nombre: "Único", capitalInicial: 17125, fechaAlta: "2024-09-01", estado: "activo" },
    ],
    movimientos: [],
    rendimientos: [
      { anio: 2024, mes: 9, modo: "monto", valor: 2245 },
      { anio: 2024, mes: 10, modo: "monto", valor: -1000 },
    ],
    overrides: [],
    config,
  });

  it("ganancia_neta: 785.75 → 435.75 (el mes negativo REDUCE lo por cobrar)", () => {
    const meses = construirCadenaPool(base(CFG));
    expect(mes(meses, "2024-09").comisionAcumulada).toBe(785.75);
    expect(mes(meses, "2024-10").comisionAcumulada).toBe(435.75);
    expect(mes(meses, "2024-10").comisionMes).toBe(-350);
  });
  it("meses_positivos: 785.75 constante (los negativos no descuentan)", () => {
    const meses = construirCadenaPool(base({ comisionPct: 35, baseComision: "meses_positivos" }));
    expect(mes(meses, "2024-10").comisionAcumulada).toBe(785.75);
    expect(mes(meses, "2024-10").comisionMes).toBe(0);
  });
  it("I5: los saldos son idénticos con comisión 35% y 0%", () => {
    const con = construirCadenaPool(base(CFG));
    const sin = construirCadenaPool(base({ comisionPct: 0, baseComision: "ganancia_neta" }));
    expect(con.map((m) => m.saldoFinal)).toEqual(sin.map((m) => m.saldoFinal));
    expect(con.flatMap((m) => m.socios.map((s) => s.saldoFinal))).toEqual(
      sin.flatMap((m) => m.socios.map((s) => s.saldoFinal)),
    );
  });
});

/* ══ 7. Override parcial: los libres se reparten el resto ═════════════════ */
describe("override parcial", () => {
  it("C fijado en 3,400; A y B se reparten el resto proporcional (I1)", () => {
    const { socios, descuadre } = repartirMes(
      [
        { socioId: "A", saldoInicial: 1000, aportes: 0, retiros: 0, baseOperativa: 1000 },
        { socioId: "B", saldoInicial: 2000, aportes: 0, retiros: 0, baseOperativa: 2000 },
        { socioId: "C", saldoInicial: 3000, aportes: 0, retiros: 0, baseOperativa: 3000 },
      ],
      6600,
      600,
      new Map([["C", 3400]]),
    );
    expect(descuadre).toBe(0);
    expect(socios.find((s) => s.socioId === "A")!.saldoFinal).toBe(1066.67);
    expect(socios.find((s) => s.socioId === "B")!.saldoFinal).toBe(2133.33);
    expect(socios.find((s) => s.socioId === "C")!.saldoFinal).toBe(3400);
    expect(round2(socios.reduce((s, x) => s + x.saldoFinal, 0))).toBe(6600);
  });
});

/* ══ 8. Descuadre detectable (el motor no corrige en silencio) ═════════════ */
describe("descuadre con overrides totales", () => {
  it("Σ overrides ≠ saldo del fondo → descuadre = fondo − Σ (no se maquilla)", () => {
    const { descuadre } = repartirMes(
      [
        { socioId: "A", saldoInicial: 500, aportes: 0, retiros: 0, baseOperativa: 500 },
        { socioId: "B", saldoInicial: 500, aportes: 0, retiros: 0, baseOperativa: 500 },
      ],
      1100,
      100,
      new Map([
        ["A", 550],
        ["B", 549.98],
      ]),
    );
    expect(descuadre).toBe(0.02);
  });
  it("validarOverridesMes reporta suma y diferencia exactas", () => {
    expect(validarOverridesMes(1100, [550, 549.98])).toEqual({ suma: 1099.98, diferencia: 0.02 });
    expect(validarOverridesMes(1100, [550, 550])).toEqual({ suma: 1100, diferencia: 0 });
  });
});

/* ══ Socio que entra DESPUÉS del inicio: no reescribe la historia ══════════ */
describe("socio con alta posterior al inicio del fondo", () => {
  const meses = construirCadenaPool({
    fechaInicio: "2025-01-01",
    socios: [
      { id: "A", nombre: "A", capitalInicial: 1000, fechaAlta: "2025-01-01", estado: "activo" },
      { id: "B", nombre: "B", capitalInicial: 500, fechaAlta: "2025-03-01", estado: "activo" },
    ],
    movimientos: [],
    rendimientos: [
      { anio: 2025, mes: 1, modo: "porcentaje", valor: 10 },
      { anio: 2025, mes: 3, modo: "porcentaje", valor: 10 },
    ],
    overrides: [],
    config: CFG,
  });
  it("antes de su alta, B no existe en las bases (ene: solo A, base 1,000)", () => {
    const ene = mes(meses, "2025-01");
    expect(ene.baseOperativa).toBe(1000);
    expect(socio(ene, "B").baseOperativa).toBe(0);
    expect(socio(ene, "B").saldoFinal).toBe(0);
    expect(socio(ene, "A").saldoFinal).toBe(1100);
  });
  it("su semilla aparece en el mes de alta y participa desde ahí", () => {
    const mar = mes(meses, "2025-03");
    expect(socio(mar, "B").saldoInicial).toBe(500);
    expect(mar.baseOperativa).toBe(1600); // 1,100 de A + 500 de B
    expect(socio(mar, "B").saldoFinal).toBe(550);
    expect(socio(mar, "A").saldoFinal).toBe(1210);
    expect(mar.saldoFinal).toBe(1760);
  });
});

/* ══ 9-10. Bordes ══════════════════════════════════════════════════════════ */
describe("bordes", () => {
  it("mes sin rendimiento: arrastre puro (resultado 0, roi 0)", () => {
    const meses = construirCadenaPool({
      fechaInicio: "2025-01-01",
      socios: [{ id: "U", nombre: "U", capitalInicial: 5000, fechaAlta: "2025-01-01", estado: "activo" }],
      movimientos: [],
      rendimientos: [{ anio: 2025, mes: 3, modo: "porcentaje", valor: 10 }],
      overrides: [],
      config: CFG,
    });
    expect(meses.map((m) => m.key)).toEqual(["2025-01", "2025-02", "2025-03"]);
    const feb = mes(meses, "2025-02");
    expect(feb.tieneRendimiento).toBe(false);
    expect(feb.saldoFinal).toBe(5000);
    expect(mes(meses, "2025-03").saldoFinal).toBe(5500);
  });
  it("movimiento anterior al inicio se imputa al primer mes; strings numeric", () => {
    const meses = construirCadenaPool({
      fechaInicio: "2025-02-01",
      socios: [{ id: "U", nombre: "U", capitalInicial: "1000.00", fechaAlta: "2025-02-01", estado: "activo" }],
      movimientos: [{ socioId: "U", tipo: "deposito", monto: "500.00", fecha: "2025-01-15" }],
      rendimientos: [],
      overrides: [],
      config: CFG,
    });
    expect(mes(meses, "2025-02").aportes).toBe(500);
    expect(mes(meses, "2025-02").saldoFinal).toBe(1500);
  });
  it("fondo con base 0: roi 0, sin NaN", () => {
    const meses = construirCadenaPool({
      fechaInicio: "2025-01-01",
      socios: [{ id: "U", nombre: "U", capitalInicial: 0, fechaAlta: "2025-01-01", estado: "activo" }],
      movimientos: [],
      rendimientos: [{ anio: 2025, mes: 1, modo: "porcentaje", valor: 10 }],
      overrides: [],
      config: CFG,
    });
    const m = mes(meses, "2025-01");
    expect(m.roiMes).toBe(0);
    expect(Number.isFinite(m.tasaTwr)).toBe(true);
    expect(m.saldoFinal).toBe(0);
  });
});

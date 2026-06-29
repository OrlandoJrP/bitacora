"use client";

import { useState, useTransition } from "react";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  construirCadena,
  type LedgerConfig,
  type MesLedger,
  type Modo,
} from "@/lib/finance/ledger";
import { guardarRendimiento } from "@/app/actions/rendimientos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MoneyText } from "@/components/money-text";
import { MESES_ES, formatPct, formatUSDSigned, nombreMes } from "@/lib/format";
import { cn } from "@/lib/utils";

export type RendimientoLite = {
  anio: number;
  mes: number;
  modo: Modo;
  valor: number;
  descripcion: string | null;
};
export type MovimientoLite = {
  tipo: "deposito" | "retiro";
  monto: number;
  fecha: string;
  descripcion: string | null;
};
export type ClienteCierre = {
  id: string;
  nombre: string;
  capitalInicial: number;
  fechaIngreso: string;
  rendimientos: RendimientoLite[];
  movimientos: MovimientoLite[];
};

type Row = { modo: Modo; valor: string; descripcion: string };

const MODO_LABEL: Record<Modo, string> = {
  porcentaje: "Porcentaje (%)",
  monto: "Monto (USD)",
  saldo_final: "Saldo final (USD)",
};

export function CierreMensual({
  clientes,
  config,
  anioInicial,
  mesInicial,
  anioMin,
}: {
  clientes: ClienteCierre[];
  config: LedgerConfig;
  anioInicial: number;
  mesInicial: number;
  anioMin: number;
}) {
  const [anio, setAnio] = useState(anioInicial);
  const [mes, setMes] = useState(mesInicial);
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    initRows(clientes, anioInicial, mesInicial),
  );

  const anios: number[] = [];
  for (let a = anioMin; a <= anioInicial; a++) anios.push(a);

  function initRows(cs: ClienteCierre[], a: number, m: number): Record<string, Row> {
    const out: Record<string, Row> = {};
    for (const c of cs) {
      const ex = c.rendimientos.find((r) => r.anio === a && r.mes === m);
      out[c.id] = {
        modo: ex?.modo ?? "porcentaje",
        valor: ex ? String(ex.valor) : "",
        descripcion: ex?.descripcion ?? "",
      };
    }
    return out;
  }

  function cambiarPeriodo(a: number, m: number) {
    setAnio(a);
    setMes(m);
    setRows(initRows(clientes, a, m));
  }

  function setRow(id: string, patch: Partial<Row>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id]!, ...patch } }));
  }

  function preview(c: ClienteCierre): MesLedger | null {
    const row = rows[c.id]!;
    if (row.valor.trim() === "" || Number.isNaN(Number(row.valor))) return null;
    const rends = c.rendimientos.filter((r) => !(r.anio === anio && r.mes === mes));
    rends.push({ anio, mes, modo: row.modo, valor: Number(row.valor), descripcion: null });
    const meses = construirCadena({
      capitalInicial: c.capitalInicial,
      fechaIngreso: c.fechaIngreso,
      hasta: { anio, mes },
      rendimientos: rends,
      movimientos: c.movimientos,
      config,
    });
    return meses.find((x) => x.anio === anio && x.mes === mes) ?? null;
  }

  function yaRegistrado(c: ClienteCierre) {
    return c.rendimientos.some((r) => r.anio === anio && r.mes === mes);
  }

  return (
    <div className="space-y-5">
      {/* Selector de periodo */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-5">
          <Periodo label="Año">
            <select
              value={anio}
              onChange={(e) => cambiarPeriodo(Number(e.target.value), mes)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Periodo>
          <Periodo label="Mes">
            <select
              value={mes}
              onChange={(e) => cambiarPeriodo(anio, Number(e.target.value))}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {MESES_ES.map((nombre, i) => (
                <option key={i} value={i + 1}>
                  {nombre}
                </option>
              ))}
            </select>
          </Periodo>
          <p className="ml-auto text-sm text-muted-foreground">
            Cargando resultados de <strong className="text-foreground">{nombreMes(anio, mes)}</strong>
          </p>
        </CardContent>
      </Card>

      {clientes.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay clientes activos.</p>
      )}

      {/* Filas por cliente */}
      <div className="space-y-3">
        {clientes.map((c) => (
          <FilaCierre
            key={c.id}
            cliente={c}
            row={rows[c.id]!}
            setRow={(p) => setRow(c.id, p)}
            preview={preview(c)}
            registrado={yaRegistrado(c)}
            comisionPct={config.comisionPct}
            anio={anio}
            mes={mes}
          />
        ))}
      </div>
    </div>
  );
}

function Periodo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}

function FilaCierre({
  cliente,
  row,
  setRow,
  preview,
  registrado,
  comisionPct,
  anio,
  mes,
}: {
  cliente: ClienteCierre;
  row: Row;
  setRow: (p: Partial<Row>) => void;
  preview: MesLedger | null;
  registrado: boolean;
  comisionPct: number;
  anio: number;
  mes: number;
}) {
  const [pending, start] = useTransition();

  function guardar() {
    if (row.valor.trim() === "" || Number.isNaN(Number(row.valor))) {
      toast.error("Ingresa un valor numérico.");
      return;
    }
    start(async () => {
      const res = await guardarRendimiento({
        clienteId: cliente.id,
        anio,
        mes,
        modo: row.modo,
        valor: Number(row.valor),
        descripcion: row.descripcion || null,
      });
      res.ok ? toast.success(`${cliente.nombre}: guardado.`) : toast.error(res.error);
    });
  }

  const adornment = row.modo === "porcentaje" ? "%" : "$";

  return (
    <Card>
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.2fr_2.4fr_auto] lg:items-center">
        <div className="flex items-center gap-2">
          <div>
            <p className="font-medium">{cliente.nombre}</p>
            {registrado ? (
              <Badge variant="pos" className="mt-1 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Registrado
              </Badge>
            ) : (
              <Badge variant="muted" className="mt-1">
                Pendiente
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr_1.4fr]">
          <select
            value={row.modo}
            onChange={(e) => setRow({ modo: e.target.value as Modo })}
            className="h-10 rounded-md border border-input bg-background px-2 text-sm"
          >
            {(Object.keys(MODO_LABEL) as Modo[]).map((m) => (
              <option key={m} value={m}>
                {MODO_LABEL[m]}
              </option>
            ))}
          </select>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {adornment}
            </span>
            <Input
              type="number"
              step="0.0001"
              inputMode="decimal"
              value={row.valor}
              onChange={(e) => setRow({ valor: e.target.value })}
              placeholder="0.00"
              className="pl-7"
            />
          </div>
          <Input
            value={row.descripcion}
            onChange={(e) => setRow({ descripcion: e.target.value })}
            placeholder="Descripción (opcional)"
          />
        </div>

        <div className="flex items-center justify-between gap-4 lg:justify-end">
          <Preview p={preview} comisionPct={comisionPct} />
          <Button variant="gold" size="sm" onClick={guardar} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Preview({ p, comisionPct }: { p: MesLedger | null; comisionPct: number }) {
  if (!p) return <span className="text-xs text-muted-foreground">Vista previa…</span>;
  return (
    <div className="text-right text-xs">
      <div className="text-muted-foreground">
        Base: <MoneyText value={p.baseOperativa} className="text-foreground" />
      </div>
      <div className="text-muted-foreground">
        Comisión ({comisionPct}%):{" "}
        <span className="text-brand-gold-600">
          <MoneyText value={p.comision} />
        </span>
      </div>
      <div className="font-medium">
        Neto:{" "}
        <span className={p.rendNeto >= 0 ? "text-pos" : "text-neg"}>
          {formatUSDSigned(p.rendNeto)} ({formatPct(p.roiMes)})
        </span>
      </div>
      <div className="font-semibold">
        Saldo: <MoneyText value={p.saldoFinal} />
      </div>
    </div>
  );
}

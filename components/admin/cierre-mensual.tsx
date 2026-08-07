"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Save, SaveAll } from "lucide-react";
import { toast } from "sonner";
import {
  construirCadena,
  monthKey,
  type LedgerConfig,
  type MesLedger,
  type Modo,
} from "@/lib/finance/ledger";
import { guardarRendimiento, guardarRendimientosLote } from "@/app/actions/rendimientos";
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
  /** Base de comisión propia del mes (null = se comisiona el resultado entero).
   *  Debe viajar hasta aquí: la vista previa reconstruye TODA la cadena y sin
   *  esto el déficit acumulado saldría mal en cuentas con comisión informativa. */
  resultadoComisionable: number | null;
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
  /** Config efectiva del cliente (global + overrides propios de % y política). */
  config: LedgerConfig;
  rendimientos: RendimientoLite[];
  movimientos: MovimientoLite[];
};

type Row = { modo: Modo; valor: string; comisionable: string; descripcion: string };

/** Fila por defecto: evita crashear si la lista de clientes crece tras una
 *  revalidación (un cliente nuevo aún sin entrada en el estado `rows`). */
const ROW_VACIA: Row = { modo: "porcentaje", valor: "", comisionable: "", descripcion: "" };

/** Base de comisión escrita por el operador (vacío = comisiona el resultado entero). */
function baseComisionable(row: Row): number | null {
  const t = row.comisionable.trim();
  if (t === "" || Number.isNaN(Number(t))) return null;
  return Number(t);
}

const MODO_LABEL: Record<Modo, string> = {
  porcentaje: "Porcentaje (%)",
  monto: "Monto (USD)",
  saldo_final: "Saldo final (USD)",
};

export function CierreMensual({
  clientes,
  anioInicial,
  mesInicial,
  anioMin,
}: {
  clientes: ClienteCierre[];
  anioInicial: number;
  mesInicial: number;
  anioMin: number;
}) {
  const [anio, setAnio] = useState(anioInicial);
  const [mes, setMes] = useState(mesInicial);
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    initRows(clientes, anioInicial, mesInicial),
  );
  const [savingAll, startAll] = useTransition();

  const anios: number[] = [];
  for (let a = anioMin; a <= anioInicial; a++) anios.push(a);

  function initRows(cs: ClienteCierre[], a: number, m: number): Record<string, Row> {
    const out: Record<string, Row> = {};
    for (const c of cs) {
      const ex = c.rendimientos.find((r) => r.anio === a && r.mes === m);
      out[c.id] = {
        modo: ex?.modo ?? "porcentaje",
        valor: ex ? String(ex.valor) : "",
        comisionable: ex?.resultadoComisionable != null ? String(ex.resultadoComisionable) : "",
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
    setRows((prev) => ({ ...prev, [id]: { ...(prev[id] ?? ROW_VACIA), ...patch } }));
  }

  function preview(c: ClienteCierre): MesLedger | null {
    const row = rows[c.id] ?? ROW_VACIA;
    if (row.valor.trim() === "" || Number.isNaN(Number(row.valor))) return null;
    const rends = c.rendimientos.filter((r) => !(r.anio === anio && r.mes === mes));
    rends.push({
      anio,
      mes,
      modo: row.modo,
      valor: Number(row.valor),
      resultadoComisionable: baseComisionable(row),
      descripcion: null,
    });
    const meses = construirCadena({
      capitalInicial: c.capitalInicial,
      fechaIngreso: c.fechaIngreso,
      hasta: { anio, mes },
      rendimientos: rends,
      movimientos: c.movimientos,
      config: c.config, // condiciones PROPIAS del cliente (% y política)
    });
    return meses.find((x) => x.anio === anio && x.mes === mes) ?? null;
  }

  function yaRegistrado(c: ClienteCierre) {
    return c.rendimientos.some((r) => r.anio === anio && r.mes === mes);
  }

  // Un cliente solo "aplica" al período si ya había ingresado ese mes: un
  // resultado anterior a su fecha de ingreso quedaría fuera de la cadena
  // derive-on-read (dato huérfano invisible).
  const periodoKey = monthKey(anio, mes);
  const aplica = (c: ClienteCierre) => periodoKey >= c.fechaIngreso.slice(0, 7);

  const elegibles = clientes.filter(aplica);
  const registrados = elegibles.filter(yaRegistrado).length;
  const pendientes = elegibles.length - registrados;

  function conValorValido() {
    return elegibles.filter((c) => {
      const row = rows[c.id];
      if (!row || row.valor.trim() === "" || Number.isNaN(Number(row.valor))) return false;
      // Omite filas idénticas al rendimiento ya guardado: evita upserts y
      // registros de auditoría "editar" espurios al usar "Guardar todos".
      const ex = c.rendimientos.find((r) => r.anio === anio && r.mes === mes);
      if (
        ex &&
        ex.modo === row.modo &&
        ex.valor === Number(row.valor) &&
        (ex.resultadoComisionable ?? null) === baseComisionable(row) &&
        (ex.descripcion ?? "") === row.descripcion
      ) {
        return false;
      }
      return true;
    });
  }

  function guardarTodos() {
    const lista = conValorValido();
    if (lista.length === 0) {
      toast.info("No hay cambios pendientes por guardar.");
      return;
    }
    startAll(async () => {
      const inputs = lista.map((c) => {
        const row = rows[c.id] ?? ROW_VACIA;
        return {
          clienteId: c.id,
          anio,
          mes,
          modo: row.modo,
          valor: Number(row.valor),
          resultadoComisionable: baseComisionable(row),
          descripcion: row.descripcion || null,
        };
      });
      const res = await guardarRendimientosLote(inputs);
      if (res.ok && res.data) {
        if (res.data.errores.length > 0) {
          toast.error(
            `${res.data.guardados} guardado(s); ${res.data.errores.length} con error: ${res.data.errores[0]?.error ?? ""}`,
          );
        } else {
          toast.success(`${res.data.guardados} resultado(s) guardados.`);
        }
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Selector de periodo */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4 sm:p-5">
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
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <Badge variant={registrados > 0 ? "pos" : "muted"}>Registrados: {registrados}</Badge>
            <Badge variant={pendientes > 0 ? "gold" : "muted"}>Pendientes: {pendientes}</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={guardarTodos}
              disabled={savingAll || clientes.length === 0}
            >
              {savingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SaveAll className="h-4 w-4" />
              )}
              Guardar todos
            </Button>
          </div>
        </CardContent>
      </Card>

      {clientes.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay clientes activos.</p>
      )}

      {/* Filas por cliente */}
      <div className="space-y-3">
        {clientes.map((c) =>
          aplica(c) ? (
            <FilaCierre
              key={c.id}
              cliente={c}
              row={rows[c.id] ?? ROW_VACIA}
              setRow={(p) => setRow(c.id, p)}
              preview={preview(c)}
              registrado={yaRegistrado(c)}
              comisionPct={c.config.comisionPct}
              anio={anio}
              mes={mes}
            />
          ) : (
            <FilaNoAplica key={c.id} nombre={c.nombre} fechaIngreso={c.fechaIngreso} />
          ),
        )}
      </div>
    </div>
  );
}

/** Cliente cuyo ingreso es posterior al período seleccionado: no aplica. */
function FilaNoAplica({ nombre, fechaIngreso }: { nombre: string; fechaIngreso: string }) {
  const [y, m] = fechaIngreso.split("-").map(Number);
  return (
    <Card className="opacity-70">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="font-medium">{nombre}</p>
        <p className="text-sm text-muted-foreground">
          No aplica — ingresó en {nombreMes(y ?? 0, m ?? 1)}
        </p>
      </CardContent>
    </Card>
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
        resultadoComisionable: baseComisionable(row),
        descripcion: row.descripcion || null,
      });
      res.ok ? toast.success(`${cliente.nombre}: guardado.`) : toast.error(res.error);
    });
  }

  const adornment = row.modo === "porcentaje" ? "%" : "$";
  // Cuentas con capital base pactado: el importe repartible se carga a mano.
  const conBase = cliente.config.capitalBase != null;

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

        <div className="grid gap-3 md:grid-cols-[1.1fr_1fr_1.4fr]">
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

        {cliente.config.comisionInformativa && (
          <div className="lg:col-span-3">
            <label
              htmlFor={`comisionable-${cliente.id}`}
              className="text-xs font-medium text-foreground"
            >
              {conBase
                ? "Ganancia liquidada del mes (base de tu comisión)"
                : "Base de comisión del mes (opcional)"}
            </label>
            <div className="relative mt-1 max-w-xs">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id={`comisionable-${cliente.id}`}
                type="number"
                step="0.01"
                inputMode="decimal"
                value={row.comisionable}
                onChange={(e) => setRow({ comisionable: e.target.value })}
                placeholder={
                  conBase ? "0.00 si este mes no hubo reparto" : "Vacío = se comisiona el resultado completo"
                }
                className="pl-7"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {conBase
                ? "Escribe cuánto se repartió este mes por encima del capital base. Si no hubo reparto, déjalo en 0: vacío también cuenta como 0 y no genera comisión."
                : "Úsala si parte del resultado no entra en el reparto (recompensas del bróker, dividendos): escribe aquí solo el resultado de trading."}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 lg:flex-nowrap lg:justify-end">
          <Preview
            p={preview}
            comisionPct={comisionPct}
            informativa={cliente.config.comisionInformativa === true}
          />
          <Button variant="gold" size="sm" onClick={guardar} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Preview({
  p,
  comisionPct,
  informativa,
}: {
  p: MesLedger | null;
  comisionPct: number;
  informativa: boolean;
}) {
  if (!p) return <span className="text-xs text-muted-foreground">Vista previa…</span>;
  return (
    <div className="text-right text-xs">
      <div className="text-muted-foreground">
        Base: <MoneyText value={p.baseOperativa} className="text-foreground" />
      </div>
      <div className="text-muted-foreground">
        Comisión ({comisionPct}%){informativa ? " · cobrada aparte" : ""}:{" "}
        <span className="text-brand-gold-600">
          <MoneyText value={p.comision} />
        </span>
      </div>
      {p.deficitAcum > 0 && (
        <div className="text-muted-foreground">
          Déficit por recuperar:{" "}
          <span className="text-neg">
            <MoneyText value={p.deficitAcum} />
          </span>
        </div>
      )}
      <div className="font-medium">
        {informativa ? "Resultado" : "Neto"}:{" "}
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

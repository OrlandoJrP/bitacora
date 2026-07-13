"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Lock, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  construirCadenaPool,
  type PoolInput,
} from "@/lib/finance/pool";
import { monthKey, type Modo } from "@/lib/finance/ledger";
import {
  cerrarMesFondo,
  eliminarRendimientoFondo,
  guardarRendimientoFondo,
} from "@/app/actions/fondo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { MoneyText } from "@/components/money-text";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MESES_ES, formatPct, formatUSDSigned, nombreMes } from "@/lib/format";

const MODO_LABEL: Record<Modo, string> = {
  porcentaje: "Porcentaje (%)",
  monto: "Monto (USD)",
  saldo_final: "Capital final (USD)",
};

export function CierreFondo({
  fondoId,
  input,
  anioInicial,
  mesInicial,
  anioMin,
}: {
  fondoId: string;
  input: PoolInput; // entrada real del motor (serializable)
  anioInicial: number;
  mesInicial: number;
  anioMin: number;
}) {
  const [anio, setAnio] = useState(anioInicial);
  const [mes, setMes] = useState(mesInicial);
  const [pending, start] = useTransition();
  const [delOpen, setDelOpen] = useState(false);

  const existente = useMemo(
    () => input.rendimientos.find((r) => r.anio === anio && r.mes === mes) ?? null,
    [input.rendimientos, anio, mes],
  );
  const overridesExistentes = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of input.overrides) {
      if (o.anio === anio && o.mes === mes) m.set(o.socioId, Number(o.saldoFinal));
    }
    return m;
  }, [input.overrides, anio, mes]);

  const [modo, setModo] = useState<Modo>("porcentaje");
  const [valor, setValor] = useState("");
  const [enCurso, setEnCurso] = useState(false);
  const [tasaTwr, setTasaTwr] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ovr, setOvr] = useState<Record<string, string>>({});

  function limpiarFormulario() {
    setModo("porcentaje");
    setValor("");
    setEnCurso(false);
    setTasaTwr("");
    setDescripcion("");
    setOvr({});
  }

  function cambiarPeriodo(a: number, m: number) {
    setAnio(a);
    setMes(m);
    const ex = input.rendimientos.find((r) => r.anio === a && r.mes === m);
    setModo(ex?.modo ?? "porcentaje");
    setValor(ex ? String(Number(ex.valor)) : "");
    setEnCurso(ex?.enCurso === true);
    setTasaTwr(ex?.tasaTwr != null && ex.tasaTwr !== "" ? String(Number(ex.tasaTwr)) : "");
    setDescripcion(ex?.descripcion ?? "");
    const o: Record<string, string> = {};
    for (const x of input.overrides) {
      if (x.anio === a && x.mes === m) o[x.socioId] = String(Number(x.saldoFinal));
    }
    setOvr(o);
  }

  // Estado inicial del período por defecto.
  useMemo(() => cambiarPeriodo(anioInicial, mesInicial), []); // eslint-disable-line react-hooks/exhaustive-deps

  const anios: number[] = [];
  for (let a = anioMin; a <= anioInicial; a++) anios.push(a);

  /* Vista previa: reconstruye la cadena con el valor tecleado. */
  const preview = useMemo(() => {
    if (valor.trim() === "" || Number.isNaN(Number(valor))) return null;
    const rends = input.rendimientos.filter((r) => !(r.anio === anio && r.mes === mes));
    rends.push({
      anio,
      mes,
      modo,
      valor: Number(valor),
      enCurso,
      tasaTwr: tasaTwr.trim() !== "" && !Number.isNaN(Number(tasaTwr)) ? Number(tasaTwr) : null,
    });
    const ovrs = input.overrides.filter((o) => !(o.anio === anio && o.mes === mes));
    for (const [socioId, v] of Object.entries(ovr)) {
      if (v.trim() !== "" && !Number.isNaN(Number(v))) {
        ovrs.push({ socioId, anio, mes, saldoFinal: Number(v) });
      }
    }
    const meses = construirCadenaPool({
      ...input,
      rendimientos: rends,
      overrides: ovrs,
      hasta: { anio, mes },
    });
    return meses.find((x) => x.key === monthKey(anio, mes)) ?? null;
  }, [input, anio, mes, modo, valor, enCurso, tasaTwr, ovr]);

  function guardar() {
    if (valor.trim() === "" || Number.isNaN(Number(valor))) {
      toast.error("Ingresa el resultado del fondo.");
      return;
    }
    if (preview && preview.descuadre !== 0) {
      toast.error(
        `Los saldos por socio no cuadran con el fondo (diferencia ${formatUSDSigned(preview.descuadre)}). Ajusta los repartos.`,
      );
      return;
    }
    const overrides = Object.entries(ovr)
      .filter(([, v]) => v.trim() !== "" && !Number.isNaN(Number(v)))
      .map(([socioId, v]) => ({ socioId, saldoFinal: Number(v) }));
    start(async () => {
      const res = await guardarRendimientoFondo({
        fondoId,
        anio,
        mes,
        modo,
        valor: Number(valor),
        enCurso,
        tasaTwr:
          tasaTwr.trim() !== "" && !Number.isNaN(Number(tasaTwr)) ? Number(tasaTwr) : null,
        descripcion: descripcion || null,
        overrides,
      });
      res.ok ? toast.success(res.mensaje ?? "Guardado.") : toast.error(res.error);
    });
  }

  function cerrarMes() {
    start(async () => {
      const res = await cerrarMesFondo({ fondoId, anio, mes });
      res.ok ? toast.success(res.mensaje ?? "Mes cerrado.") : toast.error(res.error);
      if (res.ok) setEnCurso(false);
    });
  }

  async function eliminar() {
    const res = await eliminarRendimientoFondo({ fondoId, anio, mes });
    res.ok ? toast.success(res.mensaje ?? "Eliminado.") : toast.error(res.error);
    setDelOpen(false);
    // Reset explícito: el prop `input` de este render aún contiene los datos
    // recién borrados (llegan frescos con el refresh RSC); no re-poblar de ahí.
    if (res.ok) limpiarFormulario();
  }

  const nombresSocios = new Map(input.socios.map((s) => [s.id, s.nombre]));

  return (
    <div className="space-y-5">
      {/* Período */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4 sm:p-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Año
            </label>
            <div>
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
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Mes
            </label>
            <div>
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
            </div>
          </div>
          <div className="flex items-center gap-2">
            {existente ? (
              existente.enCurso ? (
                <Badge variant="gold" className="gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  Flotante (en curso)
                </Badge>
              ) : (
                <Badge variant="pos" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Cerrado
                </Badge>
              )
            ) : (
              <Badge variant="muted">Sin registrar</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resultado del fondo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resultado de {nombreMes(anio, mes)}</CardTitle>
          <CardDescription>
            Se registra a nivel del FONDO y se reparte entre los socios proporcional a su
            capital (o con reparto manual).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1.1fr_1fr_1.6fr]">
            <select
              value={modo}
              onChange={(e) => setModo(e.target.value as Modo)}
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
                {modo === "porcentaje" ? "%" : "$"}
              </span>
              <Input
                type="number"
                step="0.0001"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0.00"
                className="pl-7"
              />
            </div>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción (opcional)"
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Mes en curso (flotante)</p>
              <p className="text-xs text-muted-foreground">
                Resultado provisional: actualízalo cuantas veces quieras y cierra el mes al
                terminar. Se muestra con indicador a los socios.
              </p>
            </div>
            <Switch checked={enCurso} onCheckedChange={setEnCurso} />
          </div>

          <div className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Tasa TWR del mes (%) — opcional</p>
                <p className="text-xs text-muted-foreground">
                  Solo si la tasa de gestión difiere de resultado/base (p. ej. un depósito de
                  fin de mes con exposición parcial). Vacío = se deriva sola.
                </p>
              </div>
              <div className="relative w-32 shrink-0">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={tasaTwr}
                  onChange={(e) => setTasaTwr(e.target.value)}
                  placeholder="auto"
                  className="pl-7 text-right"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vista previa del reparto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vista previa del reparto</CardTitle>
          <CardDescription>
            Deja el saldo final vacío para reparto proporcional; escribe un monto para
            fijarlo manualmente (reparto negociado).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!preview && (
            <p className="text-sm text-muted-foreground">
              Ingresa el resultado del fondo para ver el reparto…
            </p>
          )}
          {preview && (
            <>
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm sm:grid-cols-4">
                <Dato label="Base operativa" valor={<MoneyText value={preview.baseOperativa} />} />
                <Dato
                  label="Resultado"
                  valor={
                    <span className={preview.resultado >= 0 ? "text-pos" : "text-neg"}>
                      {formatUSDSigned(preview.resultado)} ({formatPct(preview.roiMes)})
                    </span>
                  }
                />
                <Dato label="Capital final" valor={<MoneyText value={preview.saldoFinal} />} />
                <Dato
                  label="Tu comisión acumulada"
                  valor={<MoneyText value={preview.comisionAcumulada} />}
                />
              </div>

              <div className="space-y-2">
                {preview.socios.map((s) => (
                  <div
                    key={s.socioId}
                    className="grid grid-cols-2 items-center gap-2 rounded-lg border p-3 sm:grid-cols-[1.2fr_1fr_1fr_1fr_1.1fr]"
                  >
                    <div>
                      <p className="text-sm font-medium">{nombresSocios.get(s.socioId)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPct(s.participacionFinal, false)} del fondo
                        {s.origen === "override" && " · manual"}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground sm:text-sm">
                      <MoneyText value={s.baseOperativa} />
                    </div>
                    <div
                      className={`text-right text-xs sm:text-sm ${s.resultado >= 0 ? "text-pos" : "text-neg"}`}
                    >
                      {formatUSDSigned(s.resultado)}
                    </div>
                    <div className="text-right text-sm font-semibold">
                      <MoneyText value={s.saldoFinal} />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Fijar saldo…"
                        value={ovr[s.socioId] ?? ""}
                        onChange={(e) =>
                          setOvr((prev) => ({ ...prev, [s.socioId]: e.target.value }))
                        }
                        className="h-9 text-right text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {preview.descuadre !== 0 && (
                <p className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Los saldos fijados no cuadran con el fondo: diferencia de{" "}
                  {formatUSDSigned(preview.descuadre)}.
                </p>
              )}
            </>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="gold" onClick={guardar} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {enCurso ? "Guardar flotante" : "Guardar mes cerrado"}
            </Button>
            {existente?.enCurso && (
              <Button variant="outline" onClick={cerrarMes} disabled={pending}>
                <Lock className="h-4 w-4" />
                Cerrar mes (confirmar resultado)
              </Button>
            )}
            {existente && (
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => setDelOpen(true)}
                disabled={pending}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="Eliminar resultado del mes"
        description={`Se eliminará el resultado de ${nombreMes(anio, mes)} y sus repartos manuales. Los meses siguientes se recalculan.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={eliminar}
      />
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium tabular">{valor}</p>
    </div>
  );
}

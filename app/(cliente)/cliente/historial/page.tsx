import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowDownLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { requireCliente, tenantCtx } from "@/lib/auth/session";
import { cargarLedgerCliente } from "@/lib/data/ledger";
import { roiCompuesto, round2, type MesLedger } from "@/lib/finance/ledger";
import { MoneyText } from "@/components/money-text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatPct, formatUSDSigned, nombreMes } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Historial" };

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const { session, clienteId } = await requireCliente();
  const { anio: anioParam } = await searchParams;
  const ledger = await cargarLedgerCliente(tenantCtx(session), clienteId);
  if (!ledger) notFound();

  const aniosDisponibles = [...new Set(ledger.meses.map((m) => m.anio))].sort((a, b) => b - a);
  const anioSel =
    anioParam && aniosDisponibles.includes(Number(anioParam)) ? Number(anioParam) : null;

  // Meses del período seleccionado (cronológicos para métricas, descendentes para mostrar).
  const cron = anioSel ? ledger.meses.filter((m) => m.anio === anioSel) : ledger.meses;
  const resultado = round2(cron.reduce((s, m) => s + m.rendNeto, 0));
  const roi = roiCompuesto(cron);
  const depositos = round2(cron.reduce((s, m) => s + m.depositos, 0));
  const retiros = round2(cron.reduce((s, m) => s + m.retiros, 0));
  const saldoCierre = cron[cron.length - 1]?.saldoFinal ?? 0;

  // Agrupar por año, en orden descendente (mes más reciente primero).
  const grupos: { anio: number; meses: MesLedger[] }[] = [];
  for (const m of [...cron].reverse()) {
    const g = grupos[grupos.length - 1];
    if (g && g.anio === m.anio) g.meses.push(m);
    else grupos.push({ anio: m.anio, meses: [m] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Historial</h1>
        <p className="text-sm text-muted-foreground">
          La evolución de tu cuenta, mes a mes. Toca un año para filtrar.
        </p>
      </div>

      {/* Filtro por año */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <ChipAnio href="/cliente/historial" active={!anioSel}>
          Todo
        </ChipAnio>
        {aniosDisponibles.map((a) => (
          <ChipAnio key={a} href={`/cliente/historial?anio=${a}`} active={anioSel === a}>
            {a}
          </ChipAnio>
        ))}
      </div>

      {/* Resumen del período */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4 sm:p-5">
        <ResumenDato
            label={anioSel ? `Resultado ${anioSel}` : "Resultado total"}
            value={
              <span className={resultado > 0 ? "text-pos" : resultado < 0 ? "text-neg" : ""}>
                {formatUSDSigned(resultado)}
              </span>
            }
            sub={formatPct(roi)}
          />
          <ResumenDato label="Depósitos" value={<MoneyText value={depositos} />} />
          <ResumenDato label="Retiros" value={<MoneyText value={retiros} />} />
          <ResumenDato
            label="Saldo al cierre"
            value={<MoneyText value={saldoCierre} className="font-semibold" />}
          />
        </CardContent>
      </Card>

      {/* Línea de tiempo */}
      {grupos.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aún no hay meses registrados.
        </p>
      )}

      {grupos.map((g) => {
        const anual = ledger.porAnio.find((a) => a.anio === g.anio);
        return (
          <section key={g.anio}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-lg font-semibold">{g.anio}</h2>
              {anual && (
                <span
                  className={cn(
                    "text-sm font-medium tabular",
                    anual.rendNeto > 0
                      ? "text-pos"
                      : anual.rendNeto < 0
                        ? "text-neg"
                        : "text-muted-foreground",
                  )}
                >
                  {formatUSDSigned(anual.rendNeto)} · {formatPct(anual.roiAnual)} en el año
                </span>
              )}
            </div>
            <ol className="relative ml-2 border-l border-border">
              {g.meses.map((m) => (
                <MesItem key={m.key} m={m} />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

/* ── Piezas locales ──────────────────────────────────────────────────────── */

function ChipAnio({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-brand-navy bg-brand-navy text-brand-cream"
          : "border-border bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

function ResumenDato({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-lg font-semibold tabular">{value}</p>
      {sub && <p className="text-xs text-muted-foreground tabular">{sub}</p>}
    </div>
  );
}

function MesItem({ m }: { m: MesLedger }) {
  const pos = m.tieneRendimiento && m.rendNeto > 0;
  const neg = m.tieneRendimiento && m.rendNeto < 0;

  return (
    <li className="relative mb-4 ml-5 last:mb-0 sm:ml-6">
      {/* Nodo de la línea de tiempo */}
      <span
        className={cn(
          "absolute -left-[26px] top-6 h-3 w-3 rounded-full ring-4 ring-background sm:-left-[30px]",
          pos ? "bg-pos" : neg ? "bg-neg" : "bg-muted-foreground/40",
        )}
      />

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-serif text-base font-semibold">{nombreMes(m.anio, m.mes)}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <MoneyText value={m.saldoInicial} />
              <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <MoneyText value={m.saldoFinal} className="font-semibold text-foreground" />
            </p>
            {m.descripcion && (
              <p className="mt-1 text-xs text-muted-foreground">{m.descripcion}</p>
            )}
          </div>

          <div className="shrink-0 text-right">
            {m.tieneRendimiento ? (
              <>
                <p
                  className={cn(
                    "font-semibold tabular",
                    pos ? "text-pos" : neg ? "text-neg" : "text-muted-foreground",
                  )}
                >
                  {formatUSDSigned(m.rendNeto)}
                </p>
                <p
                  className={cn(
                    "text-xs tabular",
                    pos ? "text-pos" : neg ? "text-neg" : "text-muted-foreground",
                  )}
                >
                  {formatPct(m.roiMes)}
                </p>
              </>
            ) : (
              <Badge variant="muted">Sin resultado</Badge>
            )}
          </div>
        </div>

        {/* Movimientos del mes */}
        {m.movimientos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
            {m.movimientos.map((mov, i) => (
              <span
                key={i}
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
                  mov.tipo === "deposito" ? "bg-pos/10 text-pos" : "bg-neg/10 text-neg",
                )}
              >
                {mov.tipo === "deposito" ? (
                  <ArrowDownLeft className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                )}
                <MoneyText value={mov.monto} className="font-medium" />
                {mov.descripcion && (
                  <span className="truncate opacity-80">· {mov.descripcion}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

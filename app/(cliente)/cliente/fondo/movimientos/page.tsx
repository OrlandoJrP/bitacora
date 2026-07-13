import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Link2 } from "lucide-react";
import { requireSocio } from "@/lib/auth/socio";
import { tenantCtx } from "@/lib/auth/session";
import { cargarPool } from "@/lib/data/pool";
import { MoneyText } from "@/components/money-text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FondoTabs } from "@/components/cliente/fondo/fondo-tabs";
import { formatFechaLarga } from "@/lib/format";

export const metadata: Metadata = { title: "Movimientos del fondo" };

export default async function MovimientosFondoSocioPage() {
  const ctx = await requireSocio();
  const pool = await cargarPool(tenantCtx(ctx.session), ctx.fondoId);
  if (!pool) notFound();

  const nombrePorSocio = new Map(pool.socios.map((s) => [s.id, s.nombre]));
  const movimientos = [...pool.movimientos].sort((a, b) =>
    a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Movimientos</h1>
          <p className="text-sm text-muted-foreground">
            Aportes y retiros de todos los socios del fondo.
          </p>
        </div>
        <FondoTabs />
      </div>

      <div className="space-y-3">
        {movimientos.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
        )}
        {movimientos.map((m) => {
          const esPropio = m.socioId === ctx.socioId;
          return (
            <Card key={m.id} className={esPropio ? "border-brand-gold/40" : ""}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                      m.tipo === "deposito" ? "bg-pos/15 text-pos" : "bg-neg/15 text-neg"
                    }`}
                  >
                    {m.tipo === "deposito" ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {nombrePorSocio.get(m.socioId) ?? "—"}
                      {esPropio && (
                        <Badge variant="gold" className="ml-2">
                          Tú
                        </Badge>
                      )}
                      {m.transferenciaId && (
                        <Badge variant="outline" className="ml-2 gap-1">
                          <Link2 className="h-3 w-3" /> transferencia
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatFechaLarga(m.fecha)}
                      {m.descripcion ? ` · ${m.descripcion}` : ""}
                    </p>
                  </div>
                </div>
                <p
                  className={`tabular shrink-0 font-semibold ${
                    m.tipo === "deposito" ? "text-pos" : "text-neg"
                  }`}
                >
                  {m.tipo === "deposito" ? "+" : "−"}
                  <MoneyText value={m.monto} />
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

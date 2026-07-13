import Link from "next/link";
import type { Metadata } from "next";
import { asc, notInArray } from "drizzle-orm";
import {
  ArrowLeftRight,
  CalendarCheck,
  Download,
  FileText,
  Info,
  PiggyBank,
} from "lucide-react";
import { requireAdmin, tenantCtx } from "@/lib/auth/session";
import { cargarPoolsTodos } from "@/lib/data/pool";
import { withTenant } from "@/lib/db";
import { clientes, fondoSocios } from "@/drizzle/schema";
import { StatCard } from "@/components/stat-card";
import { MoneyText, PctText } from "@/components/money-text";
import { AreaSaldo } from "@/components/charts/area-saldo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CrearFondoButton,
  EditarFondoButton,
  NuevoSocioButton,
} from "@/components/admin/fondo/fondo-botones";
import { SocioRowActions } from "@/components/admin/fondo/socio-row-actions";
import { etiquetaMesCorta, formatPct, formatUSDSigned, nombreMes } from "@/lib/format";

export const metadata: Metadata = { title: "Fondo común" };

export default async function FondoPage() {
  const session = await requireAdmin();
  const ctx = tenantCtx(session);
  const pools = await cargarPoolsTodos(ctx);
  const pool = pools[0] ?? null; // MVP: un fondo

  if (!pool) {
    return (
      <div className="mx-auto max-w-xl space-y-6 pt-10 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-gold/15 text-brand-gold-600">
          <PiggyBank className="h-8 w-8" />
        </span>
        <div>
          <h1 className="font-serif text-2xl font-semibold">Fondo común</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Una cuenta compartida donde varios socios invierten juntos: el resultado se
            registra a nivel del fondo y cada socio mantiene su % de participación. Tu
            comisión es informativa (no se descuenta de los saldos). No afecta en nada a
            tus clientes individuales.
          </p>
        </div>
        <CrearFondoButton />
      </div>
    );
  }

  const r = pool.resumen;
  const f = pool.fondo;

  // Clientes sin membresía en fondo (para "vincular" en el alta de socio).
  const disponibles = await withTenant(ctx, async (tx) => {
    const socios = await tx
      .select({ clienteId: fondoSocios.clienteId })
      .from(fondoSocios);
    const usados = socios.map((s) => s.clienteId).filter((x): x is string => !!x);
    const base = tx
      .select({ id: clientes.id, nombre: clientes.nombre, email: clientes.email })
      .from(clientes);
    return usados.length
      ? base.where(notInArray(clientes.id, usados)).orderBy(asc(clientes.nombre))
      : base.orderBy(asc(clientes.nombre));
  });

  const chart = pool.meses.map((m) => ({
    label: etiquetaMesCorta(m.anio, m.mes),
    saldo: m.saldoFinal,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold">
            {f.nombre}
            {r.flotante && (
              <Badge variant="gold" className="gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                {nombreMes(r.flotante.anio, r.flotante.mes)} en curso
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Fondo compartido · {pool.socios.length} socio(s) · desde{" "}
            {nombreMes(Number(f.fechaInicio.slice(0, 4)), Number(f.fechaInicio.slice(5, 7)))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="gold" size="sm">
            <Link href="/admin/fondo/cierre">
              <CalendarCheck className="h-4 w-4" /> Resultado del mes
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/fondo/movimientos">
              <ArrowLeftRight className="h-4 w-4" /> Movimientos
            </Link>
          </Button>
          <EditarFondoButton
            fondo={{
              id: f.id,
              nombre: f.nombre,
              fechaInicio: f.fechaInicio,
              capitalInicial: f.capitalInicial,
              comisionPct: f.comisionPct,
              baseComision: f.baseComision,
              notas: f.notas,
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Capital del fondo"
          value={<MoneyText value={r.capitalActual} />}
          hint={
            r.flotante
              ? `Confirmado: ${formatUSDSigned(r.capitalConfirmado).replace("+", "")}`
              : "Al último cierre"
          }
        />
        <StatCard
          label={`Rendimiento ${new Date().getUTCFullYear()} (TWR)`}
          value={<PctText fraction={r.twrAnual} />}
          hint="Composición mensual, sin distorsión por aportes"
        />
        <StatCard
          label="Rendimiento desde inicio (TWR)"
          value={<PctText fraction={r.twrDesdeInicio} />}
        />
        <StatCard
          label="Ganancia acumulada"
          value={
            <span className={r.gananciaAcumulada >= 0 ? "text-pos" : "text-neg"}>
              {formatUSDSigned(r.gananciaAcumulada)}
            </span>
          }
        />
      </div>

      {/* Comisión informativa del operador */}
      <Card className="border-brand-gold/40 bg-brand-gold/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gold/20 text-brand-gold-600">
              <Info className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium">
                Tu comisión acumulada ({formatPct(Number(f.comisionPct) / 100, false)}) — informativa
              </p>
              <p className="text-xs text-muted-foreground">
                {f.baseComision === "ganancia_neta"
                  ? "35% sobre la ganancia neta acumulada del fondo."
                  : "Sobre la suma de los meses positivos."}{" "}
                No se descuenta a los socios: los saldos del fondo son brutos.
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-serif text-3xl font-semibold text-brand-gold-600 tabular">
              <MoneyText value={r.comisionPorCobrar} />
            </p>
            {r.flotante && (
              <p className="text-xs text-muted-foreground">
                Confirmada: <MoneyText value={r.comisionConfirmada} />
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Socios */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between space-y-0 gap-3">
          <div>
            <CardTitle className="text-base">Posición por socio</CardTitle>
            <CardDescription>Capital, participación y rentabilidad.</CardDescription>
          </div>
          <NuevoSocioButton fondoId={f.id} clientesDisponibles={disponibles} />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead className="text-right">Capital actual</TableHead>
                <TableHead className="text-right">% del fondo</TableHead>
                <TableHead className="text-right">Aportado</TableHead>
                <TableHead className="text-right">Retiros</TableHead>
                <TableHead className="text-right">Ganancia neta</TableHead>
                <TableHead className="text-right">Ganancia/Aportado</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.socios.map((s) => {
                const socioDb = pool.socios.find((x) => x.id === s.socioId);
                return (
                  <TableRow key={s.socioId} className={s.estado === "inactivo" ? "opacity-60" : ""}>
                    <TableCell>
                      <span className="font-medium">{s.nombre}</span>{" "}
                      {s.estado === "inactivo" && (
                        <Badge variant="muted" className="ml-1">
                          salió
                        </Badge>
                      )}
                      {socioDb && !socioDb.clienteId && s.estado === "activo" && (
                        <Badge variant="outline" className="ml-1">
                          sin acceso
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {s.capitalActual !== 0 || s.estado === "activo" ? (
                        <MoneyText value={s.capitalActual} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPct(s.participacion, false)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <MoneyText value={s.totalAportado} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <MoneyText value={s.totalRetirado} />
                    </TableCell>
                    <TableCell
                      className={`text-right ${s.gananciaNeta >= 0 ? "text-pos" : "text-neg"}`}
                    >
                      {formatUSDSigned(s.gananciaNeta)}
                    </TableCell>
                    <TableCell className="text-right">{formatPct(s.rentabilidad)}</TableCell>
                    <TableCell>
                      {socioDb && (
                        <SocioRowActions
                          socio={{
                            id: socioDb.id,
                            nombre: socioDb.nombre,
                            estado: socioDb.estado,
                            notas: socioDb.notas,
                            tieneAcceso: !!socioDb.clienteId,
                          }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Evolución + descargas */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between space-y-0 gap-3">
          <div>
            <CardTitle className="text-base">Evolución del capital</CardTitle>
            <CardDescription>
              {r.flotante ? "Incluye el mes en curso (flotante)." : "Meses cerrados."}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/export-fondo?fondo=${f.id}`}>
                <Download className="h-4 w-4" /> Excel
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/reporte-fondo-pdf?fondo=${f.id}`} target="_blank" rel="noreferrer">
                <FileText className="h-4 w-4" /> PDF
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <AreaSaldo data={chart} height={240} />
        </CardContent>
      </Card>
    </div>
  );
}

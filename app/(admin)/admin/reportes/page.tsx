import type { Metadata } from "next";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { requireAdmin, tenantCtx } from "@/lib/auth/session";
import { cargarLedgersTodos } from "@/lib/data/ledger";
import { getConfig } from "@/lib/data/config";
import { StatCard } from "@/components/stat-card";
import { MoneyText, PctText } from "@/components/money-text";
import { AreaSaldo } from "@/components/charts/area-saldo";
import { Bars } from "@/components/charts/bars";
import { ReporteSelector } from "@/components/admin/reporte-selector";
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
  etiquetaMesCorta,
  formatPct,
  formatUSDSigned,
  mesActual,
  nombreMes,
} from "@/lib/format";

export const metadata: Metadata = { title: "Reportes" };

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const session = await requireAdmin();
  const { cliente: clienteId } = await searchParams;
  const [ledgers] = await Promise.all([cargarLedgersTodos(tenantCtx(session)), getConfig()]);
  const clientesOpts = ledgers.map((l) => ({ id: l.cliente.id, nombre: l.cliente.nombre }));
  const seleccion = ledgers.find((l) => l.cliente.id === clienteId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold">Reportes</h1>
          <p className="text-sm text-muted-foreground">Por cliente o consolidado, mensual y anual.</p>
        </div>
        <ReporteSelector clientes={clientesOpts} current={seleccion ? seleccion.cliente.id : "consolidado"} />
      </div>

      {seleccion ? (
        <ReporteCliente ledger={seleccion} />
      ) : (
        <ReporteConsolidado ledgers={ledgers} />
      )}
    </div>
  );
}

/* ── Reporte por cliente ─────────────────────────────────────────────────── */
function ReporteCliente({ ledger }: { ledger: Awaited<ReturnType<typeof cargarLedgersTodos>>[number] }) {
  const r = ledger.resumen;
  const id = ledger.cliente.id;
  const chart = ledger.meses.map((m) => ({ label: etiquetaMesCorta(m.anio, m.mes), saldo: m.saldoFinal }));
  const meses = [...ledger.meses].reverse();
  // En cuentas con comisión informativa el saldo es BRUTO: la comisión ya se
  // liquidó fuera de la cuenta, así que "neto" no es bruto − comisión.
  const informativa = ledger.config.comisionInformativa === true;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={`/api/export?formato=xlsx&cliente=${id}`}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/export?formato=csv&cliente=${id}`}>
            <Download className="h-4 w-4" /> CSV
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/reporte-pdf?cliente=${id}`} target="_blank" rel="noreferrer">
            <FileText className="h-4 w-4" /> Estado de cuenta PDF
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Saldo actual" value={<MoneyText value={r.saldoActual} />} />
        <StatCard label="ROI acumulado" value={<PctText fraction={r.roiAcumulado} />} />
        <StatCard
          label={informativa ? "Resultado generado" : "Ganancia neta"}
          value={<span className={r.gananciaNeta >= 0 ? "text-pos" : "text-neg"}>{formatUSDSigned(r.gananciaNeta)}</span>}
        />
        <StatCard
          label={informativa ? "Comisión (cobrada aparte)" : "Comisión generada"}
          value={<MoneyText value={r.comisionOperador} />}
          accent
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{ledger.cliente.nombre} · saldo en el tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          <AreaSaldo data={chart} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle mensual</CardTitle>
          <CardDescription>
            {informativa
              ? "Vista del operador. Los saldos son los de la cuenta real (brutos): la comisión se liquidó fuera, por eso no se resta aquí."
              : "Vista del operador (incluye bruto y comisión)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                {informativa && <TableHead className="text-right">Base comisión</TableHead>}
                <TableHead className="text-right">
                  {informativa ? "Comisión (aparte)" : "Comisión"}
                </TableHead>
                {!informativa && <TableHead className="text-right">Neto</TableHead>}
                <TableHead className="text-right">ROI</TableHead>
                <TableHead className="text-right">Saldo final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meses.map((m) => (
                <TableRow key={m.key}>
                  <TableCell className="font-medium">{nombreMes(m.anio, m.mes)}</TableCell>
                  <TableCell className="text-right"><MoneyText value={m.baseOperativa} /></TableCell>
                  <TableCell className="text-right"><MoneyText value={m.rendBruto} signed /></TableCell>
                  {informativa && (
                    <TableCell className="text-right text-muted-foreground">
                      <MoneyText value={m.baseComision} signed />
                    </TableCell>
                  )}
                  <TableCell className="text-right text-brand-gold-600"><MoneyText value={m.comision} /></TableCell>
                  {!informativa && (
                    <TableCell className={`text-right ${m.rendNeto >= 0 ? "text-pos" : "text-neg"}`}>
                      {formatUSDSigned(m.rendNeto)}
                    </TableCell>
                  )}
                  <TableCell className="text-right">{formatPct(m.roiMes)}</TableCell>
                  <TableCell className="text-right font-semibold"><MoneyText value={m.saldoFinal} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen anual</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Año</TableHead>
                <TableHead className="text-right">Aporte neto</TableHead>
                <TableHead className="text-right">Resultado neto</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead className="text-right">ROI anual</TableHead>
                <TableHead className="text-right">Saldo cierre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.porAnio.map((a) => (
                <TableRow key={a.anio}>
                  <TableCell className="font-medium">{a.anio}</TableCell>
                  <TableCell className="text-right"><MoneyText value={a.depositos - a.retiros} signed /></TableCell>
                  <TableCell className={`text-right ${a.rendNeto >= 0 ? "text-pos" : "text-neg"}`}>
                    {formatUSDSigned(a.rendNeto)}
                  </TableCell>
                  <TableCell className="text-right text-brand-gold-600"><MoneyText value={a.comision} /></TableCell>
                  <TableCell className="text-right">{formatPct(a.roiAnual)}</TableCell>
                  <TableCell className="text-right font-semibold"><MoneyText value={a.saldoFinal} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Reporte consolidado ─────────────────────────────────────────────────── */
function ReporteConsolidado({
  ledgers,
}: {
  ledgers: Awaited<ReturnType<typeof cargarLedgersTodos>>;
}) {
  const { anio } = mesActual();

  const aum = ledgers
    .filter((l) => l.cliente.estado === "activo")
    .reduce((s, l) => s + l.resumen.saldoActual, 0);
  const comisionTotal = ledgers.reduce((s, l) => s + l.resumen.comisionOperador, 0);
  const netoTotal = ledgers.reduce((s, l) => s + l.resumen.gananciaNeta, 0);

  // Series temporales agregadas.
  const agg = new Map<string, { anio: number; mes: number; saldo: number; comision: number }>();
  for (const l of ledgers) {
    for (const m of l.meses) {
      const cur = agg.get(m.key) ?? { anio: m.anio, mes: m.mes, saldo: 0, comision: 0 };
      cur.saldo += m.saldoFinal;
      cur.comision += m.comision;
      agg.set(m.key, cur);
    }
  }
  const serie = [...agg.values()].sort((a, b) => (a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <a href="/api/export?formato=xlsx">
            <FileSpreadsheet className="h-4 w-4" /> Excel consolidado
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href="/api/export?tipo=comisiones&formato=xlsx">
            <Download className="h-4 w-4" /> Reporte de comisiones
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatCard label="AUM" value={<MoneyText value={aum} />} />
        <StatCard label="Resultado neto total" value={<MoneyText value={netoTotal} signed />} />
        <StatCard label="Comisión acumulada" value={<MoneyText value={comisionTotal} />} accent />
        <StatCard label="Clientes" value={ledgers.length} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolución del AUM</CardTitle>
          </CardHeader>
          <CardContent>
            <AreaSaldo data={serie.map((s) => ({ label: etiquetaMesCorta(s.anio, s.mes), saldo: s.saldo }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comisión mensual del operador</CardTitle>
          </CardHeader>
          <CardContent>
            <Bars data={serie.map((s) => ({ label: etiquetaMesCorta(s.anio, s.mes), valor: s.comision }))} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comisión del operador por cliente</CardTitle>
          <CardDescription>Tu ingreso acumulado y del año {anio}.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Saldo actual</TableHead>
                <TableHead className="text-right">Comisión {anio}</TableHead>
                <TableHead className="text-right">Comisión acumulada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgers.map((l) => {
                const comAnio = l.meses
                  .filter((m) => m.anio === anio)
                  .reduce((s, m) => s + m.comision, 0);
                return (
                  <TableRow key={l.cliente.id}>
                    <TableCell className="font-medium">{l.cliente.nombre}</TableCell>
                    <TableCell className="text-right"><MoneyText value={l.resumen.saldoActual} /></TableCell>
                    <TableCell className="text-right"><MoneyText value={comAnio} /></TableCell>
                    <TableCell className="text-right text-brand-gold-600">
                      <MoneyText value={l.resumen.comisionOperador} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { auditoria } from "@/drizzle/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatFechaHora } from "@/lib/format";

export const metadata: Metadata = { title: "Auditoría" };

const ACCION_VARIANT: Record<string, "pos" | "gold" | "neg" | "muted"> = {
  crear: "pos",
  editar: "gold",
  eliminar: "neg",
};

export default async function AuditoriaPage() {
  await requireAdmin();
  const registros = await db
    .select()
    .from(auditoria)
    .orderBy(desc(auditoria.createdAt))
    .limit(300);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Auditoría</h1>
        <p className="text-sm text-muted-foreground">
          Bitácora de cambios: quién, qué y cuándo. Últimos {registros.length} eventos.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registros.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatFechaHora(r.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {r.actorEmail ?? r.actorUserId ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ACCION_VARIANT[r.accion] ?? "muted"}>{r.accion}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">{r.entidad}</TableCell>
                  <TableCell>
                    {(r.datosAntes || r.datosDespues) ? (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-brand-gold-600">Ver cambios</summary>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {r.datosAntes ? (
                            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 text-[11px]">
                              <span className="text-muted-foreground">Antes:</span>
                              {"\n"}
                              {JSON.stringify(r.datosAntes, null, 2)}
                            </pre>
                          ) : null}
                          {r.datosDespues ? (
                            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 text-[11px]">
                              <span className="text-muted-foreground">Después:</span>
                              {"\n"}
                              {JSON.stringify(r.datosDespues, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                      </details>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {registros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Sin eventos de auditoría aún.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

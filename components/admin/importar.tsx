"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Download, Eye, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { procesarImport, type ImportReport } from "@/app/actions/import";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Tipo = "rendimientos" | "movimientos";

export function Importar() {
  const [tipo, setTipo] = useState<Tipo>("rendimientos");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function run(dry: boolean) {
    if (!archivo) {
      toast.error("Selecciona un archivo primero.");
      return;
    }
    const fd = new FormData();
    fd.set("tipo", tipo);
    fd.set("archivo", archivo);
    if (dry) fd.set("dry", "1");
    start(async () => {
      const res = await procesarImport(fd);
      if (res.ok && res.data) {
        setReport(res.data);
        toast.success(res.mensaje ?? "Listo.");
        if (!dry) {
          setArchivo(null);
          if (inputRef.current) inputRef.current.value = "";
        }
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1 · Elige qué importar y descarga la plantilla</CardTitle>
          <CardDescription>Completa la plantilla y vuelve a subirla. Idempotente: no duplica.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tipo de datos
              </label>
              <select
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value as Tipo);
                  setReport(null);
                }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="rendimientos">Rendimientos mensuales</option>
                <option value="movimientos">Movimientos (depósitos / retiros)</option>
              </select>
            </div>
            <Button asChild variant="outline">
              <a href={`/api/plantilla?tipo=${tipo}`}>
                <Download className="h-4 w-4" /> Descargar plantilla
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2 · Sube el archivo y valida</CardTitle>
          <CardDescription>Primero previsualiza; luego confirma la importación.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              setArchivo(e.target.files?.[0] ?? null);
              setReport(null);
            }}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-secondary/80"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => run(true)} disabled={pending || !archivo}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Previsualizar
            </Button>
            <Button
              variant="gold"
              onClick={() => run(false)}
              disabled={pending || !archivo || (report?.dryRun === true && report.errores.length > 0 && report.creados + report.actualizados === 0)}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar
            </Button>
          </div>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {report.dryRun ? (
                <>
                  <Eye className="h-4 w-4" /> Vista previa
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-pos" /> Resultado de la importación
                </>
              )}
            </CardTitle>
            <CardDescription>
              {report.total} fila(s) procesada(s) · {report.tipo}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="pos">Crear: {report.creados}</Badge>
              {report.tipo === "rendimientos" && (
                <Badge variant="gold">Actualizar: {report.actualizados}</Badge>
              )}
              {report.omitidos > 0 && <Badge variant="muted">Omitidos: {report.omitidos}</Badge>}
              {report.errores.length > 0 && (
                <Badge variant="neg">Con error: {report.errores.length}</Badge>
              )}
            </div>

            {report.errores.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Filas con problemas (no se importan)
                </p>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {report.errores.map((e) => (
                    <li key={e.fila}>
                      <span className="font-medium text-foreground">Fila {e.fila}:</span> {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.dryRun && report.creados + report.actualizados > 0 && (
              <p className="text-sm text-muted-foreground">
                Todo listo. Pulsa <strong>Importar</strong> para aplicar los cambios.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

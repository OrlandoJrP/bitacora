"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { actualizarConfig } from "@/app/actions/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AjustesForm({
  inicial,
}: {
  inicial: {
    comisionPct: string;
    usaHighWaterMark: boolean;
    pierdeSoloCliente: boolean;
    nombreFondo: string;
  };
}) {
  const [pending, start] = useTransition();
  const [hwm, setHwm] = useState(inicial.usaHighWaterMark);
  const [pierde, setPierde] = useState(inicial.pierdeSoloCliente);
  const [errs, setErrs] = useState<Record<string, string[]>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErrs({});
    start(async () => {
      const res = await actualizarConfig({
        comisionPct: String(fd.get("comisionPct") ?? ""),
        nombreFondo: String(fd.get("nombreFondo") ?? ""),
        usaHighWaterMark: hwm,
        pierdeSoloCliente: pierde,
      });
      res.ok ? toast.success(res.mensaje ?? "Guardado.") : (setErrs(res.fieldErrors ?? {}), toast.error(res.error));
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parámetros del fondo</CardTitle>
          <CardDescription>Afectan todos los cálculos al guardarse.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nombreFondo">Nombre del fondo</Label>
              <Input id="nombreFondo" name="nombreFondo" defaultValue={inicial.nombreFondo} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comisionPct">Comisión del operador (%)</Label>
              <Input
                id="comisionPct"
                name="comisionPct"
                type="number"
                step="0.001"
                min="0"
                max="100"
                defaultValue={inicial.comisionPct}
                required
              />
              {errs.comisionPct?.map((e) => (
                <p key={e} className="text-xs text-destructive">{e}</p>
              ))}
              <p className="text-xs text-muted-foreground">
                Solo se cobra sobre los meses con ganancia.
              </p>
            </div>
          </div>

          <Toggle
            titulo="High-water mark"
            descripcion="Si está activo, solo se cobra comisión cuando la cuenta supera su pico histórico (no se cobra dos veces por recuperar una caída)."
            checked={hwm}
            onChange={setHwm}
          />
          <Toggle
            titulo="El cliente asume solo las pérdidas"
            descripcion="Si está activo (recomendado), los meses negativos no generan comisión ni la descuentan. Si se desactiva, el operador comparte la pérdida (comisión negativa que amortigua al cliente)."
            checked={pierde}
            onChange={setPierde}
          />
        </CardContent>
      </Card>

      <Button type="submit" variant="gold" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Guardar ajustes
      </Button>
    </form>
  );
}

function Toggle({
  titulo,
  descripcion,
  checked,
  onChange,
}: {
  titulo: string;
  descripcion: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="font-medium">{titulo}</p>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

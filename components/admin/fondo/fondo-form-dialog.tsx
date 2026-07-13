"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { crearFondo, editarFondo } from "@/app/actions/fondo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type FondoEditable = {
  id: string;
  nombre: string;
  fechaInicio: string;
  capitalInicial: string;
  comisionPct: string;
  baseComision: "ganancia_neta" | "meses_positivos";
  notas: string | null;
};

export function FondoFormDialog({
  open,
  onOpenChange,
  fondo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fondo?: FondoEditable;
}) {
  const editMode = !!fondo;
  const [pending, start] = useTransition();
  const [errs, setErrs] = useState<Record<string, string[]>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      nombre: String(fd.get("nombre") ?? ""),
      fechaInicio: String(fd.get("fechaInicio") ?? ""),
      capitalInicial: String(fd.get("capitalInicial") ?? "0"),
      comisionPct: String(fd.get("comisionPct") ?? "35"),
      baseComision: String(fd.get("baseComision") ?? "ganancia_neta"),
      notas: String(fd.get("notas") ?? ""),
    };
    setErrs({});
    start(async () => {
      const res = editMode
        ? await editarFondo({ id: fondo!.id, ...payload })
        : await crearFondo(payload);
      if (res.ok) {
        toast.success(res.mensaje ?? "Guardado.");
        onOpenChange(false);
      } else {
        setErrs(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editMode ? "Editar fondo" : "Crear fondo común"}</DialogTitle>
          <DialogDescription>
            Cuenta compartida entre socios. Tu comisión es informativa: nunca se
            descuenta de los saldos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre del fondo</Label>
            <Input id="nombre" name="nombre" defaultValue={fondo?.nombre} required />
            {errs.nombre?.map((e) => (
              <p key={e} className="text-xs text-destructive">{e}</p>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fechaInicio">Fecha de inicio</Label>
              <Input
                id="fechaInicio"
                name="fechaInicio"
                type="date"
                defaultValue={fondo?.fechaInicio}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capitalInicial">Capital semilla (USD)</Label>
              <Input
                id="capitalInicial"
                name="capitalInicial"
                type="number"
                step="0.01"
                min="0"
                defaultValue={fondo?.capitalInicial ?? "0"}
              />
              <p className="text-xs text-muted-foreground">
                Capital con el que arranca el fondo (se asigna a socios al darlos de alta).
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="comisionPct">Tu comisión (%)</Label>
              <Input
                id="comisionPct"
                name="comisionPct"
                type="number"
                step="0.001"
                min="0"
                max="100"
                defaultValue={fondo?.comisionPct ?? "35"}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="baseComision">Base de la comisión</Label>
              <select
                id="baseComision"
                name="baseComision"
                defaultValue={fondo?.baseComision ?? "ganancia_neta"}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ganancia_neta">Ganancia neta acumulada</option>
                <option value="meses_positivos">Solo meses positivos</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Input id="notas" name="notas" defaultValue={fondo?.notas ?? ""} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editMode ? "Guardar cambios" : "Crear fondo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

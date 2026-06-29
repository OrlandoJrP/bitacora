"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { crearMovimiento, editarMovimiento } from "@/app/actions/movimientos";
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

export type ClienteOpcion = { id: string; nombre: string };
export type MovimientoEditable = {
  id: string;
  clienteId: string;
  tipo: "deposito" | "retiro";
  monto: string;
  fecha: string;
  descripcion: string | null;
};

export function MovimientoFormDialog({
  open,
  onOpenChange,
  clientes,
  movimiento,
  clienteFijo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientes: ClienteOpcion[];
  movimiento?: MovimientoEditable;
  clienteFijo?: string;
}) {
  const editMode = !!movimiento;
  const [pending, start] = useTransition();
  const [errs, setErrs] = useState<Record<string, string[]>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      clienteId: String(fd.get("clienteId") ?? clienteFijo ?? ""),
      tipo: String(fd.get("tipo") ?? "deposito"),
      monto: String(fd.get("monto") ?? ""),
      fecha: String(fd.get("fecha") ?? ""),
      descripcion: String(fd.get("descripcion") ?? ""),
    };
    setErrs({});
    start(async () => {
      const res = editMode
        ? await editarMovimiento({ id: movimiento!.id, ...payload })
        : await crearMovimiento(payload);
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
          <DialogTitle>{editMode ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
          <DialogDescription>Depósito o retiro de capital del cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="clienteId">Cliente</Label>
            <select
              id="clienteId"
              name="clienteId"
              defaultValue={movimiento?.clienteId ?? clienteFijo ?? ""}
              disabled={!!clienteFijo}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {errs.clienteId?.map((e) => (
              <p key={e} className="text-xs text-destructive">{e}</p>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Tipo</Label>
              <select
                id="tipo"
                name="tipo"
                defaultValue={movimiento?.tipo ?? "deposito"}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="deposito">Depósito</option>
                <option value="retiro">Retiro</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monto">Monto (USD)</Label>
              <Input
                id="monto"
                name="monto"
                type="number"
                step="0.01"
                min="0"
                defaultValue={movimiento?.monto}
                required
              />
              {errs.monto?.map((e) => (
                <p key={e} className="text-xs text-destructive">{e}</p>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" name="fecha" type="date" defaultValue={movimiento?.fecha} required />
            {errs.fecha?.map((e) => (
              <p key={e} className="text-xs text-destructive">{e}</p>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Input
              id="descripcion"
              name="descripcion"
              defaultValue={movimiento?.descripcion ?? ""}
              placeholder="Ej. Aporte adicional, retiro parcial…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editMode ? "Guardar cambios" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

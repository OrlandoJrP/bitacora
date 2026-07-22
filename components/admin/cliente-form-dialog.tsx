"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { crearCliente, editarCliente } from "@/app/actions/clientes";
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
import { Textarea } from "@/components/ui/textarea";

export type ClienteEditable = {
  id: string;
  nombre: string;
  email: string;
  fechaIngreso: string;
  capitalInicial: string;
  estado: "activo" | "inactivo";
  comisionPct: string | null;
  politicaComision: "normal" | "hwm_saldo" | "deficit_pnl" | null;
  notas: string | null;
};

export function ClienteFormDialog({
  open,
  onOpenChange,
  cliente,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente?: ClienteEditable;
  onCreated?: (cred: { email: string; password: string }) => void;
}) {
  const editMode = !!cliente;
  const [pending, start] = useTransition();
  const [errs, setErrs] = useState<Record<string, string[]>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const base = {
      nombre: String(fd.get("nombre") ?? ""),
      email: String(fd.get("email") ?? ""),
      fechaIngreso: String(fd.get("fechaIngreso") ?? ""),
      capitalInicial: String(fd.get("capitalInicial") ?? ""),
      comisionPct: String(fd.get("comisionPct") ?? ""),
      politicaComision: String(fd.get("politicaComision") ?? ""),
      notas: String(fd.get("notas") ?? ""),
    };
    setErrs({});
    start(async () => {
      if (editMode) {
        const res = await editarCliente({
          id: cliente!.id,
          ...base,
          // El campo email está deshabilitado en edición (no viaja en FormData);
          // reinyectamos el original para que pase la validación. Es inmutable aquí.
          email: cliente!.email,
          estado: String(fd.get("estado") ?? "activo"),
        });
        if (res.ok) {
          toast.success("Cliente actualizado.");
          onOpenChange(false);
        } else {
          setErrs(res.fieldErrors ?? {});
          toast.error(res.error);
        }
      } else {
        const res = await crearCliente(base);
        if (res.ok) {
          toast.success("Cliente creado.");
          onOpenChange(false);
          if (res.data) onCreated?.({ email: res.data.email, password: res.data.passwordTemporal });
        } else {
          setErrs(res.fieldErrors ?? {});
          toast.error(res.error);
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editMode ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>
            {editMode
              ? "Actualiza los datos del inversionista."
              : "Se generará su usuario con una contraseña temporal."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <Campo id="nombre" label="Nombre completo" defaultValue={cliente?.nombre} errs={errs.nombre} required />
          <Campo
            id="email"
            label="Correo electrónico"
            type="email"
            defaultValue={cliente?.email}
            errs={errs.email}
            required
            disabled={editMode}
            hint={editMode ? "El correo de acceso no se puede cambiar aquí." : undefined}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo
              id="fechaIngreso"
              label="Fecha de ingreso"
              type="date"
              defaultValue={cliente?.fechaIngreso}
              errs={errs.fechaIngreso}
              required
            />
            <Campo
              id="capitalInicial"
              label="Capital inicial (USD)"
              type="number"
              step="0.01"
              defaultValue={cliente?.capitalInicial}
              errs={errs.capitalInicial}
              required
            />
          </div>
          {/* Condiciones propias (opcionales; vacío = configuración global) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="comisionPct">Comisión % propia (opcional)</Label>
              <Input
                id="comisionPct"
                name="comisionPct"
                type="number"
                step="0.001"
                min="0"
                max="100"
                placeholder="Vacío = global"
                defaultValue={cliente?.comisionPct ?? ""}
              />
              {errs.comisionPct?.map((e) => (
                <p key={e} className="text-xs text-destructive">{e}</p>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="politicaComision">Política de comisión</Label>
              <select
                id="politicaComision"
                name="politicaComision"
                defaultValue={cliente?.politicaComision ?? ""}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Global (ajustes del fondo)</option>
                <option value="normal">Normal (todo mes positivo)</option>
                <option value="hwm_saldo">High-water mark (saldo)</option>
                <option value="deficit_pnl">Déficit PNL (recupera pérdidas antes de cobrar)</option>
              </select>
            </div>
          </div>
          {editMode && (
            <div className="space-y-1.5">
              <Label htmlFor="estado">Estado</Label>
              <select
                id="estado"
                name="estado"
                defaultValue={cliente?.estado}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea id="notas" name="notas" defaultValue={cliente?.notas ?? ""} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editMode ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  id,
  label,
  errs,
  hint,
  ...props
}: {
  id: string;
  label: string;
  errs?: string[];
  hint?: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} {...props} />
      {hint && !errs?.length && <p className="text-xs text-muted-foreground">{hint}</p>}
      {errs?.map((e) => (
        <p key={e} className="text-xs text-destructive">
          {e}
        </p>
      ))}
    </div>
  );
}

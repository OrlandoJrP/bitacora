"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { crearSocio } from "@/app/actions/fondo";
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
import { CredencialesDialog } from "@/components/admin/credenciales-dialog";

type ModoAcceso = "sin_acceso" | "vincular" | "crear";

export function SocioFormDialog({
  open,
  onOpenChange,
  fondoId,
  clientesDisponibles,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fondoId: string;
  /** Clientes existentes SIN membresía en un fondo (para "vincular"). */
  clientesDisponibles: { id: string; nombre: string; email: string }[];
}) {
  const [pending, start] = useTransition();
  const [modo, setModo] = useState<ModoAcceso>("sin_acceso");
  const [errs, setErrs] = useState<Record<string, string[]>>({});
  const [cred, setCred] = useState<{ email: string; password: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErrs({});
    start(async () => {
      const res = await crearSocio({
        fondoId,
        nombre: String(fd.get("nombre") ?? ""),
        capitalInicial: String(fd.get("capitalInicial") ?? "0"),
        fechaAlta: String(fd.get("fechaAlta") ?? ""),
        modoAcceso: modo,
        clienteId: modo === "vincular" ? String(fd.get("clienteId") ?? "") : null,
        email: modo === "crear" ? String(fd.get("email") ?? "") : null,
        notas: String(fd.get("notas") ?? ""),
      });
      if (res.ok) {
        toast.success(res.mensaje ?? "Socio agregado.");
        onOpenChange(false);
        if (res.data?.email && res.data.passwordTemporal) {
          setCred({ email: res.data.email, password: res.data.passwordTemporal });
        }
      } else {
        setErrs(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo socio</DialogTitle>
            <DialogDescription>
              El socio participa del fondo con su % según su capital.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" name="nombre" required />
              {errs.nombre?.map((e) => (
                <p key={e} className="text-xs text-destructive">{e}</p>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fechaAlta">Fecha de alta</Label>
                <Input id="fechaAlta" name="fechaAlta" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="capitalInicial">Capital semilla (USD)</Label>
                <Input
                  id="capitalInicial"
                  name="capitalInicial"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                />
                <p className="text-xs text-muted-foreground">
                  Su parte del capital con que arranca el fondo (los aportes posteriores
                  se registran como movimientos).
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Acceso al portal</Label>
              <div className="grid gap-2">
                {(
                  [
                    ["sin_acceso", "Sin acceso (solo aparece en el fondo)"],
                    ["vincular", "Vincular a un cliente existente (reusa su login)"],
                    ["crear", "Crear acceso nuevo (correo + contraseña temporal)"],
                  ] as [ModoAcceso, string][]
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm ${
                      modo === value ? "border-brand-gold bg-brand-gold/10" : "border-input"
                    }`}
                  >
                    <input
                      type="radio"
                      name="modoAcceso"
                      value={value}
                      checked={modo === value}
                      onChange={() => setModo(value)}
                      className="accent-[#D4A574]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {modo === "vincular" && (
              <div className="space-y-1.5">
                <Label htmlFor="clienteId">Cliente</Label>
                <select
                  id="clienteId"
                  name="clienteId"
                  required
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {clientesDisponibles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} · {c.email}
                    </option>
                  ))}
                </select>
                {errs.clienteId?.map((e) => (
                  <p key={e} className="text-xs text-destructive">{e}</p>
                ))}
              </div>
            )}

            {modo === "crear" && (
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo del socio</Label>
                <Input id="email" name="email" type="email" required />
                {errs.email?.map((e) => (
                  <p key={e} className="text-xs text-destructive">{e}</p>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="notas">Notas (opcional)</Label>
              <Input id="notas" name="notas" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Agregar socio
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CredencialesDialog
        open={!!cred}
        onOpenChange={(v) => !v && setCred(null)}
        email={cred?.email ?? ""}
        password={cred?.password ?? ""}
      />
    </>
  );
}

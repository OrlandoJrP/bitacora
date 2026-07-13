"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  crearMovimientoFondo,
  eliminarMovimientoFondo,
  registrarTransferencia,
} from "@/app/actions/fondo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";

export type SocioOpcion = { id: string; nombre: string };

export function NuevoMovimientoFondoButton({ socios }: { socios: SocioOpcion[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [errs, setErrs] = useState<Record<string, string[]>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErrs({});
    start(async () => {
      const res = await crearMovimientoFondo({
        socioId: String(fd.get("socioId") ?? ""),
        tipo: String(fd.get("tipo") ?? "deposito"),
        monto: String(fd.get("monto") ?? ""),
        fecha: String(fd.get("fecha") ?? ""),
        descripcion: String(fd.get("descripcion") ?? ""),
      });
      if (res.ok) {
        toast.success(res.mensaje ?? "Registrado.");
        setOpen(false);
      } else {
        setErrs(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button variant="gold" onClick={() => setOpen(true)} disabled={socios.length === 0}>
        <Plus className="h-4 w-4" />
        Nuevo movimiento
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimiento del fondo</DialogTitle>
            <DialogDescription>Aporte o retiro de capital de un socio.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="socioId">Socio</Label>
              <select
                id="socioId"
                name="socioId"
                required
                defaultValue=""
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Selecciona…
                </option>
                {socios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tipo">Tipo</Label>
                <select
                  id="tipo"
                  name="tipo"
                  defaultValue="deposito"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="deposito">Aporte</option>
                  <option value="retiro">Retiro</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="monto">Monto (USD)</Label>
                <Input id="monto" name="monto" type="number" step="0.01" min="0" required />
                {errs.monto?.map((e) => (
                  <p key={e} className="text-xs text-destructive">{e}</p>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fecha">Fecha</Label>
              <Input id="fecha" name="fecha" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="descripcion">Concepto (opcional)</Label>
              <Input id="descripcion" name="descripcion" placeholder="Ej. Aporte, retiro personal…" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function TransferenciaButton({
  fondoId,
  socios,
}: {
  fondoId: string;
  socios: SocioOpcion[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [errs, setErrs] = useState<Record<string, string[]>>({});

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErrs({});
    start(async () => {
      const res = await registrarTransferencia({
        fondoId,
        socioOrigenId: String(fd.get("socioOrigenId") ?? ""),
        socioDestinoId: String(fd.get("socioDestinoId") ?? ""),
        monto: String(fd.get("monto") ?? ""),
        fechaSalida: String(fd.get("fechaSalida") ?? ""),
        fechaEntrada: String(fd.get("fechaEntrada") ?? ""),
        descripcion: String(fd.get("descripcion") ?? ""),
      });
      if (res.ok) {
        toast.success(res.mensaje ?? "Transferencia registrada.");
        setOpen(false);
      } else {
        setErrs(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={socios.length < 2}>
        <ArrowLeftRight className="h-4 w-4" />
        Transferencia entre socios
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferencia entre socios</DialogTitle>
            <DialogDescription>
              Un socio compra la participación de otro: retiro del origen + aporte del
              destino, enlazados. Las fechas pueden caer en meses distintos.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="socioOrigenId">Sale de</Label>
                <select
                  id="socioOrigenId"
                  name="socioOrigenId"
                  required
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Socio origen…
                  </option>
                  {socios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="socioDestinoId">Entra a</Label>
                <select
                  id="socioDestinoId"
                  name="socioDestinoId"
                  required
                  defaultValue=""
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Socio destino…
                  </option>
                  {socios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
                {errs.socioDestinoId?.map((e) => (
                  <p key={e} className="text-xs text-destructive">{e}</p>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monto">Monto (USD)</Label>
              <Input id="monto" name="monto" type="number" step="0.01" min="0" required />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fechaSalida">Fecha de salida</Label>
                <Input id="fechaSalida" name="fechaSalida" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fechaEntrada">Fecha de entrada</Label>
                <Input id="fechaEntrada" name="fechaEntrada" type="date" required />
                {errs.fechaEntrada?.map((e) => (
                  <p key={e} className="text-xs text-destructive">{e}</p>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="descripcion">Concepto (opcional)</Label>
              <Input id="descripcion" name="descripcion" placeholder="Ej. Compra de participación" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Registrar transferencia
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EliminarMovimientoFondoButton({
  movimientoId,
  esTransferencia = false,
}: {
  movimientoId: string;
  esTransferencia?: boolean;
}) {
  const [open, setOpen] = useState(false);
  async function doDelete() {
    const res = await eliminarMovimientoFondo({ id: movimientoId });
    res.ok ? toast.success(res.mensaje ?? "Movimiento eliminado.") : toast.error(res.error);
    setOpen(false);
  }
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:bg-destructive/10"
        onClick={() => setOpen(true)}
        aria-label={esTransferencia ? "Eliminar transferencia" : "Eliminar movimiento"}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={esTransferencia ? "Eliminar transferencia completa" : "Eliminar movimiento"}
        description={
          esTransferencia
            ? "Este movimiento es parte de una transferencia entre socios: se eliminarán LAS DOS patas (el retiro del origen y el depósito del destino). Los saldos se recalculan desde esos meses."
            : "Los saldos del fondo se recalculan desde ese mes. Esta acción no se puede deshacer."
        }
        confirmLabel={esTransferencia ? "Eliminar ambas patas" : "Eliminar"}
        destructive
        onConfirm={doDelete}
      />
    </>
  );
}

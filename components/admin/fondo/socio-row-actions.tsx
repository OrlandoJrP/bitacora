"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2, MoreHorizontal, Pencil } from "lucide-react";
import { toast } from "sonner";
import { editarSocio, otorgarAccesoSocio } from "@/app/actions/fondo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CredencialesDialog } from "@/components/admin/credenciales-dialog";

export type SocioEditable = {
  id: string;
  nombre: string;
  estado: "activo" | "inactivo";
  notas: string | null;
  tieneAcceso: boolean;
};

export function SocioRowActions({ socio }: { socio: SocioEditable }) {
  const [editOpen, setEditOpen] = useState(false);
  const [accesoOpen, setAccesoOpen] = useState(false);
  const [cred, setCred] = useState<{ email: string; password: string } | null>(null);
  const [pending, start] = useTransition();

  function onEditar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await editarSocio({
        id: socio.id,
        nombre: String(fd.get("nombre") ?? ""),
        estado: String(fd.get("estado") ?? "activo"),
        notas: String(fd.get("notas") ?? ""),
      });
      if (res.ok) {
        toast.success("Socio actualizado.");
        setEditOpen(false);
      } else toast.error(res.error);
    });
  }

  function onOtorgar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    start(async () => {
      const res = await otorgarAccesoSocio({ socioId: socio.id, email });
      if (res.ok && res.data) {
        setAccesoOpen(false);
        setCred({ email: res.data.email, password: res.data.passwordTemporal });
        toast.success("Acceso creado.");
      } else if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Editar
          </DropdownMenuItem>
          {!socio.tieneAcceso && (
            <DropdownMenuItem onSelect={() => setAccesoOpen(true)}>
              <KeyRound className="h-4 w-4" /> Otorgar acceso
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar socio</DialogTitle>
          </DialogHeader>
          <form onSubmit={onEditar} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" name="nombre" defaultValue={socio.nombre} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estado">Estado</Label>
              <select
                id="estado"
                name="estado"
                defaultValue={socio.estado}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo (retirado)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notas">Notas</Label>
              <Input id="notas" name="notas" defaultValue={socio.notas ?? ""} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={accesoOpen} onOpenChange={setAccesoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Otorgar acceso a {socio.nombre}</DialogTitle>
            <DialogDescription>
              Se creará un usuario con contraseña temporal para que vea el fondo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onOtorgar} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAccesoOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" variant="gold" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Crear acceso
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

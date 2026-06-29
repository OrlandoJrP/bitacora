"use client";

import { useState, useTransition } from "react";
import { KeyRound, MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  cambiarEstadoCliente,
  eliminarCliente,
  resetearPassword,
} from "@/app/actions/clientes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ClienteFormDialog, type ClienteEditable } from "./cliente-form-dialog";
import { CredencialesDialog } from "./credenciales-dialog";

export function ClienteRowActions({ cliente }: { cliente: ClienteEditable }) {
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [cred, setCred] = useState<{ email: string; password: string } | null>(null);
  const [, start] = useTransition();

  function toggle() {
    start(async () => {
      const nuevo = cliente.estado === "activo" ? "inactivo" : "activo";
      const res = await cambiarEstadoCliente({ id: cliente.id, estado: nuevo });
      res.ok ? toast.success(res.mensaje ?? "Actualizado.") : toast.error(res.error);
    });
  }

  async function doReset() {
    const res = await resetearPassword({ clienteId: cliente.id });
    if (res.ok && res.data) {
      setResetOpen(false);
      setCred({ email: cliente.email, password: res.data.passwordTemporal });
      toast.success("Contraseña restablecida.");
    } else if (!res.ok) {
      toast.error(res.error);
    }
  }

  async function doDelete() {
    const res = await eliminarCliente({ id: cliente.id });
    res.ok ? toast.success("Cliente eliminado.") : toast.error(res.error);
    setDelOpen(false);
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
          <DropdownMenuItem onSelect={() => setResetOpen(true)}>
            <KeyRound className="h-4 w-4" /> Restablecer contraseña
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggle}>
            <Power className="h-4 w-4" />
            {cliente.estado === "activo" ? "Desactivar" : "Activar"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDelOpen(true)}
            className="text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ClienteFormDialog open={editOpen} onOpenChange={setEditOpen} cliente={cliente} />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Restablecer contraseña"
        description={`Se generará una nueva contraseña temporal para ${cliente.nombre}. La actual dejará de funcionar.`}
        confirmLabel="Restablecer"
        onConfirm={doReset}
      />

      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="Eliminar cliente"
        description={`Esto eliminará a ${cliente.nombre} junto con su usuario, movimientos y resultados. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar definitivamente"
        destructive
        onConfirm={doDelete}
      />

      <CredencialesDialog
        open={!!cred}
        onOpenChange={(v) => !v && setCred(null)}
        email={cred?.email ?? ""}
        password={cred?.password ?? ""}
      />
    </>
  );
}

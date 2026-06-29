"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { eliminarMovimiento } from "@/app/actions/movimientos";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  MovimientoFormDialog,
  type ClienteOpcion,
  type MovimientoEditable,
} from "./movimiento-form-dialog";

export function MovimientoRowActions({
  movimiento,
  clientes,
}: {
  movimiento: MovimientoEditable;
  clientes: ClienteOpcion[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  async function doDelete() {
    const res = await eliminarMovimiento({ id: movimiento.id });
    res.ok ? toast.success("Movimiento eliminado.") : toast.error(res.error);
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDelOpen(true)}
            className="text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MovimientoFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        clientes={clientes}
        movimiento={movimiento}
      />

      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="Eliminar movimiento"
        description="Se recalcularán los saldos de los meses siguientes. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={doDelete}
      />
    </>
  );
}

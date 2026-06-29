"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MovimientoFormDialog, type ClienteOpcion } from "./movimiento-form-dialog";

export function NuevoMovimientoButton({ clientes }: { clientes: ClienteOpcion[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="gold" onClick={() => setOpen(true)} disabled={clientes.length === 0}>
        <Plus className="h-4 w-4" />
        Nuevo movimiento
      </Button>
      <MovimientoFormDialog open={open} onOpenChange={setOpen} clientes={clientes} />
    </>
  );
}

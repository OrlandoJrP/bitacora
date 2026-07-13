"use client";

import { useState } from "react";
import { Pencil, PiggyBank, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FondoFormDialog, type FondoEditable } from "./fondo-form-dialog";
import { SocioFormDialog } from "./socio-form-dialog";

export function CrearFondoButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="gold" size="lg" onClick={() => setOpen(true)}>
        <PiggyBank className="h-5 w-5" />
        Crear fondo común
      </Button>
      <FondoFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function EditarFondoButton({ fondo }: { fondo: FondoEditable }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Editar fondo
      </Button>
      <FondoFormDialog open={open} onOpenChange={setOpen} fondo={fondo} />
    </>
  );
}

export function NuevoSocioButton({
  fondoId,
  clientesDisponibles,
}: {
  fondoId: string;
  clientesDisponibles: { id: string; nombre: string; email: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="gold" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nuevo socio
      </Button>
      <SocioFormDialog
        open={open}
        onOpenChange={setOpen}
        fondoId={fondoId}
        clientesDisponibles={clientesDisponibles}
      />
    </>
  );
}

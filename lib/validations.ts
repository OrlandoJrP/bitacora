import { z } from "zod";

/** Acepta números o strings numéricos (de inputs de formulario). */
const numeroDesdeForm = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === "string" ? v.trim().replace(/,/g, "") : v))
  .pipe(z.coerce.number().finite());

export const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (usa AAAA-MM-DD).");

export const modoRendimiento = z.enum(["porcentaje", "monto", "saldo_final"]);
export const tipoMovimiento = z.enum(["deposito", "retiro"]);

/* ── Clientes ────────────────────────────────────────────────────────────── */
export const crearClienteSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio.").max(120),
  email: z.string().email("Correo inválido."),
  fechaIngreso: fechaISO,
  capitalInicial: numeroDesdeForm.refine((v) => v >= 0, "El capital no puede ser negativo."),
  notas: z.string().max(1000).optional().nullable(),
});

export const editarClienteSchema = crearClienteSchema.extend({
  id: z.string().uuid(),
  estado: z.enum(["activo", "inactivo"]),
});

export const idSchema = z.object({ id: z.string().uuid() });

export const resetPasswordSchema = z.object({
  userIdOrClienteId: z.string().uuid(),
});

/* ── Movimientos ─────────────────────────────────────────────────────────── */
export const crearMovimientoSchema = z.object({
  clienteId: z.string().uuid(),
  tipo: tipoMovimiento,
  monto: numeroDesdeForm.refine((v) => v > 0, "El monto debe ser mayor que 0."),
  fecha: fechaISO,
  descripcion: z.string().max(500).optional().nullable(),
});

export const editarMovimientoSchema = crearMovimientoSchema.extend({
  id: z.string().uuid(),
});

/* ── Rendimientos mensuales ──────────────────────────────────────────────── */
export const guardarRendimientoSchema = z
  .object({
    clienteId: z.string().uuid(),
    anio: z.coerce.number().int().min(2000).max(2200),
    mes: z.coerce.number().int().min(1).max(12),
    modo: modoRendimiento,
    valor: numeroDesdeForm,
    descripcion: z.string().max(500).optional().nullable(),
  })
  .refine(
    (d) => !(d.modo === "saldo_final" && d.valor < 0),
    { message: "El saldo final no puede ser negativo.", path: ["valor"] },
  );

export const eliminarRendimientoSchema = z.object({
  clienteId: z.string().uuid(),
  anio: z.coerce.number().int(),
  mes: z.coerce.number().int().min(1).max(12),
});

/* ── Configuración ───────────────────────────────────────────────────────── */
// Flag booleano estricto: acepta el boolean real que envía el formulario y
// normaliza las formas string (NO usa z.coerce.boolean(), donde "false" → true).
const boolFlag = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0", "on", "off"])])
  .transform((v) => v === true || v === "true" || v === "1" || v === "on");

export const configSchema = z.object({
  comisionPct: numeroDesdeForm
    .refine((v) => v >= 0 && v <= 100, "La comisión debe estar entre 0 y 100%."),
  usaHighWaterMark: boolFlag,
  pierdeSoloCliente: boolFlag,
  nombreFondo: z.string().min(2).max(120),
});

/* ── Cambio de contraseña ────────────────────────────────────────────────── */
export const cambiarPasswordSchema = z
  .object({
    actual: z.string().optional(),
    nueva: z.string().min(8, "Mínimo 8 caracteres."),
    confirmar: z.string(),
  })
  .refine((d) => d.nueva === d.confirmar, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmar"],
  });

export type CrearClienteInput = z.infer<typeof crearClienteSchema>;
export type EditarClienteInput = z.infer<typeof editarClienteSchema>;
export type CrearMovimientoInput = z.infer<typeof crearMovimientoSchema>;
export type GuardarRendimientoInput = z.infer<typeof guardarRendimientoSchema>;
export type ConfigInput = z.infer<typeof configSchema>;

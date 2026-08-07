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
/** Número opcional desde formulario: "" o null ⇒ null (usa el valor global). */
const numeroOpcionalDesdeForm = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.union([numeroDesdeForm, z.null()]),
);
const politicaOpcional = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.enum(["normal", "hwm_saldo", "deficit_pnl"]).nullable(),
);

export const crearClienteSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio.").max(120),
  email: z.string().email("Correo inválido."),
  fechaIngreso: fechaISO,
  capitalInicial: numeroDesdeForm.refine((v) => v >= 0, "El capital no puede ser negativo."),
  /** Condiciones propias (null = usa la configuración global del fondo). */
  comisionPct: numeroOpcionalDesdeForm
    .refine((v) => v == null || (v >= 0 && v <= 100), "La comisión debe estar entre 0 y 100%.")
    .optional(),
  politicaComision: politicaOpcional.optional(),
  /** true = la comisión se devenga sin descontarse del saldo (saldos brutos,
   *  el operador ya cobró por fuera). Llega del checkbox como "on"/"true". */
  comisionInformativa: z
    .preprocess(
      (v) => (v === undefined ? undefined : v === true || v === "on" || v === "true"),
      z.boolean().optional(),
    )
    .optional(),
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
    /** Base de comisión del mes cuando difiere del resultado (null = comisiona
     *  el resultado entero). Solo aplica a cuentas con comisión informativa. */
    resultadoComisionable: numeroOpcionalDesdeForm.optional(),
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

/* ── Fondo compartido ────────────────────────────────────────────────────── */
export const crearFondoSchema = z.object({
  nombre: z.string().min(2, "El nombre es obligatorio.").max(120),
  fechaInicio: fechaISO,
  capitalInicial: numeroDesdeForm.refine((v) => v >= 0, "No puede ser negativo."),
  comisionPct: numeroDesdeForm.refine((v) => v >= 0 && v <= 100, "Entre 0 y 100%."),
  baseComision: z.enum(["ganancia_neta", "meses_positivos"]),
  notas: z.string().max(1000).optional().nullable(),
});

export const editarFondoSchema = crearFondoSchema.extend({ id: z.string().uuid() });

export const crearSocioSchema = z.object({
  fondoId: z.string().uuid(),
  nombre: z.string().min(2, "El nombre es obligatorio.").max(120),
  capitalInicial: numeroDesdeForm.refine((v) => v >= 0, "No puede ser negativo."),
  fechaAlta: fechaISO,
  // sin_acceso | vincular (clienteId) | crear (email)
  modoAcceso: z.enum(["sin_acceso", "vincular", "crear"]),
  clienteId: z.string().uuid().optional().nullable(),
  email: z.string().email("Correo inválido.").optional().nullable(),
  notas: z.string().max(1000).optional().nullable(),
});

export const editarSocioSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(2).max(120),
  estado: z.enum(["activo", "inactivo"]),
  notas: z.string().max(1000).optional().nullable(),
});

export const crearMovimientoFondoSchema = z.object({
  socioId: z.string().uuid(),
  tipo: tipoMovimiento,
  monto: numeroDesdeForm.refine((v) => v > 0, "El monto debe ser mayor que 0."),
  fecha: fechaISO,
  descripcion: z.string().max(500).optional().nullable(),
});

export const transferenciaFondoSchema = z
  .object({
    fondoId: z.string().uuid(),
    socioOrigenId: z.string().uuid(),
    socioDestinoId: z.string().uuid(),
    monto: numeroDesdeForm.refine((v) => v > 0, "El monto debe ser mayor que 0."),
    fechaSalida: fechaISO,
    fechaEntrada: fechaISO,
    descripcion: z.string().max(500).optional().nullable(),
  })
  .refine((d) => d.socioOrigenId !== d.socioDestinoId, {
    message: "Origen y destino deben ser socios distintos.",
    path: ["socioDestinoId"],
  })
  .refine((d) => d.fechaEntrada >= d.fechaSalida, {
    message: "La entrada no puede ser anterior a la salida.",
    path: ["fechaEntrada"],
  });

export const guardarRendimientoFondoSchema = z
  .object({
    fondoId: z.string().uuid(),
    anio: z.coerce.number().int().min(2000).max(2200),
    mes: z.coerce.number().int().min(1).max(12),
    modo: modoRendimiento,
    valor: numeroDesdeForm,
    enCurso: z.boolean(),
    tasaTwr: numeroDesdeForm.optional().nullable(),
    descripcion: z.string().max(500).optional().nullable(),
    overrides: z
      .array(
        z.object({
          socioId: z.string().uuid(),
          saldoFinal: numeroDesdeForm.refine((v) => v >= 0, "No puede ser negativo."),
        }),
      )
      .optional(),
  })
  .refine((d) => !(d.modo === "saldo_final" && d.valor < 0), {
    message: "El saldo final no puede ser negativo.",
    path: ["valor"],
  });

export const eliminarRendimientoFondoSchema = z.object({
  fondoId: z.string().uuid(),
  anio: z.coerce.number().int(),
  mes: z.coerce.number().int().min(1).max(12),
});

export type CrearClienteInput = z.infer<typeof crearClienteSchema>;
export type EditarClienteInput = z.infer<typeof editarClienteSchema>;
export type CrearMovimientoInput = z.infer<typeof crearMovimientoSchema>;
export type GuardarRendimientoInput = z.infer<typeof guardarRendimientoSchema>;
export type ConfigInput = z.infer<typeof configSchema>;

"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db, withFondoTenant } from "@/lib/db";
import {
  clientes,
  fondos,
  fondoSocios,
  fondoMovimientos,
  fondoRendimientos,
  fondoOverrides,
  users,
} from "@/drizzle/schema";
import { requireAdmin } from "@/lib/auth/session";
import { registrarAuditoria, sanitizar } from "@/lib/audit";
import { generarPasswordTemporal, hashPassword } from "@/lib/auth/password";
import { construirCadenaPool, type PoolInput } from "@/lib/finance/pool";
import { monthKey } from "@/lib/finance/ledger";
import { formatUSDSigned } from "@/lib/format";
import {
  crearFondoSchema,
  editarFondoSchema,
  crearSocioSchema,
  editarSocioSchema,
  crearMovimientoFondoSchema,
  transferenciaFondoSchema,
  guardarRendimientoFondoSchema,
  eliminarRendimientoFondoSchema,
  idSchema,
} from "@/lib/validations";
import { ADMIN_CTX, fail, ok, type ActionResult } from "@/lib/types";

function revalidar() {
  revalidatePath("/admin", "layout");
  revalidatePath("/cliente", "layout");
}

/* ── Fondo ──────────────────────────────────────────────────────────────── */

export async function crearFondo(input: unknown): Promise<ActionResult<{ fondoId: string }>> {
  const session = await requireAdmin();
  const parsed = crearFondoSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const fondoId = await withFondoTenant(ADMIN_CTX, async (tx) => {
    const [f] = await tx
      .insert(fondos)
      .values({
        nombre: d.nombre.trim(),
        fechaInicio: d.fechaInicio,
        capitalInicial: d.capitalInicial.toFixed(2),
        comisionPct: d.comisionPct.toFixed(3),
        baseComision: d.baseComision,
        notas: d.notas ?? null,
      })
      .returning();
    return f!.id;
  });

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "crear",
    entidad: "fondo",
    entidadId: fondoId,
    despues: { nombre: d.nombre, fechaInicio: d.fechaInicio, capitalInicial: d.capitalInicial },
  });

  revalidar();
  return ok({ fondoId }, "Fondo creado.");
}

export async function editarFondo(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = editarFondoSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const antes = await withFondoTenant(ADMIN_CTX, async (tx) => {
    const [actual] = await tx.select().from(fondos).where(eq(fondos.id, d.id)).limit(1);
    if (!actual) return null;
    await tx
      .update(fondos)
      .set({
        nombre: d.nombre.trim(),
        fechaInicio: d.fechaInicio,
        capitalInicial: d.capitalInicial.toFixed(2),
        comisionPct: d.comisionPct.toFixed(3),
        baseComision: d.baseComision,
        notas: d.notas ?? null,
        updatedAt: new Date(),
      })
      .where(eq(fondos.id, d.id));
    return actual;
  });
  if (!antes) return fail("Fondo no encontrado.");

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "editar",
    entidad: "fondo",
    entidadId: d.id,
    antes: sanitizar(antes),
    despues: { nombre: d.nombre, comisionPct: d.comisionPct, baseComision: d.baseComision },
  });

  revalidar();
  return ok(undefined, "Fondo actualizado.");
}

/* ── Socios ─────────────────────────────────────────────────────────────── */

export async function crearSocio(
  input: unknown,
): Promise<ActionResult<{ socioId: string; email?: string; passwordTemporal?: string }>> {
  const session = await requireAdmin();
  const parsed = crearSocioSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  if (d.modoAcceso === "vincular" && !d.clienteId) {
    return fail("Selecciona el cliente a vincular.", { clienteId: ["Requerido."] });
  }
  if (d.modoAcceso === "crear" && !d.email) {
    return fail("Ingresa el correo del socio.", { email: ["Requerido."] });
  }

  // El capital "semilla" solo existe en el mes de inicio del fondo. Un socio
  // que entra después arranca en 0 y su entrada se registra como APORTE; si se
  // permitiera semilla tardía, el motor la inyectaría en su mes de alta pero
  // el flujo correcto (y auditable) es el movimiento.
  const fondo = await withFondoTenant(ADMIN_CTX, async (tx) => {
    const [f] = await tx
      .select({ fechaInicio: fondos.fechaInicio })
      .from(fondos)
      .where(eq(fondos.id, d.fondoId))
      .limit(1);
    return f ?? null;
  });
  if (!fondo) return fail("Fondo no encontrado.");
  if (d.capitalInicial > 0 && d.fechaAlta.slice(0, 7) !== fondo.fechaInicio.slice(0, 7)) {
    return fail(
      "Un socio que entra después del inicio del fondo arranca con capital 0: regístralo y luego carga su entrada como aporte (movimiento).",
      { capitalInicial: ["Debe ser 0 si el alta no es el mes de inicio del fondo."] },
    );
  }

  let clienteId: string | null = null;
  let credenciales: { email: string; passwordTemporal: string } | undefined;

  if (d.modoAcceso === "vincular") {
    clienteId = d.clienteId!;
    const yaSocio = await withFondoTenant(ADMIN_CTX, async (tx) => {
      const [s] = await tx
        .select({ id: fondoSocios.id })
        .from(fondoSocios)
        .where(eq(fondoSocios.clienteId, clienteId!))
        .limit(1);
      return !!s;
    });
    if (yaSocio) return fail("Ese cliente ya es socio de un fondo.");
  }

  if (d.modoAcceso === "crear") {
    const email = d.email!.toLowerCase().trim();
    const existente = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existente.length > 0) {
      return fail("Ya existe un usuario con ese correo (usa «vincular cliente existente»).", {
        email: ["Correo en uso."],
      });
    }
    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await hashPassword(passwordTemporal);
    // Cliente "cascarón": capital 0 + inactivo ⇒ invisible para el cierre,
    // AUM y dashboard de la modalidad individual (que filtran por activo).
    clienteId = await withFondoTenant(ADMIN_CTX, async (tx) => {
      const [c] = await tx
        .insert(clientes)
        .values({
          nombre: d.nombre.trim(),
          email,
          fechaIngreso: d.fechaAlta,
          capitalInicial: "0.00",
          estado: "inactivo",
          esAccesoFondo: true,
          notas: "Acceso de socio de fondo compartido.",
        })
        .returning();
      await tx.insert(users).values({
        email,
        passwordHash,
        role: "cliente",
        clienteId: c!.id,
        mustChangePassword: true,
      });
      return c!.id;
    });
    credenciales = { email, passwordTemporal };
  }

  const socioId = await withFondoTenant(ADMIN_CTX, async (tx) => {
    const [s] = await tx
      .insert(fondoSocios)
      .values({
        fondoId: d.fondoId,
        clienteId,
        nombre: d.nombre.trim(),
        capitalInicial: d.capitalInicial.toFixed(2),
        fechaAlta: d.fechaAlta,
        notas: d.notas ?? null,
      })
      .returning();
    return s!.id;
  });

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "crear",
    entidad: "socio",
    entidadId: socioId,
    despues: { fondoId: d.fondoId, nombre: d.nombre, capitalInicial: d.capitalInicial, modoAcceso: d.modoAcceso },
  });

  revalidar();
  return ok(
    { socioId, email: credenciales?.email, passwordTemporal: credenciales?.passwordTemporal },
    "Socio agregado.",
  );
}

export async function editarSocio(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = editarSocioSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const antes = await withFondoTenant(ADMIN_CTX, async (tx) => {
    const [actual] = await tx.select().from(fondoSocios).where(eq(fondoSocios.id, d.id)).limit(1);
    if (!actual) return null;
    await tx
      .update(fondoSocios)
      .set({ nombre: d.nombre.trim(), estado: d.estado, notas: d.notas ?? null, updatedAt: new Date() })
      .where(eq(fondoSocios.id, d.id));
    return actual;
  });
  if (!antes) return fail("Socio no encontrado.");

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "editar",
    entidad: "socio",
    entidadId: d.id,
    antes: sanitizar(antes),
    despues: { nombre: d.nombre, estado: d.estado },
  });

  revalidar();
  return ok(undefined, "Socio actualizado.");
}

/** Crea acceso (cliente+user) para un socio que aún no lo tiene. */
export async function otorgarAccesoSocio(
  input: { socioId: string; email: string },
): Promise<ActionResult<{ email: string; passwordTemporal: string }>> {
  const session = await requireAdmin();
  const parsedId = idSchema.safeParse({ id: input.socioId });
  const email = String(input.email ?? "").toLowerCase().trim();
  if (!parsedId.success) return fail("Identificador inválido.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return fail("Correo inválido.", { email: ["Correo inválido."] });
  }

  const socio = await withFondoTenant(ADMIN_CTX, async (tx) => {
    const [s] = await tx.select().from(fondoSocios).where(eq(fondoSocios.id, input.socioId)).limit(1);
    return s ?? null;
  });
  if (!socio) return fail("Socio no encontrado.");
  if (socio.clienteId) return fail("Este socio ya tiene acceso.");

  const existente = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existente.length > 0) return fail("Ya existe un usuario con ese correo.");

  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await hashPassword(passwordTemporal);

  await withFondoTenant(ADMIN_CTX, async (tx) => {
    const [c] = await tx
      .insert(clientes)
      .values({
        nombre: socio.nombre,
        email,
        fechaIngreso: socio.fechaAlta,
        capitalInicial: "0.00",
        estado: "inactivo",
        notas: "Acceso de socio de fondo compartido.",
      })
      .returning();
    await tx.insert(users).values({
      email,
      passwordHash,
      role: "cliente",
      clienteId: c!.id,
      mustChangePassword: true,
    });
    await tx
      .update(fondoSocios)
      .set({ clienteId: c!.id, updatedAt: new Date() })
      .where(eq(fondoSocios.id, socio.id));
  });

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "editar",
    entidad: "socio",
    entidadId: socio.id,
    despues: { accion: "otorgar_acceso", email },
  });

  revalidar();
  return ok({ email, passwordTemporal }, "Acceso creado.");
}

/* ── Movimientos del fondo ──────────────────────────────────────────────── */

export async function crearMovimientoFondo(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = crearMovimientoFondoSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.", parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const resultado = await withFondoTenant(ADMIN_CTX, async (tx) => {
    const [socio] = await tx
      .select({ id: fondoSocios.id, fondoId: fondoSocios.fondoId, fechaAlta: fondoSocios.fechaAlta })
      .from(fondoSocios)
      .where(eq(fondoSocios.id, d.socioId))
      .limit(1);
    if (!socio) return { error: "Socio no encontrado." };
    if (d.fecha < socio.fechaAlta) {
      return { error: "La fecha es anterior al alta del socio." };
    }
    const [m] = await tx
      .insert(fondoMovimientos)
      .values({
        fondoId: socio.fondoId,
        socioId: d.socioId,
        tipo: d.tipo,
        monto: d.monto.toFixed(2),
        fecha: d.fecha,
        descripcion: d.descripcion ?? null,
      })
      .returning();
    return { id: m!.id };
  });
  if (resultado.error) return fail(resultado.error);

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "crear",
    entidad: "movimiento_fondo",
    entidadId: resultado.id ?? null,
    despues: { socioId: d.socioId, tipo: d.tipo, monto: d.monto, fecha: d.fecha, descripcion: d.descripcion ?? null },
  });

  revalidar();
  return ok(undefined, d.tipo === "deposito" ? "Aporte registrado." : "Retiro registrado.");
}

export async function eliminarMovimientoFondo(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Identificador inválido.");

  // Una transferencia es un PAR retiro/depósito neutro para el fondo: borrar
  // una sola pata dejaría la otra huérfana y alteraría el reparto de todos los
  // meses siguientes. Si el movimiento pertenece a una transferencia, se
  // eliminan las DOS patas en la misma transacción.
  const resultado = await withFondoTenant(ADMIN_CTX, async (tx) => {
    const [actual] = await tx
      .select()
      .from(fondoMovimientos)
      .where(eq(fondoMovimientos.id, parsed.data.id))
      .limit(1);
    if (!actual) return null;
    if (actual.transferenciaId) {
      const patas = await tx
        .select()
        .from(fondoMovimientos)
        .where(eq(fondoMovimientos.transferenciaId, actual.transferenciaId));
      await tx
        .delete(fondoMovimientos)
        .where(eq(fondoMovimientos.transferenciaId, actual.transferenciaId));
      return { patas, transferenciaId: actual.transferenciaId };
    }
    await tx.delete(fondoMovimientos).where(eq(fondoMovimientos.id, parsed.data.id));
    return { patas: [actual], transferenciaId: null };
  });
  if (!resultado) return fail("Movimiento no encontrado.");

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "eliminar",
    entidad: "movimiento_fondo",
    entidadId: resultado.transferenciaId ?? parsed.data.id,
    antes: resultado.patas.map((p) => sanitizar(p)),
  });

  revalidar();
  return ok(
    undefined,
    resultado.transferenciaId
      ? "Transferencia eliminada (se borraron las dos patas: retiro y depósito)."
      : "Movimiento eliminado.",
  );
}

/** Transferencia entre socios: 1 transacción, retiro + aporte con el mismo transferencia_id. */
export async function registrarTransferencia(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = transferenciaFondoSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.", parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  const transferenciaId = randomUUID();

  const resultado = await withFondoTenant(ADMIN_CTX, async (tx) => {
    const socios = await tx
      .select({
        id: fondoSocios.id,
        fondoId: fondoSocios.fondoId,
        nombre: fondoSocios.nombre,
        fechaAlta: fondoSocios.fechaAlta,
      })
      .from(fondoSocios)
      .where(eq(fondoSocios.fondoId, d.fondoId));
    const origen = socios.find((s) => s.id === d.socioOrigenId);
    const destino = socios.find((s) => s.id === d.socioDestinoId);
    if (!origen || !destino) return { error: "Socio origen o destino no pertenece al fondo." };
    if (d.fechaSalida < origen.fechaAlta) {
      return { error: `La fecha de salida es anterior al alta de ${origen.nombre}.` };
    }
    if (d.fechaEntrada < destino.fechaAlta) {
      return { error: `La fecha de entrada es anterior al alta de ${destino.nombre}.` };
    }

    await tx.insert(fondoMovimientos).values([
      {
        fondoId: d.fondoId,
        socioId: d.socioOrigenId,
        tipo: "retiro",
        monto: d.monto.toFixed(2),
        fecha: d.fechaSalida,
        transferenciaId,
        descripcion: d.descripcion ?? `Transferencia a ${destino.nombre}`,
      },
      {
        fondoId: d.fondoId,
        socioId: d.socioDestinoId,
        tipo: "deposito",
        monto: d.monto.toFixed(2),
        fecha: d.fechaEntrada,
        transferenciaId,
        descripcion: d.descripcion ?? `Transferencia de ${origen.nombre}`,
      },
    ]);
    return { ok: true };
  });
  if (resultado.error) return fail(resultado.error);

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "crear",
    entidad: "movimiento_fondo",
    entidadId: transferenciaId,
    despues: { transferencia: true, ...d },
  });

  revalidar();
  return ok(undefined, "Transferencia registrada.");
}

/* ── Resultado mensual del fondo (con flotante y overrides) ─────────────── */

/** Lanzada dentro de la transacción para revertir escrituras ya hechas. */
class RollbackError extends Error {}

export async function guardarRendimientoFondo(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = guardarRendimientoFondoSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.", parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  const periodo = `${d.anio}-${String(d.mes).padStart(2, "0")}`;

  let resultado: { error?: string; antes?: typeof fondoRendimientos.$inferSelect | null };
  try {
    resultado = await withFondoTenant(ADMIN_CTX, async (tx) => {
    const [fondo] = await tx
      .select({
        fechaInicio: fondos.fechaInicio,
        comisionPct: fondos.comisionPct,
        baseComision: fondos.baseComision,
      })
      .from(fondos)
      .where(eq(fondos.id, d.fondoId))
      .limit(1);
    if (!fondo) return { error: "Fondo no encontrado." };
    if (periodo < fondo.fechaInicio.slice(0, 7)) {
      return { error: "El período es anterior al inicio del fondo." };
    }

    // Solo puede haber UN mes flotante y DEBE ser el último registrado:
    // (a) un flotante no puede tener meses posteriores; (b) no se puede
    // registrar un mes cerrado posterior a un flotante abierto.
    const registrados = await tx
      .select({
        anio: fondoRendimientos.anio,
        mes: fondoRendimientos.mes,
        enCurso: fondoRendimientos.enCurso,
      })
      .from(fondoRendimientos)
      .where(eq(fondoRendimientos.fondoId, d.fondoId));
    const clave = (a: number, m: number) => a * 100 + m;
    if (d.enCurso) {
      const otroFlotante = registrados.find(
        (r) => r.enCurso && !(r.anio === d.anio && r.mes === d.mes),
      );
      if (otroFlotante) {
        return {
          error: `Ya hay un mes flotante abierto (${otroFlotante.mes}/${otroFlotante.anio}). Ciérralo primero.`,
        };
      }
      const posterior = registrados.find((r) => clave(r.anio, r.mes) > clave(d.anio, d.mes));
      if (posterior) {
        return {
          error: `El mes flotante debe ser el último registrado (ya existe ${posterior.mes}/${posterior.anio}).`,
        };
      }
    } else {
      const flotanteAnterior = registrados.find(
        (r) => r.enCurso && clave(r.anio, r.mes) < clave(d.anio, d.mes),
      );
      if (flotanteAnterior) {
        return {
          error: `Cierra primero el mes en curso (${flotanteAnterior.mes}/${flotanteAnterior.anio}) antes de registrar meses posteriores.`,
        };
      }
    }

    // Overrides: cada socio debe pertenecer al fondo y no repetirse.
    const sociosFondo = await tx
      .select()
      .from(fondoSocios)
      .where(eq(fondoSocios.fondoId, d.fondoId))
      .orderBy(asc(fondoSocios.fechaAlta), asc(fondoSocios.id));
    if (d.overrides && d.overrides.length > 0) {
      const ids = new Set(sociosFondo.map((s) => s.id));
      if (d.overrides.some((o) => !ids.has(o.socioId))) {
        return { error: "Hay repartos manuales de socios que no pertenecen a este fondo." };
      }
      const unicos = new Set(d.overrides.map((o) => o.socioId));
      if (unicos.size !== d.overrides.length) {
        return { error: "Hay repartos manuales duplicados para un mismo socio." };
      }
    }

    const [antes] = await tx
      .select()
      .from(fondoRendimientos)
      .where(
        and(
          eq(fondoRendimientos.fondoId, d.fondoId),
          eq(fondoRendimientos.anio, d.anio),
          eq(fondoRendimientos.mes, d.mes),
        ),
      )
      .limit(1);

    await tx
      .insert(fondoRendimientos)
      .values({
        fondoId: d.fondoId,
        anio: d.anio,
        mes: d.mes,
        modo: d.modo,
        valor: d.valor.toFixed(4),
        enCurso: d.enCurso,
        tasaTwr: d.tasaTwr != null ? d.tasaTwr.toFixed(4) : null,
        descripcion: d.descripcion ?? null,
      })
      .onConflictDoUpdate({
        target: [fondoRendimientos.fondoId, fondoRendimientos.anio, fondoRendimientos.mes],
        set: {
          modo: d.modo,
          valor: d.valor.toFixed(4),
          enCurso: d.enCurso,
          // Preserva tasa_twr si el payload no la trae (undefined); solo un
          // null EXPLÍCITO la borra. Evita perder el insumo TWR al reeditar.
          ...(d.tasaTwr !== undefined
            ? { tasaTwr: d.tasaTwr != null ? d.tasaTwr.toFixed(4) : null }
            : {}),
          descripcion: d.descripcion ?? null,
          updatedAt: new Date(),
        },
      });

    // Overrides del mes: reemplazo completo del set (delete + insert).
    if (d.overrides) {
      await tx
        .delete(fondoOverrides)
        .where(
          and(
            eq(fondoOverrides.fondoId, d.fondoId),
            eq(fondoOverrides.anio, d.anio),
            eq(fondoOverrides.mes, d.mes),
          ),
        );
      if (d.overrides.length > 0) {
        await tx.insert(fondoOverrides).values(
          d.overrides.map((o) => ({
            fondoId: d.fondoId,
            socioId: o.socioId,
            anio: d.anio,
            mes: d.mes,
            saldoFinal: o.saldoFinal.toFixed(2),
            motivo: "Reparto manual",
          })),
        );
      }
    }

    // Validación de descuadre EN SERVIDOR: reconstruye la cadena con lo recién
    // escrito y revierte (rollback) si los saldos fijados no cuadran con el
    // fondo. No se confía solo en la vista previa del cliente.
    const [movsDb, rendsDb, ovrsDb] = await Promise.all([
      tx.select().from(fondoMovimientos).where(eq(fondoMovimientos.fondoId, d.fondoId)),
      tx.select().from(fondoRendimientos).where(eq(fondoRendimientos.fondoId, d.fondoId)),
      tx.select().from(fondoOverrides).where(eq(fondoOverrides.fondoId, d.fondoId)),
    ]);
    const poolInput: PoolInput = {
      fechaInicio: fondo.fechaInicio,
      socios: sociosFondo.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        capitalInicial: s.capitalInicial,
        fechaAlta: s.fechaAlta,
        estado: s.estado,
      })),
      movimientos: movsDb.map((m) => ({
        socioId: m.socioId,
        tipo: m.tipo,
        monto: m.monto,
        fecha: m.fecha,
      })),
      rendimientos: rendsDb.map((r) => ({
        anio: r.anio,
        mes: r.mes,
        modo: r.modo,
        valor: r.valor,
        enCurso: r.enCurso,
        tasaTwr: r.tasaTwr,
      })),
      overrides: ovrsDb.map((o) => ({
        socioId: o.socioId,
        anio: o.anio,
        mes: o.mes,
        saldoFinal: o.saldoFinal,
      })),
      config: {
        comisionPct: Number(fondo.comisionPct),
        baseComision: fondo.baseComision,
      },
    };
    const cadena = construirCadenaPool(poolInput);
    const mesGuardado = cadena.find((m) => m.key === monthKey(d.anio, d.mes));
    if (mesGuardado && mesGuardado.descuadre !== 0) {
      throw new RollbackError(
        `Los saldos fijados no cuadran con el fondo: diferencia de ${formatUSDSigned(mesGuardado.descuadre)}. No se guardó nada.`,
      );
    }

    return { antes: antes ?? null };
    });
  } catch (e) {
    if (e instanceof RollbackError) return fail(e.message);
    throw e;
  }
  if (resultado.error) return fail(resultado.error);

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: resultado.antes ? "editar" : "crear",
    entidad: "rendimiento_fondo",
    entidadId: resultado.antes?.id ?? null,
    antes: sanitizar(resultado.antes ?? undefined),
    despues: {
      fondoId: d.fondoId,
      anio: d.anio,
      mes: d.mes,
      modo: d.modo,
      valor: d.valor,
      enCurso: d.enCurso,
      tasaTwr: d.tasaTwr ?? null,
      overrides: d.overrides?.length ?? 0,
    },
  });

  revalidar();
  return ok(
    undefined,
    d.enCurso ? "Resultado flotante guardado (mes en curso)." : "Resultado mensual guardado.",
  );
}

/** Confirma el mes flotante (en_curso → false). */
export async function cerrarMesFondo(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = eliminarRendimientoFondoSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");
  const d = parsed.data;

  const antes = await withFondoTenant(ADMIN_CTX, async (tx) => {
    const [actual] = await tx
      .select()
      .from(fondoRendimientos)
      .where(
        and(
          eq(fondoRendimientos.fondoId, d.fondoId),
          eq(fondoRendimientos.anio, d.anio),
          eq(fondoRendimientos.mes, d.mes),
        ),
      )
      .limit(1);
    if (!actual || !actual.enCurso) return null;
    await tx
      .update(fondoRendimientos)
      .set({ enCurso: false, updatedAt: new Date() })
      .where(eq(fondoRendimientos.id, actual.id));
    return actual;
  });
  if (!antes) return fail("No hay mes flotante en ese período.");

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "editar",
    entidad: "rendimiento_fondo",
    entidadId: antes.id,
    antes: sanitizar(antes),
    despues: { accion: "cerrar_mes", anio: d.anio, mes: d.mes },
  });

  revalidar();
  return ok(undefined, "Mes cerrado. El resultado quedó confirmado.");
}

export async function eliminarRendimientoFondo(input: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = eliminarRendimientoFondoSchema.safeParse(input);
  if (!parsed.success) return fail("Datos inválidos.");
  const d = parsed.data;

  const antes = await withFondoTenant(ADMIN_CTX, async (tx) => {
    const [actual] = await tx
      .select()
      .from(fondoRendimientos)
      .where(
        and(
          eq(fondoRendimientos.fondoId, d.fondoId),
          eq(fondoRendimientos.anio, d.anio),
          eq(fondoRendimientos.mes, d.mes),
        ),
      )
      .limit(1);
    if (!actual) return null;
    await tx.delete(fondoRendimientos).where(eq(fondoRendimientos.id, actual.id));
    // Overrides del mes quedan sin efecto pero se eliminan por limpieza.
    await tx
      .delete(fondoOverrides)
      .where(
        and(
          eq(fondoOverrides.fondoId, d.fondoId),
          eq(fondoOverrides.anio, d.anio),
          eq(fondoOverrides.mes, d.mes),
        ),
      );
    return actual;
  });
  if (!antes) return fail("No hay resultado en ese período.");

  await registrarAuditoria({
    actorUserId: session.user.id,
    actorEmail: session.user.email ?? null,
    accion: "eliminar",
    entidad: "rendimiento_fondo",
    entidadId: antes.id,
    antes: sanitizar(antes),
  });

  revalidar();
  return ok(undefined, "Resultado eliminado.");
}

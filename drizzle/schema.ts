import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ──────────────────────────────────────────────────────────────────────────
 * Enums
 * ────────────────────────────────────────────────────────────────────────── */
export const roleEnum = pgEnum("role", ["admin", "cliente"]);
export const estadoClienteEnum = pgEnum("estado_cliente", ["activo", "inactivo"]);
export const tipoMovimientoEnum = pgEnum("tipo_movimiento", ["deposito", "retiro"]);
export const modoRendimientoEnum = pgEnum("modo_rendimiento", [
  "porcentaje",
  "monto",
  "saldo_final",
]);

/* ──────────────────────────────────────────────────────────────────────────
 * clientes — un inversionista del fondo.
 * fecha_ingreso define el primer mes del historial; capital_inicial el aporte.
 * Dinero SIEMPRE en numeric(14,2) (string en JS) — nunca float.
 * ────────────────────────────────────────────────────────────────────────── */
export const clientes = pgTable("clientes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  email: text("email").notNull(),
  fechaIngreso: date("fecha_ingreso").notNull(),
  capitalInicial: numeric("capital_inicial", { precision: 14, scale: 2 }).notNull(),
  estado: estadoClienteEnum("estado").notNull().default("activo"),
  notas: text("notas"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ──────────────────────────────────────────────────────────────────────────
 * users — credenciales de acceso. Un admin (operador) y N clientes.
 * cliente_id es obligatorio (a nivel app) cuando role = 'cliente'.
 * ────────────────────────────────────────────────────────────────────────── */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  clienteId: uuid("cliente_id").references(() => clientes.id, { onDelete: "cascade" }),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ──────────────────────────────────────────────────────────────────────────
 * movimientos — depósitos y retiros de CAPITAL (no rendimiento).
 * monto siempre > 0; el signo lo da el `tipo`.
 * ────────────────────────────────────────────────────────────────────────── */
export const movimientos = pgTable(
  "movimientos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "cascade" }),
    tipo: tipoMovimientoEnum("tipo").notNull(),
    monto: numeric("monto", { precision: 14, scale: 2 }).notNull(),
    fecha: date("fecha").notNull(),
    descripcion: text("descripcion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("movimientos_cliente_idx").on(t.clienteId),
    index("movimientos_cliente_fecha_idx").on(t.clienteId, t.fecha),
    check("movimientos_monto_positivo", sql`${t.monto} > 0`),
  ],
);

/* ──────────────────────────────────────────────────────────────────────────
 * rendimientos_mensuales — el resultado del fondo por cliente y mes.
 * Guarda SOLO los insumos (modo + valor). Los saldos se DERIVAN al leer
 * (derive-on-read), nunca se almacenan. Único por (cliente, año, mes).
 * ────────────────────────────────────────────────────────────────────────── */
export const rendimientosMensuales = pgTable(
  "rendimientos_mensuales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "cascade" }),
    anio: integer("anio").notNull(),
    mes: integer("mes").notNull(),
    modo: modoRendimientoEnum("modo").notNull(),
    valor: numeric("valor", { precision: 16, scale: 4 }).notNull(),
    descripcion: text("descripcion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("rendimientos_cliente_anio_mes_uniq").on(t.clienteId, t.anio, t.mes),
    check("rendimientos_mes_valido", sql`${t.mes} between 1 and 12`),
    check("rendimientos_anio_valido", sql`${t.anio} between 2000 and 2200`),
  ],
);

/* ──────────────────────────────────────────────────────────────────────────
 * configuracion — fila única (singleton, id=1).
 * Las 3 decisiones configurables del fondo viven aquí.
 * ────────────────────────────────────────────────────────────────────────── */
export const configuracion = pgTable(
  "configuracion",
  {
    id: integer("id").primaryKey().default(1),
    comisionPct: numeric("comision_pct", { precision: 6, scale: 3 })
      .notNull()
      .default("35.000"),
    usaHighWaterMark: boolean("usa_high_water_mark").notNull().default(false),
    pierdeSoloCliente: boolean("pierde_solo_cliente").notNull().default(true),
    nombreFondo: text("nombre_fondo").notNull().default("Brújula Markets"),
    moneda: text("moneda").notNull().default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("configuracion_singleton", sql`${t.id} = 1`)],
);

/* ──────────────────────────────────────────────────────────────────────────
 * auditoria — bitácora de cambios. entidad_id es text para admitir tanto los
 * uuid de las entidades como el id entero (1) de configuracion.
 * ────────────────────────────────────────────────────────────────────────── */
export const auditoria = pgTable(
  "auditoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email"),
    accion: text("accion").notNull(), // crear | editar | eliminar
    entidad: text("entidad").notNull(), // cliente | movimiento | rendimiento | configuracion | usuario
    entidadId: text("entidad_id"),
    datosAntes: jsonb("datos_antes"),
    datosDespues: jsonb("datos_despues"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("auditoria_created_idx").on(t.createdAt),
    index("auditoria_entidad_idx").on(t.entidad, t.entidadId),
  ],
);

/* ──────────────────────────────────────────────────────────────────────────
 * Tipos inferidos
 * ────────────────────────────────────────────────────────────────────────── */
export type Cliente = typeof clientes.$inferSelect;
export type NuevoCliente = typeof clientes.$inferInsert;
export type Usuario = typeof users.$inferSelect;
export type NuevoUsuario = typeof users.$inferInsert;
export type Movimiento = typeof movimientos.$inferSelect;
export type NuevoMovimiento = typeof movimientos.$inferInsert;
export type RendimientoMensual = typeof rendimientosMensuales.$inferSelect;
export type NuevoRendimientoMensual = typeof rendimientosMensuales.$inferInsert;
export type Configuracion = typeof configuracion.$inferSelect;
export type RegistroAuditoria = typeof auditoria.$inferSelect;

CREATE TYPE "public"."estado_cliente" AS ENUM('activo', 'inactivo');--> statement-breakpoint
CREATE TYPE "public"."modo_rendimiento" AS ENUM('porcentaje', 'monto', 'saldo_final');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'cliente');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento" AS ENUM('deposito', 'retiro');--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_email" text,
	"accion" text NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" text,
	"datos_antes" jsonb,
	"datos_despues" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"fecha_ingreso" date NOT NULL,
	"capital_inicial" numeric(14, 2) NOT NULL,
	"estado" "estado_cliente" DEFAULT 'activo' NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuracion" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"comision_pct" numeric(6, 3) DEFAULT '35.000' NOT NULL,
	"usa_high_water_mark" boolean DEFAULT false NOT NULL,
	"pierde_solo_cliente" boolean DEFAULT true NOT NULL,
	"nombre_fondo" text DEFAULT 'Brújula Markets' NOT NULL,
	"moneda" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "configuracion_singleton" CHECK ("configuracion"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" "tipo_movimiento" NOT NULL,
	"monto" numeric(14, 2) NOT NULL,
	"fecha" date NOT NULL,
	"descripcion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movimientos_monto_positivo" CHECK ("movimientos"."monto" > 0)
);
--> statement-breakpoint
CREATE TABLE "rendimientos_mensuales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"anio" integer NOT NULL,
	"mes" integer NOT NULL,
	"modo" "modo_rendimiento" NOT NULL,
	"valor" numeric(16, 4) NOT NULL,
	"descripcion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rendimientos_mes_valido" CHECK ("rendimientos_mensuales"."mes" between 1 and 12),
	CONSTRAINT "rendimientos_anio_valido" CHECK ("rendimientos_mensuales"."anio" between 2000 and 2200)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"cliente_id" uuid,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rendimientos_mensuales" ADD CONSTRAINT "rendimientos_mensuales_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_created_idx" ON "auditoria" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auditoria_entidad_idx" ON "auditoria" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "movimientos_cliente_idx" ON "movimientos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "movimientos_cliente_fecha_idx" ON "movimientos" USING btree ("cliente_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "rendimientos_cliente_anio_mes_uniq" ON "rendimientos_mensuales" USING btree ("cliente_id","anio","mes");
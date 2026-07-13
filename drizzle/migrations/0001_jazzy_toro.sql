CREATE TYPE "public"."base_comision_fondo" AS ENUM('ganancia_neta', 'meses_positivos');--> statement-breakpoint
CREATE TABLE "fondo_movimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fondo_id" uuid NOT NULL,
	"socio_id" uuid NOT NULL,
	"tipo" "tipo_movimiento" NOT NULL,
	"monto" numeric(14, 2) NOT NULL,
	"fecha" date NOT NULL,
	"transferencia_id" uuid,
	"descripcion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fondo_mov_monto_positivo" CHECK ("fondo_movimientos"."monto" > 0)
);
--> statement-breakpoint
CREATE TABLE "fondo_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fondo_id" uuid NOT NULL,
	"socio_id" uuid NOT NULL,
	"anio" integer NOT NULL,
	"mes" integer NOT NULL,
	"saldo_final" numeric(14, 2) NOT NULL,
	"motivo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fondo_override_mes_valido" CHECK ("fondo_overrides"."mes" between 1 and 12),
	CONSTRAINT "fondo_override_saldo_no_negativo" CHECK ("fondo_overrides"."saldo_final" >= 0)
);
--> statement-breakpoint
CREATE TABLE "fondo_rendimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fondo_id" uuid NOT NULL,
	"anio" integer NOT NULL,
	"mes" integer NOT NULL,
	"modo" "modo_rendimiento" NOT NULL,
	"valor" numeric(16, 4) NOT NULL,
	"en_curso" boolean DEFAULT false NOT NULL,
	"tasa_twr" numeric(16, 4),
	"descripcion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fondo_rend_mes_valido" CHECK ("fondo_rendimientos"."mes" between 1 and 12),
	CONSTRAINT "fondo_rend_anio_valido" CHECK ("fondo_rendimientos"."anio" between 2000 and 2200)
);
--> statement-breakpoint
CREATE TABLE "fondo_socios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fondo_id" uuid NOT NULL,
	"cliente_id" uuid,
	"nombre" text NOT NULL,
	"capital_inicial" numeric(14, 2) DEFAULT '0' NOT NULL,
	"fecha_alta" date NOT NULL,
	"estado" "estado_cliente" DEFAULT 'activo' NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fondos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"fecha_inicio" date NOT NULL,
	"capital_inicial" numeric(14, 2) DEFAULT '0' NOT NULL,
	"comision_pct" numeric(6, 3) DEFAULT '35.000' NOT NULL,
	"base_comision" "base_comision_fondo" DEFAULT 'ganancia_neta' NOT NULL,
	"moneda" text DEFAULT 'USD' NOT NULL,
	"estado" "estado_cliente" DEFAULT 'activo' NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_fondo_id_fondos_id_fk" FOREIGN KEY ("fondo_id") REFERENCES "public"."fondos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fondo_movimientos" ADD CONSTRAINT "fondo_movimientos_socio_id_fondo_socios_id_fk" FOREIGN KEY ("socio_id") REFERENCES "public"."fondo_socios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fondo_overrides" ADD CONSTRAINT "fondo_overrides_fondo_id_fondos_id_fk" FOREIGN KEY ("fondo_id") REFERENCES "public"."fondos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fondo_overrides" ADD CONSTRAINT "fondo_overrides_socio_id_fondo_socios_id_fk" FOREIGN KEY ("socio_id") REFERENCES "public"."fondo_socios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fondo_rendimientos" ADD CONSTRAINT "fondo_rendimientos_fondo_id_fondos_id_fk" FOREIGN KEY ("fondo_id") REFERENCES "public"."fondos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fondo_socios" ADD CONSTRAINT "fondo_socios_fondo_id_fondos_id_fk" FOREIGN KEY ("fondo_id") REFERENCES "public"."fondos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fondo_socios" ADD CONSTRAINT "fondo_socios_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fondo_mov_fondo_fecha_idx" ON "fondo_movimientos" USING btree ("fondo_id","fecha");--> statement-breakpoint
CREATE INDEX "fondo_mov_socio_fecha_idx" ON "fondo_movimientos" USING btree ("socio_id","fecha");--> statement-breakpoint
CREATE INDEX "fondo_mov_transferencia_idx" ON "fondo_movimientos" USING btree ("transferencia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fondo_override_socio_anio_mes_uniq" ON "fondo_overrides" USING btree ("socio_id","anio","mes");--> statement-breakpoint
CREATE INDEX "fondo_override_fondo_periodo_idx" ON "fondo_overrides" USING btree ("fondo_id","anio","mes");--> statement-breakpoint
CREATE UNIQUE INDEX "fondo_rend_fondo_anio_mes_uniq" ON "fondo_rendimientos" USING btree ("fondo_id","anio","mes");--> statement-breakpoint
CREATE UNIQUE INDEX "fondo_rend_en_curso_uniq" ON "fondo_rendimientos" USING btree ("fondo_id") WHERE "fondo_rendimientos"."en_curso";--> statement-breakpoint
CREATE UNIQUE INDEX "fondo_socios_cliente_uniq" ON "fondo_socios" USING btree ("cliente_id") WHERE "fondo_socios"."cliente_id" is not null;--> statement-breakpoint
CREATE INDEX "fondo_socios_fondo_idx" ON "fondo_socios" USING btree ("fondo_id");
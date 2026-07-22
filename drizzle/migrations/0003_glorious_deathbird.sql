CREATE TYPE "public"."politica_comision" AS ENUM('normal', 'hwm_saldo', 'deficit_pnl');--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "comision_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "politica_comision" "politica_comision";
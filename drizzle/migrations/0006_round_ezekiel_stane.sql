CREATE TYPE "public"."tratamiento_comision" AS ENUM('descontada', 'ya_retirada', 'pagada_aparte');--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "tratamiento_comision" "tratamiento_comision" DEFAULT 'descontada' NOT NULL;--> statement-breakpoint
-- Backfill desde la columna que sustituye: lo que estaba marcado como comisión
-- informativa era el caso "el cliente la pagó fuera y el saldo es bruto".
UPDATE "clientes" SET "tratamiento_comision" = 'pagada_aparte' WHERE "comision_informativa" = true;

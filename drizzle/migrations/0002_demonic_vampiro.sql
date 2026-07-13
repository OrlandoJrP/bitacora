ALTER TABLE "clientes" ADD COLUMN "es_acceso_fondo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "clientes" SET "es_acceso_fondo" = true
WHERE "notas" = 'Acceso de socio de fondo compartido.'
  AND "capital_inicial" = 0
  AND "id" IN (SELECT "cliente_id" FROM "fondo_socios" WHERE "cliente_id" IS NOT NULL);
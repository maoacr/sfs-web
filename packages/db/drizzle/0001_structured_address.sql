ALTER TABLE "usuarios" ADD COLUMN "codigo_pais" varchar(5) DEFAULT '+57' NOT NULL;--> statement-breakpoint
ALTER TABLE "complejos" ADD COLUMN "tipo_via" varchar(20) DEFAULT 'Calle' NOT NULL;--> statement-breakpoint
ALTER TABLE "complejos" ADD COLUMN "numero_via" varchar(10) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "complejos" ADD COLUMN "numero_sec" varchar(10);--> statement-breakpoint
ALTER TABLE "complejos" ADD COLUMN "complemento" varchar(100);
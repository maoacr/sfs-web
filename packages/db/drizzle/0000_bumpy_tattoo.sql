CREATE TYPE "public"."estado_pago" AS ENUM('PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO');--> statement-breakpoint
CREATE TYPE "public"."estado_reserva" AS ENUM('PENDIENTE_PAGO', 'PAGO_PARCIAL', 'CONFIRMADA', 'CANCELADA', 'EXPIRADA', 'COMPLETADA');--> statement-breakpoint
CREATE TYPE "public"."rol_usuario" AS ENUM('OWNER', 'PLAYER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."tipo_cancha" AS ENUM('FUTBOL_5', 'FUTBOL_6', 'FUTBOL_7', 'FUTBOL_8', 'FUTBOL_9', 'FUTBOL_11');--> statement-breakpoint
CREATE TYPE "public"."tipo_descuento" AS ENUM('PORCENTAJE', 'MONTO_FIJO');--> statement-breakpoint
CREATE TYPE "public"."tipo_notificacion" AS ENUM('RESERVA_CREADA', 'RESERVA_CONFIRMADA', 'RESERVA_CANCELADA', 'RESERVA_EXPIRADA', 'RESERVA_COMPLETADA', 'PAGO_PARCIAL_RECIBIDO', 'INVITACION_EQUIPO', 'INVITACION_PARTIDO');--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"apellido" varchar(100) NOT NULL,
	"apodo" varchar(50),
	"telefono" varchar(20),
	"rol" "rol_usuario" DEFAULT 'PLAYER' NOT NULL,
	"avatar_url" varchar(500),
	"instagram" varchar(100),
	"tiktok" varchar(100),
	"twitter" varchar(100),
	"facebook" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "complejos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"slug" varchar(120),
	"direccion" varchar(255) NOT NULL,
	"ciudad" varchar(100) NOT NULL,
	"departamento" varchar(100) NOT NULL,
	"descripcion" text,
	"telefono" varchar(20),
	"email" varchar(255),
	"instagram" varchar(100),
	"tiktok" varchar(100),
	"twitter" varchar(100),
	"facebook" varchar(100),
	"latitud" numeric(10, 7),
	"longitud" numeric(10, 7),
	"politica_cancelacion_horas" numeric(5, 2) DEFAULT '24.00',
	"politica_cancelacion_penalizacion" numeric(5, 2) DEFAULT '0.00',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "imagenes_complejos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"complejo_id" uuid NOT NULL,
	"url" varchar(500) NOT NULL,
	"orden" numeric(5, 0) DEFAULT '0',
	"principal" numeric(1, 0) DEFAULT '0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canchas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"complejo_id" uuid NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"tipo" "tipo_cancha" NOT NULL,
	"capacidad" integer NOT NULL,
	"descripcion" text,
	"servicios" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duracion_slot_minutos" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "imagenes_canchas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cancha_id" uuid NOT NULL,
	"url" varchar(500) NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"principal" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slot_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cancha_id" uuid NOT NULL,
	"dia_semana" integer NOT NULL,
	"hora_apertura" time NOT NULL,
	"hora_cierre" time NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarifas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cancha_id" uuid NOT NULL,
	"precio_base" numeric(10, 2) NOT NULL,
	"dia_semana" integer,
	"hora_inicio" time,
	"hora_fin" time,
	"factor" numeric(3, 2) DEFAULT '1.00' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cancha_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"slot_inicio" timestamp with time zone NOT NULL,
	"slot_fin" timestamp with time zone NOT NULL,
	"monto_total" numeric(10, 2) NOT NULL,
	"monto_pagado" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"saldo_pendiente" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"estado" "estado_reserva" DEFAULT 'PENDIENTE_PAGO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reserva_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"estado_pago" "estado_pago" DEFAULT 'PENDIENTE' NOT NULL,
	"mp_split_id" varchar(255),
	"mp_payment_id" varchar(255),
	"mp_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promociones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tarifa_id" uuid NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"tipo_descuento" "tipo_descuento" NOT NULL,
	"valor" numeric(10, 2) NOT NULL,
	"valido_desde" timestamp with time zone NOT NULL,
	"valido_hasta" timestamp with time zone NOT NULL,
	"usos_maximos" integer,
	"usos_actuales" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "promociones_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "notificaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tipo" "tipo_notificacion" NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"mensaje" text NOT NULL,
	"reserva_id" uuid,
	"leida" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipo_miembros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipo_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rol" varchar(20) DEFAULT 'MIEMBRO' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"foto_url" varchar(500),
	"descripcion" text,
	"creador_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partido_jugadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partido_id" uuid NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partidos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reserva_id" uuid NOT NULL,
	"creador_id" uuid NOT NULL,
	"equipo_a_id" uuid,
	"equipo_b_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partidos_reserva_id_unique" UNIQUE("reserva_id")
);
--> statement-breakpoint
ALTER TABLE "complejos" ADD CONSTRAINT "complejos_tenant_id_usuarios_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imagenes_complejos" ADD CONSTRAINT "imagenes_complejos_complejo_id_complejos_id_fk" FOREIGN KEY ("complejo_id") REFERENCES "public"."complejos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canchas" ADD CONSTRAINT "canchas_tenant_id_usuarios_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canchas" ADD CONSTRAINT "canchas_complejo_id_complejos_id_fk" FOREIGN KEY ("complejo_id") REFERENCES "public"."complejos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imagenes_canchas" ADD CONSTRAINT "imagenes_canchas_cancha_id_canchas_id_fk" FOREIGN KEY ("cancha_id") REFERENCES "public"."canchas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_configs" ADD CONSTRAINT "slot_configs_cancha_id_canchas_id_fk" FOREIGN KEY ("cancha_id") REFERENCES "public"."canchas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifas" ADD CONSTRAINT "tarifas_cancha_id_canchas_id_fk" FOREIGN KEY ("cancha_id") REFERENCES "public"."canchas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_tenant_id_usuarios_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cancha_id_canchas_id_fk" FOREIGN KEY ("cancha_id") REFERENCES "public"."canchas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_player_id_usuarios_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promociones" ADD CONSTRAINT "promociones_tarifa_id_tarifas_id_fk" FOREIGN KEY ("tarifa_id") REFERENCES "public"."tarifas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipo_miembros" ADD CONSTRAINT "equipo_miembros_equipo_id_equipos_id_fk" FOREIGN KEY ("equipo_id") REFERENCES "public"."equipos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipo_miembros" ADD CONSTRAINT "equipo_miembros_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_creador_id_usuarios_id_fk" FOREIGN KEY ("creador_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partido_jugadores" ADD CONSTRAINT "partido_jugadores_partido_id_partidos_id_fk" FOREIGN KEY ("partido_id") REFERENCES "public"."partidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partido_jugadores" ADD CONSTRAINT "partido_jugadores_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_creador_id_usuarios_id_fk" FOREIGN KEY ("creador_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_equipo_a_id_equipos_id_fk" FOREIGN KEY ("equipo_a_id") REFERENCES "public"."equipos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partidos" ADD CONSTRAINT "partidos_equipo_b_id_equipos_id_fk" FOREIGN KEY ("equipo_b_id") REFERENCES "public"."equipos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_usuarios_email" ON "usuarios" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_usuarios_rol" ON "usuarios" USING btree ("rol");--> statement-breakpoint
CREATE INDEX "idx_complejos_tenant_id" ON "complejos" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_complejos_ciudad" ON "complejos" USING btree ("ciudad");--> statement-breakpoint
CREATE INDEX "idx_complejos_slug" ON "complejos" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_imagenes_complejos_complejo_id" ON "imagenes_complejos" USING btree ("complejo_id");--> statement-breakpoint
CREATE INDEX "idx_canchas_tenant_id" ON "canchas" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_canchas_complejo_id" ON "canchas" USING btree ("complejo_id");--> statement-breakpoint
CREATE INDEX "idx_canchas_tipo" ON "canchas" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "idx_imagenes_canchas_cancha_id" ON "imagenes_canchas" USING btree ("cancha_id");--> statement-breakpoint
CREATE INDEX "idx_reservas_tenant_id" ON "reservas" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_reservas_player_id" ON "reservas" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "idx_reservas_cancha_slot" ON "reservas" USING btree ("cancha_id","slot_inicio","slot_fin");--> statement-breakpoint
CREATE INDEX "idx_reservas_estado" ON "reservas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "idx_pagos_reserva_id" ON "pagos" USING btree ("reserva_id");--> statement-breakpoint
CREATE INDEX "idx_pagos_user_id" ON "pagos" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pagos_mp_payment_id" ON "pagos" USING btree ("mp_payment_id");--> statement-breakpoint
CREATE INDEX "idx_promociones_codigo" ON "promociones" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "idx_promociones_tarifa_id" ON "promociones" USING btree ("tarifa_id");--> statement-breakpoint
CREATE INDEX "idx_notificaciones_user_leida" ON "notificaciones" USING btree ("user_id","leida");--> statement-breakpoint
CREATE INDEX "idx_notificaciones_user_created" ON "notificaciones" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_equipo_miembros_equipo_user" ON "equipo_miembros" USING btree ("equipo_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_partido_jugadores_partido_user" ON "partido_jugadores" USING btree ("partido_id","user_id");
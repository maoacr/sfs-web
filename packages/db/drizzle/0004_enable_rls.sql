-- Deny-by-default en las 15 tablas de public.
--
-- El linter de Supabase marcaba las 15 como ERROR / EXTERNAL: estaban
-- expuestas por PostgREST sin row level security, o sea que cualquiera con la
-- anon key podía leer y escribir usuarios, pagos y reservas.
--
-- No se crean policies a propósito. RLS activo sin ninguna policy deniega todo
-- a los roles anon y authenticated, que es exactamente lo que queremos: la app
-- no usa PostgREST. Toda la lectura y escritura va por Drizzle con DATABASE_URL,
-- y ese rol (postgres, dueño de las tablas) tiene rolbypassrls, así que no se
-- ve afectado por esta migración.
--
-- Tampoco servirían policies basadas en auth.uid(): la autenticación es propia
-- (JWT firmados con jose en src/lib/jwt.ts), no Supabase Auth, así que
-- auth.uid() es NULL en toda petición.
--
-- Si algún día se expone PostgREST al cliente, cada tabla necesita su policy
-- explícita y habrá que revisar este archivo antes de abrir nada.
ALTER TABLE "usuarios" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "complejos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "imagenes_complejos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "canchas" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "imagenes_canchas" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "slot_configs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tarifas" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "reservas" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "pagos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "promociones" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notificaciones" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "equipos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "equipo_miembros" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "partidos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "partido_jugadores" ENABLE ROW LEVEL SECURITY;

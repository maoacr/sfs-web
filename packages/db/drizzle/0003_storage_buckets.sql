-- Buckets de Supabase Storage, versionados para que cualquier entorno quede igual.
--
-- canchas (público): fotos de canchas y complejos, pensadas para que las vea
--   cualquiera. El servidor convierte todo a WebP, así que solo se acepta ese
--   formato, con un tope de 5 MB por archivo.
-- sfs (privado): fotos de personas y equipos, y documentos. Se sirve con URLs
--   firmadas que vencen; nunca con URLs públicas.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('canchas', 'canchas', true, 5242880, ARRAY['image/webp'])
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
INSERT INTO storage.buckets (id, name, public)
VALUES ('sfs', 'sfs', false)
ON CONFLICT (id) DO NOTHING;

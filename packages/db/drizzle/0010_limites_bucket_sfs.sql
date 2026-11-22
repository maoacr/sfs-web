-- Alinea el bucket privado "sfs" con el público "canchas": los dos reciben
-- sólo el WebP que genera el servidor, con el mismo tope de 5 MB.
--
-- "sfs" se creó en 0003 sin file_size_limit ni allowed_mime_types, así que
-- aceptaba cualquier tipo y cualquier tamaño. Hoy eso no es explotable desde
-- el navegador: todo pasa por el servidor con service role, que convierte a
-- WebP con sharp y valida el tamaño antes de subir. Pero si esa validación se
-- rompe o alguien agrega un camino nuevo, el bucket deja de ser la segunda
-- línea de defensa. Que lo sea no cuesta nada.
--
-- 5 MB es el mismo número que "canchas". Aplica al archivo YA optimizado, que
-- para una foto de perfil de 512px queda en decenas de KB — el tope está
-- lejísimos de molestar a un usuario real.
--
-- Si en algún momento este bucket guarda documentos (la idea de 0003 lo
-- contemplaba), hay que ampliar allowed_mime_types en una migración nueva.
UPDATE storage.buckets
   SET file_size_limit = 5242880,
       allowed_mime_types = ARRAY['image/webp']
 WHERE id = 'sfs';

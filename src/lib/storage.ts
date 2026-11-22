import { getSupabaseAdmin } from "./supabase";
import sharp from "sharp";

// Bucket público: solo fotos de canchas y complejos. Las fotos de personas y
// equipos van al bucket privado "sfs" con URLs firmadas (ver docs de Storage).
const BUCKET = "canchas";
const BUCKET_PRIVADO = "sfs";

/**
 * Cuánto vive la URL firmada de una foto de perfil. Una hora alcanza de sobra
 * para una sesión de navegación y acota la ventana si el link se comparte.
 * Vive acá para que el endpoint que sube y el que lee firmen con el mismo TTL.
 */
export const AVATAR_URL_TTL_SEGUNDOS = 60 * 60;

type ImageType = "profile" | "photo";

const PRESETS: Record<ImageType, { width: number; height: number; quality: number }> = {
  profile: { width: 512, height: 512, quality: 82 },
  photo:   { width: 1920, height: 1920, quality: 82 },
};

/**
 * Comprime y optimiza una imagen con sharp:
 * - Convierte a WebP (~40% más pequeño que JPEG a misma calidad)
 * - Redimensiona a dimensiones máximas según el tipo
 * - Elimina metadatos EXIF (privacidad + ahorro)
 * - Mantiene calidad visual al 82%
 */
export async function optimizeImage(file: File, type: ImageType = "photo"): Promise<Buffer> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const preset = PRESETS[type];

  return sharp(buffer)
    .resize(preset.width, preset.height, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: preset.quality })
    .rotate() // auto-rotate based on EXIF
    .toBuffer();
}

/**
 * Optimiza y sube al bucket indicado. Retorna la RUTA del objeto, que es lo
 * único estable: la URL pública se deriva de la ruta y la firmada vence.
 */
async function subirOptimizada(file: File, folder: string, type: ImageType, bucket: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const optimized = await optimizeImage(file, type);
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, optimized, { contentType: "image/webp", upsert: false });

  if (error) throw new Error(`Error al subir imagen: ${error.message}`);

  return filename;
}

/**
 * Sube una imagen optimizada al bucket público y retorna la URL pública.
 * Para fotos de canchas y complejos, que cualquiera puede ver.
 */
export async function uploadImage(file: File, folder: string, type: ImageType = "photo"): Promise<string> {
  const filename = await subirOptimizada(file, folder, type, BUCKET);
  const { data } = getSupabaseAdmin().storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

/**
 * Sube una imagen optimizada al bucket PRIVADO y retorna su ruta.
 *
 * Devuelve la ruta y no una URL a propósito: el bucket es privado, así que lo
 * que se le muestra al navegador es una URL firmada que vence. Persistir esa
 * URL dejaría registros que caducan; se persiste la ruta y se firma al leer.
 */
export async function uploadPrivateImage(file: File, folder: string, type: ImageType = "photo"): Promise<string> {
  return subirOptimizada(file, folder, type, BUCKET_PRIVADO);
}

/**
 * URL firmada para una ruta del bucket privado, válida por `segundosDeVida`.
 * Retorna null si la ruta está vacía o si el objeto ya no existe: un perfil
 * sin foto es un caso normal, no un error que deba cortar la respuesta.
 */
export async function signedUrlFor(ruta: string, segundosDeVida: number): Promise<string | null> {
  if (!ruta) return null;

  const { data, error } = await getSupabaseAdmin()
    .storage
    .from(BUCKET_PRIVADO)
    .createSignedUrl(ruta, segundosDeVida);

  if (error || !data) return null;
  return data.signedUrl;
}

/** Elimina un objeto del bucket privado dada su ruta. */
export async function deletePrivateImage(ruta: string): Promise<void> {
  if (!ruta) return;
  await getSupabaseAdmin().storage.from(BUCKET_PRIVADO).remove([ruta]);
}

/**
 * Elimina una imagen de Supabase Storage dada su URL pública.
 */
export async function deleteImage(publicUrl: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const url = new URL(publicUrl);
  const path = url.pathname.split(`/storage/v1/object/public/${BUCKET}/`)[1];
  if (!path) return;

  await supabase.storage.from(BUCKET).remove([path]);
}

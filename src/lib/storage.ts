import { getSupabase } from "./supabase";
import sharp from "sharp";

const BUCKET = "imagenes";

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
 * Sube una imagen optimizada a Supabase Storage y retorna la URL pública.
 */
export async function uploadImage(file: File, folder: string, type: ImageType = "photo"): Promise<string> {
  const supabase = getSupabase();
  const optimized = await optimizeImage(file, type);
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, optimized, { contentType: "image/webp", upsert: false });

  if (error) throw new Error(`Error al subir imagen: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

/**
 * Elimina una imagen de Supabase Storage dada su URL pública.
 */
export async function deleteImage(publicUrl: string): Promise<void> {
  const supabase = getSupabase();
  const url = new URL(publicUrl);
  const path = url.pathname.split(`/storage/v1/object/public/${BUCKET}/`)[1];
  if (!path) return;

  await supabase.storage.from(BUCKET).remove([path]);
}

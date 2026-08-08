import { getSupabase } from "./supabase";

const BUCKET = "imagenes";

export async function uploadImage(file: File, folder: string): Promise<string> {
  const supabase = getSupabase();
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(`Error al subir imagen: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

export async function deleteImage(publicUrl: string): Promise<void> {
  const supabase = getSupabase();
  const url = new URL(publicUrl);
  const path = url.pathname.split(`/storage/v1/object/public/${BUCKET}/`)[1];
  if (!path) return;

  await supabase.storage.from(BUCKET).remove([path]);
}

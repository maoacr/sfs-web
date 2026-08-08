"use client";

import { useState, useRef } from "react";

interface ImagenInfo {
  id: string;
  url: string;
  orden: number;
  principal?: boolean;
}

interface Props {
  imagenes: ImagenInfo[];
  uploadUrl: string;
  onRefresh: () => void;
}

export function ImageUploadZone({ imagenes, uploadUrl, onRefresh }: Props) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("La imagen no debe superar 10MB");
      return;
    }

    setUploading(true); setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(uploadUrl, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Error al subir");
      onRefresh();
    } catch {
      setError("Error al subir la imagen");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(imagenId: string) {
    setDeleting(imagenId); setError("");
    try {
      const res = await fetch(`${uploadUrl}?id=${imagenId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      onRefresh();
    } catch {
      setError("Error al eliminar la imagen");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      {error && <div className="mb-4 rounded-xl bg-error-bg px-4 py-3 text-sm text-error">{error}</div>}

      {/* Upload button */}
      <div className="mb-4">
        <input ref={inputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="rounded-xl border border-dashed border-border hover:border-grass/30 bg-surface px-5 py-3 text-sm font-medium text-text-muted hover:text-grass-light transition-colors disabled:opacity-50">
          {uploading ? "⏳ Subiendo..." : "📷 Agregar imagen"}
        </button>
        <span className="ml-3 text-xs text-text-dim">JPG, PNG, WebP · máx 10MB</span>
      </div>

      {/* Gallery grid */}
      {imagenes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-text-dim text-sm">Sin imágenes. Subí la primera.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {imagenes.map(img => (
            <div key={img.id} className="group relative rounded-xl overflow-hidden border border-border bg-surface aspect-square">
              <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <button type="button" onClick={() => handleDelete(img.id)} disabled={deleting === img.id}
                  className="opacity-0 group-hover:opacity-100 rounded-lg bg-error/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-error transition-all">
                  {deleting === img.id ? "..." : "Eliminar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";

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
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
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
  }, [uploadUrl, onRefresh]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
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
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
    >
      {error && <div className="mb-4 rounded-xl bg-error-bg px-4 py-3 text-sm text-error">{error}</div>}

      <input ref={inputRef} type="file" accept="image/*" onChange={handleInputChange} className="hidden" />

      {imagenes.length === 0 ? (
        /* ─── Empty state — clickeable + drag & drop ─── */
        <div
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed bg-surface p-12 text-center cursor-pointer transition-all ${
            dragOver ? "border-grass bg-grass/5 scale-[1.02]" : "border-border hover:border-grass/30"
          }`}
        >
          {uploading ? (
            <div className="space-y-2">
              <div className="text-3xl">⏳</div>
              <p className="text-sm text-text-muted">Subiendo imagen...</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-3xl">📷</div>
              <p className="text-sm font-medium text-text-muted">Arrastrá una imagen o hacé clic para subir</p>
              <p className="text-xs text-text-dim">JPG, PNG, WebP · máx 10MB</p>
            </div>
          )}
        </div>
      ) : (
        /* ─── Gallery + upload bar ─── */
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-text-muted">{imagenes.length} imagen{imagenes.length !== 1 ? "es" : ""}</p>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
              className="rounded-lg border border-dashed border-border hover:border-grass/30 bg-surface px-4 py-2 text-sm font-medium text-text-muted hover:text-grass-light transition-colors disabled:opacity-50">
              {uploading ? "⏳ Subiendo..." : "📷 Agregar"}
            </button>
          </div>

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

            {/* Drop zone card — always visible at end of gallery */}
            <div
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={() => setDragOver(false)}
              className={`rounded-xl border-2 border-dashed bg-surface aspect-square flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                dragOver ? "border-grass bg-grass/5 scale-105" : "border-border hover:border-grass/30"
              }`}
            >
              <span className="text-2xl">+</span>
              <span className="text-xs text-text-dim">Subir</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ImageUploadZone } from "@/components/image-upload-zone";
import { MapPicker } from "@/components/map-picker";

interface CanchaInfo { id: string; nombre: string; tipo: string; capacidad: number; _count: { reservas: number } }
interface ImagenInfo { id: string; url: string; orden: number; principal: boolean }

export default function EditarComplejo() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [twitter, setTwitter] = useState("");
  const [facebook, setFacebook] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [canchas, setCanchas] = useState<CanchaInfo[]>([]);
  const [imagenes, setImagenes] = useState<ImagenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"datos" | "canchas" | "imagenes">("datos");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    fetch(`/api/complejos/${id}`).then(r => r.json()).then(c => {
      setNombre(c.nombre); setDireccion(c.direccion);
      setCiudad(c.ciudad || ""); setDepartamento(c.departamento || "");
      setDescripcion(c.descripcion || ""); setTelefono(c.telefono || "");
      setEmail(c.email || "");
      setInstagram(c.instagram || ""); setTiktok(c.tiktok || "");
      setTwitter(c.twitter || ""); setFacebook(c.facebook || "");
      setLat(c.lat || null); setLng(c.lng || null);
      setCanchas(c.canchas || []);
      setImagenes(c.imagenes || []);
    }).catch(() => setError("Error al cargar")).finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/complejos/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, direccion, ciudad: ciudad || null, departamento: departamento || null, descripcion: descripcion || null, telefono: telefono || null, email: email || null, instagram: instagram || null, tiktok: tiktok || null, twitter: twitter || null, facebook: facebook || null, lat, lng }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/complejos/${id}`, { method: "DELETE" });
      router.push("/owner/complejos"); router.refresh();
    } catch {
      setError("Error al eliminar");
      setDeleting(false);
    }
  }

  const i = "mt-1.5 block w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-grass focus:ring-1 focus:ring-grass";
  const l = "block text-sm font-medium text-text";

  if (loading) return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-8 w-20 animate-pulse rounded-lg bg-surface" />
        <div className="h-8 w-48 animate-pulse rounded bg-surface" />
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-surface" />
    </div>
  );

  return (
    <div className="p-6 lg:p-8">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/owner/complejos"
          className="flex items-center justify-center h-9 w-9 rounded-xl border border-border text-text-muted hover:text-text hover:border-border-hover transition-colors text-sm">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text">{nombre}</h1>
          <p className="text-sm text-text-muted">Complejo deportivo · {canchas.length} cancha{canchas.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-xl bg-surface p-1 border border-border">
        {(["datos", "canchas", "imagenes"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-field text-grass-light shadow-sm" : "text-text-muted hover:text-text"
            }`}>
            {t === "datos" ? "Información" : t === "canchas" ? `Canchas (${canchas.length})` : "Fotos"}
          </button>
        ))}
      </div>

      {/* Tab: Datos del complejo */}
      {tab === "datos" && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          {saved && <div className="mb-4 rounded-xl bg-success-bg border border-success/20 px-4 py-3 text-sm text-success">✅ Cambios guardados</div>}
          {error && <div className="mb-4 rounded-xl bg-error-bg px-4 py-3 text-sm text-error">{error}</div>}

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className={l}>Nombre del complejo</label>
              <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className={i} />
            </div>
            <div>
              <label className={l}>Dirección</label>
              <input type="text" required value={direccion} onChange={e => setDireccion(e.target.value)} className={i} placeholder="Calle, carrera, número" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={l}>Ciudad</label>
                <input type="text" value={ciudad} onChange={e => setCiudad(e.target.value)} className={i} placeholder="Ej: Bogotá" />
              </div>
              <div>
                <label className={l}>Departamento</label>
                <input type="text" value={departamento} onChange={e => setDepartamento(e.target.value)} className={i} placeholder="Ej: Cundinamarca" />
              </div>
            </div>
            <div>
              <label className={l}>Descripción</label>
              <textarea rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)} className={i} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={l}>Teléfono</label>
                <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className={i} />
              </div>
              <div>
                <label className={l}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={i} />
              </div>
            </div>

            {/* Ubicación en mapa */}
            <div className="pt-2 border-t border-border">
              <p className="text-sm font-medium text-text mb-3">Ubicación</p>
              <MapPicker lat={lat} lng={lng} direccion={direccion} ciudad={ciudad} departamento={departamento} onChange={(la, ln) => { setLat(la); setLng(ln); }} />
            </div>

            {/* Redes sociales */}
            <div className="pt-2 border-t border-border">
              <p className="text-sm font-medium text-text mb-3">Redes sociales</p>
              <div className="space-y-3">
                {[
                  { id: "instagram", label: "Instagram", value: instagram, set: setInstagram, prefix: "instagram.com/", icon: "📷" },
                  { id: "tiktok", label: "TikTok", value: tiktok, set: setTiktok, prefix: "tiktok.com/@", icon: "🎵" },
                  { id: "twitter", label: "Twitter / X", value: twitter, set: setTwitter, prefix: "x.com/", icon: "𝕏" },
                  { id: "facebook", label: "Facebook", value: facebook, set: setFacebook, prefix: "facebook.com/", icon: "📘" },
                ].map(({ id, label, value, set, prefix, icon }) => (
                  <div key={id}>
                    <label htmlFor={`social-${id}`} className="text-xs font-medium text-text-muted mb-1 block">{icon} {label}</label>
                    <div className="flex rounded-lg">
                      <span className="inline-flex items-center rounded-l-lg border border-r-0 border-border bg-surface px-3 text-xs text-text-dim">{prefix}</span>
                      <input id={`social-${id}`} type="text" value={value}
                        onChange={e => set(e.target.value)}
                        className="block w-full rounded-r-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-grass focus:ring-1 focus:ring-grass"
                        placeholder="tuusuario" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="submit" disabled={saving}
                className="rounded-xl bg-grass px-6 py-2.5 text-sm font-semibold text-white hover:bg-grass-light disabled:opacity-50 transition-colors">
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button type="button" onClick={() => setShowDelete(true)}
                className="rounded-xl border border-error/30 px-4 py-2.5 text-sm font-medium text-error hover:bg-error-bg transition-colors">
                Eliminar complejo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Canchas del complejo */}
      {tab === "canchas" && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-text-muted">{canchas.length} cancha{canchas.length !== 1 ? "s" : ""} en este complejo</p>
            <Link href={`/owner/canchas/nueva?complejo=${id}`}
              className="rounded-lg bg-grass px-4 py-2 text-sm font-semibold text-white hover:bg-grass-light transition-colors">
              + Agregar cancha
            </Link>
          </div>

          {canchas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
              <p className="text-text-muted text-sm">Este complejo no tiene canchas.</p>
            </div>
          ) : (
            canchas.map(c => (
              <Link key={c.id} href={`/owner/canchas/${c.id}`}
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 hover:border-border-hover hover:shadow-sm transition-all duration-150">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-field/30 text-base">⚽</div>
                  <div>
                    <p className="text-sm font-semibold text-text">{c.nombre}</p>
                    <p className="text-xs text-text-dim">{c.tipo} · {c.capacidad} jugadores</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {c._count && <span className="text-xs text-text-dim">{c._count.reservas} reservas</span>}
                  <span className="text-text-dim text-sm">Gestionar →</span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Tab: Imágenes del complejo */}
      {tab === "imagenes" && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <ImageUploadZone
            imagenes={imagenes}
            uploadUrl={`/api/complejos/${id}/imagenes`}
            onRefresh={async () => {
              const res = await fetch(`/api/complejos/${id}`);
              const c = await res.json();
              setImagenes(c.imagenes || []);
            }}
          />
        </div>
      )}

      {/* Delete modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDelete(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text">¿Eliminar este complejo?</h3>
            <p className="text-sm text-text-muted mt-2">Esta acción no se puede deshacer. Las canchas asociadas quedarán sin complejo.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowDelete(false)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm text-text-muted hover:bg-surface-hover">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 rounded-xl bg-error px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                {deleting ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

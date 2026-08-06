"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NuevoComplejo() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/complejos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, direccion, descripcion: descripcion || undefined, telefono: telefono || undefined, email: email || undefined }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Error al crear"); }
      router.push("/owner/dashboard"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }

  const i = "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-grass focus:ring-1 focus:ring-grass";
  const l = "block text-sm font-medium text-text";

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()}
          className="flex items-center justify-center h-8 w-8 rounded-lg border border-border text-text-muted hover:text-text hover:border-border-hover">←</button>
        <div>
          <h1 className="text-2xl font-bold text-text">Nuevo complejo</h1>
          <p className="mt-1 text-sm text-text-muted">Registrá la ubicación de tu espacio deportivo</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={l}>Nombre del complejo</label>
            <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className={i} placeholder='Ej: "Fútbol Center El Campito"' />
          </div>
          <div>
            <label className={l}>Dirección</label>
            <input type="text" required value={direccion} onChange={e => setDireccion(e.target.value)} className={i} placeholder="Calle, carrera, ciudad" />
          </div>
          <div>
            <label className={l}>Descripción <span className="font-normal text-text-dim">(opcional)</span></label>
            <textarea rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)} className={i} placeholder="Detalles del lugar, servicios generales..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={l}>Teléfono</label>
              <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className={i} placeholder="300 123 4567" />
            </div>
            <div>
              <label className={l}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={i} placeholder="complejo@email.com" />
            </div>
          </div>

          {error && <div className="rounded-lg bg-error-bg px-4 py-3 text-sm text-error">{error}</div>}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => router.back()}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-muted hover:bg-surface-hover transition-colors">Cancelar</button>
            <button type="submit" disabled={loading}
              className="rounded-lg bg-grass px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-grass-light disabled:opacity-50 transition-colors">
              {loading ? "Creando..." : "Crear complejo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

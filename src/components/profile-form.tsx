"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UserData {
  id: string; email: string; primerNombre: string; segundoNombre: string | null;
  apellidos: string; apodo: string | null; telefono: string | null;
  codigoPais: string; role: string;
}

export function ProfileForm() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [primerNombre, setPrimerNombre] = useState("");
  const [segundoNombre, setSegundoNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [apodo, setApodo] = useState("");
  const [codigoPais, setCodigoPais] = useState("+57");
  const [telefono, setTelefono] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(data => {
      setUser(data);
      setPrimerNombre(data.primerNombre || "");
      setSegundoNombre(data.segundoNombre || "");
      setApellidos(data.apellidos || "");
      setApodo(data.apodo || "");
      setCodigoPais(data.codigoPais || "+57");
      setTelefono(data.telefono || "");
    }).catch(() => setError("Error al cargar")).finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primerNombre, segundoNombre: segundoNombre || null, apellidos, apodo: apodo || null, codigoPais, telefono: telefono || null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  }

  const i = "mt-1.5 block w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-grass focus:ring-1 focus:ring-grass";
  const l = "block text-sm font-medium text-text";

  if (loading) return (
    <div className="p-6 lg:p-8">
      <div className="h-8 w-48 animate-pulse rounded bg-surface mb-6" />
      <div className="h-96 animate-pulse rounded-2xl bg-surface" />
    </div>
  );

  const nombreCompleto = [primerNombre, segundoNombre, apellidos].filter(Boolean).join(" ");

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()}
          className="flex items-center justify-center h-9 w-9 rounded-xl border border-border text-text-muted hover:text-text hover:border-border-hover transition-colors text-sm">
          ←
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text">Mi cuenta</h1>
          <p className="text-sm text-text-muted mt-1">{user?.email}</p>
        </div>
      </div>

      {/* Avatar + name preview */}
      <div className="mt-6 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-field to-grass flex items-center justify-center text-xl font-bold text-white shadow-sm">
          {primerNombre?.[0] || "?"}{apellidos?.[0] || ""}
        </div>
        <div>
          <p className="text-base font-semibold text-text">{nombreCompleto || "Sin nombre"}</p>
          {apodo && <p className="text-sm text-text-muted">@{apodo}</p>}
          <span className="inline-block mt-1 rounded-full bg-field/40 px-2.5 py-0.5 text-[11px] font-medium text-grass-light">
            {user?.role === "OWNER" ? "Dueño" : "Jugador"}
          </span>
        </div>
      </div>

      {/* Form */}
      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        {saved && <div className="mb-4 rounded-xl bg-success-bg border border-success/20 px-4 py-3 text-sm text-success">✅ Perfil actualizado</div>}
        {error && <div className="mb-4 rounded-xl bg-error-bg px-4 py-3 text-sm text-error">{error}</div>}

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={l}>Primer nombre</label>
              <input type="text" required value={primerNombre} onChange={e => setPrimerNombre(e.target.value)} className={i} />
            </div>
            <div>
              <label className={l}>Segundo nombre <span className="font-normal text-text-dim">(opcional)</span></label>
              <input type="text" value={segundoNombre} onChange={e => setSegundoNombre(e.target.value)} className={i} />
            </div>
          </div>
          <div>
            <label className={l}>Apellidos</label>
            <input type="text" required value={apellidos} onChange={e => setApellidos(e.target.value)} className={i} />
          </div>

          {/* Handle / Apodo */}
          <div>
            <label className={l}>Nombre de usuario</label>
            <div className="mt-1.5 flex rounded-xl shadow-sm">
              <span className="inline-flex items-center rounded-l-xl border border-r-0 border-border bg-surface px-4 text-sm text-text-muted">@</span>
              <input type="text" maxLength={30} value={apodo}
                onChange={e => setApodo(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                className="block w-full rounded-r-xl border border-border bg-surface px-4 py-2.5 text-sm text-text focus:border-grass focus:ring-1 focus:ring-grass"
                placeholder="tuhandle" />
            </div>
            <p className="mt-1 text-xs text-text-dim">Solo letras, números y guiones bajos. Te identificará en el sistema.</p>
          </div>

          {/* Teléfono */}
          <div>
            <label className={l}>Teléfono</label>
            <div className="mt-1.5 flex gap-2">
              <select value={codigoPais} onChange={e => setCodigoPais(e.target.value)}
                className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-grass focus:ring-1 focus:ring-grass">
                <option value="+57">🇨🇴 +57</option>
                <option value="+54">🇦🇷 +54</option>
                <option value="+56">🇨🇱 +56</option>
                <option value="+51">🇵🇪 +51</option>
                <option value="+593">🇪🇨 +593</option>
                <option value="+52">🇲🇽 +52</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+34">🇪🇸 +34</option>
              </select>
              <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
                className="block w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-text focus:border-grass focus:ring-1 focus:ring-grass" placeholder="300 123 4567" />
            </div>
          </div>

          {/* Email — read only */}
          <div>
            <label className={l}>Email</label>
            <input type="email" value={user?.email || ""} disabled
              className="mt-1.5 block w-full rounded-xl border border-border bg-bg/30 px-4 py-2.5 text-sm text-text-dim cursor-not-allowed" />
            <p className="mt-1 text-xs text-text-dim">El email no se puede cambiar.</p>
          </div>

          {/* Social / Redes — placeholder */}
          <div className="pt-2 border-t border-border">
            <p className="text-sm font-medium text-text mb-3">Redes sociales <span className="font-normal text-text-dim">(próximamente)</span></p>
            <div className="grid grid-cols-2 gap-3">
              {["instagram", "tiktok", "twitter", "facebook"].map(r => (
                <div key={r} className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-bg/30 px-4 py-2.5 opacity-50">
                  <span className="text-sm capitalize">{r}</span>
                  <input disabled className="flex-1 bg-transparent text-xs text-text-dim" placeholder="Conectar..." />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <button type="submit" disabled={saving}
              className="rounded-xl bg-grass px-6 py-2.5 text-sm font-semibold text-white hover:bg-grass-light disabled:opacity-50 transition-colors">
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

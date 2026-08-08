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

  const [instagram, setInstagram] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [twitter, setTwitter] = useState("");
  const [facebook, setFacebook] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(data => {
      setUser(data);
      setPrimerNombre(data.primerNombre || "");
      setSegundoNombre(data.segundoNombre || "");
      setApellidos(data.apellidos || "");
      setApodo(data.apodo || "");
      setCodigoPais(data.codigoPais || "+57");
      setTelefono(data.telefono || "");
      setInstagram(data.instagram || "");
      setTiktok(data.tiktok || "");
      setTwitter(data.twitter || "");
      setFacebook(data.facebook || "");
    }).catch(() => setError("Error al cargar")).finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primerNombre, segundoNombre: segundoNombre || null, apellidos, apodo: apodo || null, codigoPais, telefono: telefono || null, instagram: instagram || null, tiktok: tiktok || null, twitter: twitter || null, facebook: facebook || null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally { setSaving(false); }
  }

  const i = "mt-1.5 block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-dim focus:border-grass focus:ring-1 focus:ring-grass transition-colors";
  const l = "block text-sm font-medium text-text";

  if (loading) return (
    <div className="p-6 lg:p-10">
      <div className="h-8 w-48 animate-pulse rounded bg-surface mb-8" />
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
        <div className="h-80 animate-pulse rounded-2xl bg-surface" />
        <div className="h-96 animate-pulse rounded-2xl bg-surface" />
      </div>
    </div>
  );

  const nombreCompleto = [primerNombre, segundoNombre, apellidos].filter(Boolean).join(" ");
  const iniciales = `${primerNombre?.[0] || ""}${apellidos?.[0] || ""}`.toUpperCase() || "?";
  const isOwner = user?.role === "OWNER";

  return (
    <div className="p-6 pb-44 lg:p-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()}
          className="flex items-center justify-center h-9 w-9 rounded-xl border border-border text-text-muted hover:text-text hover:border-border-hover transition-colors">
          ←
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text">Mi cuenta</h1>
          <p className="text-sm text-text-muted">{user?.email}</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 items-start">

        {/* ─── LEFT: Profile Card ─── */}
        <div className="rounded-2xl border border-border bg-surface p-8 flex flex-col items-center text-center shadow-card lg:sticky lg:top-24">
          {/* Avatar — large, with gradient ring */}
          <div className="relative mb-5">
            <div className="h-28 w-28 rounded-full bg-gradient-to-br from-field via-grass to-grass-light p-[3px] shadow-glow">
              <div className="h-full w-full rounded-full bg-surface flex items-center justify-center">
                <span className="text-3xl font-bold text-text">{iniciales}</span>
              </div>
            </div>
            {/* Camera badge — future photo upload */}
            <div className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-grass border-2 border-surface flex items-center justify-center shadow-md cursor-pointer hover:bg-grass-light transition-colors"
              title="Foto de perfil — próximamente">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
          </div>

          {/* Name */}
          <h2 className="text-xl font-bold text-text mb-0.5">{nombreCompleto || "Sin nombre"}</h2>
          {apodo && <p className="text-sm text-grass-light font-medium mb-1">@{apodo}</p>}

          {/* Role badge */}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold mb-6 ${
            isOwner ? "bg-field/40 text-grass-light" : "bg-info-bg text-info"
          }`}>
            {isOwner ? "🏟️ Dueño" : "⚽ Jugador"}
          </span>

          {/* Stats */}
          <div className="w-full grid grid-cols-2 gap-3 pt-6 border-t border-border">
            <div className="bg-bg/50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-text">0</p>
              <p className="text-[11px] text-text-dim mt-0.5">{isOwner ? "Canchas" : "Reservas"}</p>
            </div>
            <div className="bg-bg/50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-text">0</p>
              <p className="text-[11px] text-text-dim mt-0.5">{isOwner ? "Clientes" : "Partidos"}</p>
            </div>
          </div>

          {/* Member since */}
          <p className="mt-5 text-xs text-text-dim">
            {isOwner ? "Administrando canchas" : "Jugando fútbol"} desde SFS
          </p>
        </div>

        {/* ─── RIGHT: Form ─── */}
        <div className="rounded-2xl border border-border bg-surface p-6 lg:p-8 shadow-card">
          {saved && <div className="mb-5 rounded-xl bg-success-bg border border-success/20 px-4 py-3 text-sm text-success flex items-center gap-2">✅ Perfil actualizado</div>}
          {error && <div className="mb-5 rounded-xl bg-error-bg px-4 py-3 text-sm text-error">{error}</div>}

          <form id="profile-form" onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            {/* Handle */}
            <div>
              <label className={l}>Nombre de usuario</label>
              <div className="mt-1.5 flex rounded-xl">
                <span className="inline-flex items-center rounded-l-xl border border-r-0 border-border bg-surface px-4 text-sm text-text-muted">@</span>
                <input type="text" maxLength={30} value={apodo}
                  onChange={e => setApodo(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  className="block w-full rounded-r-xl border border-border bg-surface px-4 py-3 text-sm text-text focus:border-grass focus:ring-1 focus:ring-grass"
                  placeholder="tuhandle" />
              </div>
              <p className="mt-1 text-xs text-text-dim">Solo letras, números y guiones bajos.</p>
            </div>

            {/* Phone */}
            <div>
              <label className={l}>Teléfono</label>
              <div className="mt-1.5 flex gap-2">
                <select value={codigoPais} onChange={e => setCodigoPais(e.target.value)}
                  className="rounded-xl border border-border bg-surface px-3 py-3 text-sm text-text focus:border-grass focus:ring-1 focus:ring-grass">
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
                  className="block w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text focus:border-grass focus:ring-1 focus:ring-grass" placeholder="300 123 4567" />
              </div>
            </div>

            {/* Email — read only */}
            <div>
              <label className={l}>Email</label>
              <input type="email" value={user?.email || ""} disabled
                className="mt-1.5 block w-full rounded-xl border border-border bg-bg/30 px-4 py-3 text-sm text-text-dim cursor-not-allowed" />
              <p className="mt-1 text-xs text-text-dim">El email no se puede cambiar.</p>
            </div>

            {/* Social */}
            <div className="pt-4 border-t border-border">
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
                    <div className="flex rounded-xl">
                      <span className="inline-flex items-center rounded-l-xl border border-r-0 border-border bg-surface px-3 text-xs text-text-dim">{prefix}</span>
                      <input id={`social-${id}`} type="text" value={value}
                        onChange={e => set(e.target.value)}
                        className="block w-full rounded-r-xl border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-grass focus:ring-1 focus:ring-grass"
                        placeholder="tuusuario" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>

          {/* Fixed save bar on mobile — floats above bottom tab bar */}
          <div className="fixed bottom-16 left-0 right-0 px-6 py-4 bg-bg/90 backdrop-blur-xl border-t border-border z-50 lg:hidden">
            <button type="submit" form="profile-form" disabled={saving}
              className="w-full rounded-xl bg-gradient-to-r from-grass to-grass-light py-3.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-grass/20">
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>

          {/* Desktop save button (inline) */}
          <div className="hidden lg:block pt-4">
            <button type="submit" form="profile-form" disabled={saving}
              className="rounded-xl bg-gradient-to-r from-grass to-grass-light px-8 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50 transition-all shadow-md shadow-grass/20">
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

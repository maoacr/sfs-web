"use client";

import { useState } from "react";
import Link from "next/link";

type AuthFormProps = { mode: "login" | "register" };

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [primerNombre, setPrimerNombre] = useState("");
  const [segundoNombre, setSegundoNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [apodo, setApodo] = useState("");
  const [codigoPais, setCodigoPais] = useState("+57");
  const [telefono, setTelefono] = useState("");
  const [role, setRole] = useState<"PLAYER" | "OWNER">("PLAYER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const body: Record<string, string> = { email, password };
      if (!isLogin) {
        body.primerNombre = primerNombre;
        body.segundoNombre = segundoNombre;
        body.apellidos = apellidos;
        body.apodo = apodo;
        body.codigoPais = codigoPais;
        body.telefono = telefono;
        body.role = role;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error inesperado"); return; }
      window.location.href = data.user?.role === "OWNER" ? "/owner/dashboard" : "/player/buscar";
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Hero panel (left side, desktop) ─────────────────────────────────

  const HeroPanel = () => (
    <div className="hidden lg:flex flex-col justify-center w-1/2 bg-gradient-to-br from-field to-field-light p-16 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-12 left-12 text-8xl opacity-15">⚽</div>
      <div className="absolute bottom-20 right-16 text-9xl opacity-10 rotate-12">🥅</div>
      <div className="absolute top-1/3 right-24 text-6xl opacity-10">🏟️</div>

      {/* Gradient circles */}
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-grass/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-grass/10 blur-3xl" />

      {/* Content */}
      <div className="relative z-10 max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-grass shadow-lg shadow-grass/25">
            <span className="text-xl">⚽</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-white tracking-tight">SFS</span>
            <span className="block text-sm text-white/60">Sistema de Fútbol</span>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-white leading-tight mb-4">
          {isLogin ? "Bienvenido de vuelta" : "Empezá a jugar"}
        </h2>
        <p className="text-lg text-white/70 leading-relaxed">
          {isLogin
            ? "Gestioná tus canchas, revisá tus reservas y mantené todo bajo control desde un solo lugar."
            : "Encontrá canchas cerca tuyo, reservá tu horario y jugá sin vueltas. La cancha te espera."}
        </p>

        {/* Stats */}
        <div className="flex gap-8 mt-10">
          <div>
            <p className="text-2xl font-bold text-white">+100</p>
            <p className="text-sm text-white/50">Canchas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">+500</p>
            <p className="text-sm text-white/50">Reservas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">+1000</p>
            <p className="text-sm text-white/50">Jugadores</p>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Form panel (right side, desktop) ─────────────────────────────────

  const FormPanel = () => (
    <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 lg:p-16">
      <div className="w-full max-w-md mx-auto space-y-6">
        {/* Mobile branding (hidden on desktop) */}
        <div className="lg:hidden text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-field">
            <span className="text-lg">⚽</span>
          </div>
          <h1 className="text-xl font-bold text-text">SFS</h1>
          <p className="text-xs text-text-dim">Sistema de Fútbol</p>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-text">
            {isLogin ? "Iniciar sesión" : "Crear cuenta"}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {isLogin ? "Ingresá a tu cuenta para continuar" : "Completá tus datos para registrarte"}
          </p>
        </div>

        {/* Google OAuth button */}
        <button type="button"
          onClick={() => alert("Google OAuth — próximamente")}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text hover:bg-surface-hover transition-colors">
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar con Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-dim">o con email</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input id="primerNombre" label="Primer nombre" required value={primerNombre} onChange={setPrimerNombre} placeholder="Carlos" />
                <Input id="segundoNombre" label="Segundo nombre" value={segundoNombre} onChange={setSegundoNombre} placeholder="Andrés" />
              </div>
              <Input id="apellidos" label="Apellidos" required value={apellidos} onChange={setApellidos} placeholder="Gómez Pérez" />

              {/* Apodo */}
              <div>
                <label htmlFor="apodo" className="block text-sm font-medium text-text">Usuario <span className="font-normal text-text-dim">(opcional)</span></label>
                <div className="mt-1 flex rounded-lg">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-border bg-surface px-3 text-sm text-text-muted">@</span>
                  <input id="apodo" type="text" maxLength={30} value={apodo}
                    onChange={(e) => setApodo(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    className="block w-full rounded-r-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-grass focus:ring-1 focus:ring-grass"
                    placeholder="carlitosgomez" />
                </div>
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium text-text mb-1.5">Teléfono</label>
                <div className="flex gap-2">
                  <select value={codigoPais} onChange={(e) => setCodigoPais(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-2 py-2 text-sm text-text focus:border-grass focus:ring-1 focus:ring-grass">
                    <option value="+57">🇨🇴 +57</option>
                    <option value="+54">🇦🇷 +54</option>
                    <option value="+56">🇨🇱 +56</option>
                    <option value="+51">🇵🇪 +51</option>
                    <option value="+593">🇪🇨 +593</option>
                    <option value="+52">🇲🇽 +52</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+34">🇪🇸 +34</option>
                  </select>
                  <input id="telefono" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)}
                    className="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-grass focus:ring-1 focus:ring-grass"
                    placeholder="300 123 4567" />
                </div>
              </div>

              {/* Tipo de cuenta */}
              <div>
                <label className="block text-sm font-medium text-text mb-2">Tipo de cuenta</label>
                <div className="grid grid-cols-2 gap-3">
                  <RoleBtn active={role === "PLAYER"} onClick={() => setRole("PLAYER")} label="Jugador" icon="⚽" />
                  <RoleBtn active={role === "OWNER"} onClick={() => setRole("OWNER")} label="Dueño" icon="🏟️" />
                </div>
              </div>
            </>
          )}

          <Input id="email" label="Email" type="email" required value={email} onChange={setEmail} placeholder="tu@email.com" />
          <Input id="password" label="Contraseña" type="password" required minLength={8} value={password} onChange={setPassword} placeholder="Mínimo 8 caracteres" />

          {error && <div className="rounded-lg bg-error-bg px-4 py-3 text-sm text-error">{error}</div>}

          <button type="submit" disabled={loading}
            className="w-full rounded-xl bg-grass px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-grass-light disabled:opacity-50 transition-colors">
            {loading ? "Cargando..." : isLogin ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>

        <p className="text-center text-sm text-text-muted">
          {isLogin ? (
            <>¿No tenés cuenta? <Link href="/auth/register" className="font-medium text-grass hover:text-grass-light">Registrate</Link></>
          ) : (
            <>¿Ya tenés cuenta? <Link href="/auth/login" className="font-medium text-grass hover:text-grass-light">Iniciá sesión</Link></>
          )}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-bg">
      <HeroPanel />
      <FormPanel />
    </div>
  );
}

/* ─── Reusable Input ─────────────────────────────────────────────────── */

function Input({ id, label, type = "text", required, minLength, value, onChange, placeholder }: {
  id: string; label: string; type?: string; required?: boolean; minLength?: number;
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text">{label}</label>
      <input id={id} type={type} required={required} minLength={minLength} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-grass focus:ring-1 focus:ring-grass"
        placeholder={placeholder} />
    </div>
  );
}

function RoleBtn({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
        active ? "border-grass bg-field text-grass-light" : "border-border text-text-muted hover:border-border-hover"
      }`}>
      {icon} {label}
    </button>
  );
}

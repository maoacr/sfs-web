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

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / Brand */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-field">
            <span className="text-xl">⚽</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">
            {isLogin ? "Iniciar sesión" : "Crear cuenta"}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {isLogin
              ? "Ingresá a SFS para gestionar tus canchas o reservar"
              : "Registrate y empezá a jugar"}
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
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
                  <label htmlFor="apodo" className="block text-sm font-medium text-text">Nombre de usuario <span className="font-normal text-text-dim">(opcional)</span></label>
                  <div className="mt-1 flex rounded-lg">
                    <span className="inline-flex items-center rounded-l-lg border border-r-0 border-border bg-surface px-3 text-sm text-text-muted">@</span>
                    <input id="apodo" type="text" maxLength={30} value={apodo}
                      onChange={(e) => setApodo(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                      className="block w-full rounded-r-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-grass focus:ring-1 focus:ring-grass"
                      placeholder="carlitosgomez" />
                  </div>
                  <p className="mt-1 text-xs text-text-dim">Solo letras, números y guiones bajos.</p>
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-medium text-text mb-2">Teléfono</label>
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
              className="w-full rounded-lg bg-grass px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-grass-light disabled:opacity-50 transition-colors">
              {loading ? "Cargando..." : isLogin ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </form>
        </div>

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
        className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-grass focus:ring-1 focus:ring-grass"
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

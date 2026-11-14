"use client";

import { useState } from "react";

/**
 * Campo de texto compartido por los formularios de autenticación.
 *
 * Vive aparte de `auth-form.tsx` porque lo usan también las pantallas de
 * recuperación: el ojo para ver la contraseña tiene que estar en todos los
 * lugares donde alguien escribe una, no sólo en el registro.
 */
function IconoOjo({ tachado }: { tachado: boolean }) {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
      strokeWidth={1.5} aria-hidden="true">
      {tachado ? (
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243" />
      ) : (
        <>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </>
      )}
    </svg>
  );
}

export function Input({ id, label, type = "text", required, minLength, value, onChange, placeholder, autoComplete }: {
  id: string; label: string; type?: string; required?: boolean; minLength?: number;
  value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  const esPassword = type === "password";

  /**
   * Mostrar la contraseña no es una comodidad: NIST 800-63B lo recomienda
   * porque quien ve lo que escribe se equivoca menos y se anima a claves más
   * largas. Cambia el `type` del mismo nodo — no se re-monta el input, así
   * que no se pierde el cursor ni lo que el gestor de contraseñas ya llenó.
   */
  const tipoVisible = esPassword && visible ? "text" : type;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text">{label}</label>
      <div className="relative mt-1">
        <input id={id} type={tipoVisible} required={required} minLength={minLength} value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={`block w-full rounded-lg border border-border bg-surface py-3 pl-3 text-base sm:text-sm text-text placeholder:text-text-dim focus:border-grass focus:ring-1 focus:ring-grass ${esPassword ? "pr-11" : "pr-3"}`}
          placeholder={placeholder} />
        {esPassword && (
          <button type="button" onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-text-muted transition-colors hover:text-text focus:outline-none focus-visible:ring-1 focus-visible:ring-grass">
            <IconoOjo tachado={visible} />
          </button>
        )}
      </div>
    </div>
  );
}

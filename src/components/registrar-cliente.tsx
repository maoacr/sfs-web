"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { formatearPrecio } from "@/lib/moneda";

/** Lo que el modal de reserva necesita del cliente, creado o vinculado. */
export interface ClienteRegistrado {
  id: string;
  primerNombre: string;
  apellidos: string;
  telefono: string | null;
  saldoPendiente: number;
}

/**
 * La cuenta que ya existía con ese email. Del titular sólo llega el primer
 * nombre: alcanza para confirmar que es quien está enfrente, y no entrega la
 * ficha de alguien que nunca pisó la cancha.
 */
interface CuentaExistente {
  id: string;
  primerNombre: string;
  saldoPendiente: number;
}

/**
 * Registrar en el momento a quien cayó al mostrador y no está en el sistema.
 *
 * Reemplaza al camino del invitado, donde la reserva quedaba a nombre del
 * DUEÑO con el nombre de la persona en una columna aparte. Eso tenía una
 * consecuencia que nadie había notado: si ese invitado quedaba debiendo, la
 * deuda era del dueño, y como deber bloquea reservar lo dejaba sin poder
 * agendar a nadie. Con cuenta propia, la deuda cae donde corresponde.
 *
 * La cuenta nace sin contraseña y todavía no puede entrar. El email es lo que
 * después le permite RECLAMARLA: al entrar con Google el sistema la reconoce
 * por email y le entrega su historial.
 */
export function RegistrarCliente({ nombreTipeado, onCerrar, onRegistrado }: {
  /** Lo que el dueño ya escribió en el buscador. Se usa para no pedirlo otra vez. */
  nombreTipeado: string;
  onCerrar: () => void;
  onRegistrado: (cliente: ClienteRegistrado) => void;
}) {
  const [primerNombre, apellidosTipeados] = partirNombre(nombreTipeado);

  const [nombre, setNombre] = useState(primerNombre);
  const [segundoNombre, setSegundoNombre] = useState("");
  const [apellidos, setApellidos] = useState(apellidosTipeados);
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [apodo, setApodo] = useState("");
  const [instagram, setInstagram] = useState("");
  const [verMas, setVerMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Cuando el email ya tiene cuenta, el camino NO es crear una segunda —eso
  // partiría el historial y el saldo de la misma persona— sino vincular esa.
  const [cuentaExistente, setCuentaExistente] = useState<CuentaExistente | null>(null);

  async function registrar() {
    setError(null);

    // Se valida acá para no hacer un viaje por un error obvio, pero el
    // servidor valida igual: esto es comodidad, no seguridad.
    if (!nombre.trim()) return setError("Falta el nombre.");
    if (!apellidos.trim()) return setError("Faltan los apellidos.");

    setEnviando(true);
    const res = await apiFetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Los campos vacíos NO se mandan: un string vacío es un dato inventado,
      // y el servidor lo guardaría como ausente de todos modos.
      body: JSON.stringify({
        primerNombre: nombre.trim(),
        apellidos: apellidos.trim(),
        ...(segundoNombre.trim() ? { segundoNombre: segundoNombre.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
        ...(apodo.trim() ? { apodo: apodo.trim() } : {}),
        ...(instagram.trim() ? { instagram: instagram.trim() } : {}),
      }),
    });
    const data = await res.json().catch(() => null);
    setEnviando(false);

    if (!res.ok) {
      // El 409 del email repetido no es un error muerto: trae la cuenta que ya
      // existe para poder usarla.
      if (data?.clienteExistente) {
        setCuentaExistente(data.clienteExistente as CuentaExistente);
      }
      return setError(data?.error ?? "No pudimos registrar al cliente. Intentá de nuevo.");
    }
    onRegistrado(data as ClienteRegistrado);
  }

  const campo = "mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div role="dialog" aria-labelledby="titulo-registrar-cliente"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-bg p-5 sm:rounded-2xl">
        <h2 id="titulo-registrar-cliente" className="text-lg font-bold text-text">
          Registrar al cliente
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Queda con cuenta propia, así la reserva es suya y lo que deba no te cae a vos.
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-text">
            <p>{error}</p>

            {cuentaExistente && (
              <>
                <p className="mt-2 text-text-muted">
                  Es la cuenta de <strong className="text-text">{cuentaExistente.primerNombre}</strong>,
                  con el email {email.trim()}. Si es la persona que tenés enfrente, agendale a
                  esa cuenta: así la reserva le queda en su historial en vez de crear una
                  segunda cuenta para la misma persona.
                </p>

                {cuentaExistente.saldoPendiente > 0 && (
                  <p className="mt-2 text-error">
                    Ojo: esa cuenta debe {formatearPrecio(cuentaExistente.saldoPendiente)}, así que
                    no vas a poder agendarle hasta que pague o registres el cobro.
                  </p>
                )}

                <button type="button"
                  onClick={() => onRegistrado({
                    id: cuentaExistente.id,
                    primerNombre: cuentaExistente.primerNombre,
                    // El apellido y el teléfono no viajan a propósito. Se
                    // completan solos la primera vez que la persona entre.
                    apellidos: "",
                    telefono: null,
                    saldoPendiente: cuentaExistente.saldoPendiente,
                  })}
                  className="mt-3 min-h-11 w-full rounded-xl bg-grass px-4 text-sm font-semibold text-white hover:bg-grass-light">
                  Usar esa cuenta
                </button>
              </>
            )}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cliente-nombre" className="block text-sm font-medium text-text">Nombre</label>
              <input id="cliente-nombre" type="text" value={nombre}
                onChange={e => setNombre(e.target.value)} className={campo} />
            </div>
            <div>
              <label htmlFor="cliente-apellidos" className="block text-sm font-medium text-text">Apellidos</label>
              <input id="cliente-apellidos" type="text" value={apellidos}
                onChange={e => setApellidos(e.target.value)} className={campo} />
            </div>
          </div>

          <div>
            <label htmlFor="cliente-email" className="block text-sm font-medium text-text">
              Email <span className="font-normal text-text-dim">(opcional)</span>
            </label>
            <input id="cliente-email" type="email" inputMode="email" value={email}
              onChange={e => { setEmail(e.target.value); setCuentaExistente(null); setError(null); }}
              className={campo}
              placeholder="para que pueda reclamar su cuenta" />
            <p className="mt-1 text-xs text-text-dim">
              Si lo dejás, el día que entre con Google el sistema lo reconoce y le entrega
              su historial. Sin email la reserva funciona igual.
            </p>
          </div>

          <div>
            <label htmlFor="cliente-telefono" className="block text-sm font-medium text-text">
              Teléfono <span className="font-normal text-text-dim">(opcional)</span>
            </label>
            <input id="cliente-telefono" type="tel" inputMode="tel" value={telefono}
              onChange={e => setTelefono(e.target.value)} className={campo} />
          </div>

          <button type="button" onClick={() => setVerMas(v => !v)}
            className="text-xs font-medium text-grass hover:text-grass-light">
            {verMas ? "Menos datos" : "Más datos"}
          </button>

          {verMas && (
            <div className="space-y-3 rounded-xl border border-border bg-surface p-3">
              <div>
                <label htmlFor="cliente-segundo-nombre" className="block text-sm font-medium text-text">Segundo nombre</label>
                <input id="cliente-segundo-nombre" type="text" value={segundoNombre}
                  onChange={e => setSegundoNombre(e.target.value)} className={campo} />
              </div>
              <div>
                <label htmlFor="cliente-apodo" className="block text-sm font-medium text-text">Apodo</label>
                <input id="cliente-apodo" type="text" value={apodo}
                  onChange={e => setApodo(e.target.value)} className={campo}
                  placeholder="solo letras y números" />
              </div>
              <div>
                <label htmlFor="cliente-instagram" className="block text-sm font-medium text-text">Instagram</label>
                <input id="cliente-instagram" type="text" value={instagram}
                  onChange={e => setInstagram(e.target.value)} className={campo} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={onCerrar} type="button"
            className="min-h-11 flex-1 rounded-xl border border-border px-4 text-sm font-medium text-text-muted hover:bg-surface-hover">
            Volver
          </button>
          <button onClick={registrar} type="button" disabled={enviando}
            className="min-h-11 flex-1 rounded-xl bg-grass px-4 text-sm font-semibold text-white hover:bg-grass-light disabled:opacity-60">
            {enviando ? "Registrando…" : "Registrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Parte lo tipeado en nombre y apellidos. La primera palabra es el nombre y el
 * resto los apellidos — y con una sola palabra el apellido queda VACÍO en vez
 * de repetir el nombre: preferimos un campo que el dueño complete antes que un
 * dato inventado que nadie va a revisar.
 */
function partirNombre(tipeado: string): [string, string] {
  const palabras = tipeado.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return ["", ""];
  const [primera, ...resto] = palabras;
  return [primera, resto.join(" ")];
}

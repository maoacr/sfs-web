/**
 * Qué puede hacer el dueño con una reserva.
 *
 * Estas preguntas se contestaban inline en `/owner/reservas`, con condiciones
 * como `!MUERTAS.has(estado) && estado !== "COMPLETADA"` repetidas en el JSX.
 * Ahora que el dashboard ofrece las mismas acciones, la decisión necesita un
 * solo dueño: dos pantallas que deciden por separado terminan decidiendo
 * distinto el día que alguien arregle un caso borde en una sola.
 *
 * Es deliberado que esto no tenga JSX. Las dos pantallas pintan distinto —una
 * son botones de diez píxeles en una fila, la otra un modal— y compartir el
 * markup habría terminado en `className` por props. Lo que no puede divergir
 * es la decisión, no el padding.
 */

/** Lo único que hace falta saber de una reserva para decidir. */
export interface ReservaAccionable {
  estado: string;
  saldoPendiente: number;
}

/**
 * Cancelada o expirada: no se cobra, no se juega, no se cancela de nuevo.
 * `COMPLETADA` NO está acá — un partido jugado sigue admitiendo cobro.
 */
const ESTADOS_MUERTOS = new Set(["CANCELADA", "EXPIRADA"]);

const estaMuerta = (reserva: ReservaAccionable) => ESTADOS_MUERTOS.has(reserva.estado);

/**
 * Lo que habilita el cobro es **que haya saldo**, no en qué punto del partido
 * estemos. Preguntarle al estado fue el bug del callejón: marcar un partido
 * como jugado dejaba la deuda imposible de registrar, y como el saldo bloquea
 * reservar, el jugador quedaba bloqueado sin forma de saldar.
 */
export function sePuedeCobrar(reserva: ReservaAccionable): boolean {
  return reserva.saldoPendiente > 0 && !estaMuerta(reserva);
}

/**
 * No mira el saldo, y es a propósito: "¿se jugó?" y "¿se pagó?" son dos ejes
 * independientes. El caso normal del negocio es que el partido termine y la
 * plata entre inmediatamente después — o sea que hay un momento en que se jugó
 * y todavía se debe. Exigir saldo cero acá pediría que los hechos pasen en el
 * orden inverso al que pasan en la cancha.
 */
export function sePuedeMarcarJugada(reserva: ReservaAccionable): boolean {
  return !estaMuerta(reserva) && reserva.estado !== "COMPLETADA";
}

export function sePuedeCancelar(reserva: ReservaAccionable): boolean {
  return !estaMuerta(reserva);
}

/**
 * Si cobrar y cerrar el turno son el mismo momento real —y lo son: se paga al
 * terminar el partido— les corresponde un solo gesto. Esto decide si el cobro
 * tiene que ofrecer además marcar el partido como jugado.
 *
 * Es una oferta, no una condición: quien se fue sin pagar se registra con
 * "Marcar jugada" y queda en cuentas por cobrar, que es donde la deuda sigue
 * siendo visible y cobrable.
 */
export function seOfreceCerrarAlCobrar(reserva: ReservaAccionable): boolean {
  return sePuedeCobrar(reserva) && sePuedeMarcarJugada(reserva);
}

/**
 * Traduce el resultado de un pago de MercadoPago a algo que el jugador pueda
 * leer y accionar.
 *
 * "Rechazado" no es una respuesta útil: son más de veinte motivos y cada uno
 * pide algo distinto —revisar el CVV, llamar al banco, usar otra tarjeta, o
 * justamente NO volver a intentar—. El `status_detail` ya trae esa precisión;
 * acá sólo se la pasamos a la persona.
 *
 * El mapa es deliberadamente incompleto: MercadoPago agrega códigos nuevos
 * cuando quiere. Lo que no conocemos cae en el mensaje genérico de su `status`,
 * que siempre es honesto aunque sea vago. Un código nuevo degrada la precisión
 * del mensaje, nunca lo rompe ni lo convierte en mentira.
 */

export interface ExplicacionPago {
  /** Qué pasó y qué hacer, en una línea mostrable tal cual. */
  mensaje: string;
  /**
   * Si tiene sentido volver a ofrecer el botón de pagar.
   *
   * Es `false` cuando reintentar es inútil (el pago ya está en curso) o
   * peligroso (duplicado: la persona podría terminar pagando dos veces).
   */
  reintentable: boolean;
}

const POR_DETALLE: Record<string, ExplicacionPago> = {
  // ─── Aprobados ───────────────────────────────────────────────────────
  accredited: { mensaje: "Listo, tu pago se acreditó.", reintentable: false },
  partially_refunded: { mensaje: "El pago se acreditó y tiene un reembolso parcial.", reintentable: false },

  // ─── En curso: el jugador no tiene nada que hacer salvo esperar ──────
  pending_capture: { mensaje: "Tu banco autorizó el pago y está por acreditarse.", reintentable: false },
  offline_process: { mensaje: "Estamos procesando el pago. Te avisamos apenas se acredite.", reintentable: false },
  pending_contingency: { mensaje: "MercadoPago está procesando el pago. Te avisamos apenas se acredite.", reintentable: false },
  pending_review_manual: { mensaje: "MercadoPago está revisando el pago. Puede demorar hasta dos días hábiles y te avisamos cuando se resuelva.", reintentable: false },

  // ─── En curso, pero falta algo de parte de la persona ────────────────
  pending_waiting_transfer: { mensaje: "Falta que completes la transferencia desde tu banco.", reintentable: false },
  pending_waiting_payment: { mensaje: "Falta completar el pago en el medio que elegiste.", reintentable: false },
  pending_challenge: { mensaje: "Tu banco pide una verificación extra para autorizar el pago.", reintentable: true },

  // ─── Rechazos por datos mal cargados: se corrige y se reintenta ──────
  cc_rejected_bad_filled_card_number: { mensaje: "Revisá el número de la tarjeta e intentá de nuevo.", reintentable: true },
  cc_rejected_bad_filled_date: { mensaje: "Revisá la fecha de vencimiento de la tarjeta e intentá de nuevo.", reintentable: true },
  cc_rejected_bad_filled_security_code: { mensaje: "Revisá el código de seguridad de la tarjeta e intentá de nuevo.", reintentable: true },
  cc_rejected_bad_filled_other: { mensaje: "Revisá los datos de la tarjeta e intentá de nuevo.", reintentable: true },

  // ─── Rechazos que piden otra tarjeta o hablar con el banco ───────────
  cc_rejected_insufficient_amount: { mensaje: "La tarjeta no tiene fondos suficientes. Probá con otra.", reintentable: true },
  cc_rejected_call_for_authorize: { mensaje: "Tu banco tiene que autorizar este pago. Llamalos al número del dorso de la tarjeta y volvé a intentar.", reintentable: true },
  cc_rejected_card_disabled: { mensaje: "La tarjeta está inhabilitada. Llamá a tu banco para activarla o probá con otra.", reintentable: true },
  cc_rejected_invalid_installments: { mensaje: "Esa tarjeta no acepta esa cantidad de cuotas. Elegí otra opción.", reintentable: true },
  cc_rejected_card_error: { mensaje: "Hubo un problema con la tarjeta. Probá de nuevo o usá otra.", reintentable: true },
  cc_rejected_3ds_mandatory: { mensaje: "Tu banco pide una verificación extra. Volvé a intentar y completá la autenticación.", reintentable: true },
  cc_amount_rate_limit_exceeded: { mensaje: "El monto supera el límite de ese medio de pago. Probá con otro.", reintentable: true },

  // Al jugador no se le cuenta que cayó en un filtro de riesgo: no puede
  // hacer nada con esa información y lo único que logra es alarmarlo.
  cc_rejected_high_risk: { mensaje: "No pudimos procesar el pago con ese medio. Probá con otro.", reintentable: true },
  cc_rejected_blacklist: { mensaje: "No pudimos procesar el pago con ese medio. Probá con otro.", reintentable: true },

  cc_rejected_max_attempts: { mensaje: "Llegaste al límite de intentos con esa tarjeta. Probá con otra.", reintentable: true },
  cc_rejected_other_reason: { mensaje: "Tu banco rechazó el pago. Probá con otra tarjeta.", reintentable: true },
  rejected_by_bank: { mensaje: "Tu banco rechazó el pago. Contactalos o probá con otra tarjeta.", reintentable: true },
  rejected_by_regulations: { mensaje: "El pago no se pudo procesar por una restricción del banco. Probá con otro medio.", reintentable: true },
  rejected_insufficient_data: { mensaje: "Faltaron datos para procesar el pago. Intentá de nuevo completando todo.", reintentable: true },

  // El único caso donde reintentar es peligroso: puede terminar pagando dos veces.
  cc_rejected_duplicated_payment: {
    mensaje: "Ya hiciste un pago por ese monto. Si no lo ves acreditado, esperá unos minutos antes de volver a intentar.",
    reintentable: false,
  },
};

const POR_STATUS: Record<string, ExplicacionPago> = {
  approved: { mensaje: "Listo, tu pago se acreditó.", reintentable: false },
  authorized: { mensaje: "Tu banco autorizó el pago y está por acreditarse.", reintentable: false },
  in_process: { mensaje: "Estamos procesando el pago. Te avisamos apenas se acredite.", reintentable: false },
  pending: { mensaje: "El pago quedó pendiente. Te avisamos apenas se acredite.", reintentable: false },
  in_mediation: { mensaje: "El pago está en disputa. Escribinos para que lo veamos.", reintentable: false },
  rejected: { mensaje: "El pago fue rechazado. Probá con otro medio de pago.", reintentable: true },
  cancelled: { mensaje: "El pago se canceló antes de completarse. Podés intentarlo de nuevo.", reintentable: true },
  refunded: { mensaje: "El pago fue reembolsado.", reintentable: false },
  charged_back: { mensaje: "El pago tuvo un contracargo. Escribinos para resolverlo.", reintentable: false },
};

/** Cuando no sabemos nada, lo honesto es decir que no sabemos. */
const DESCONOCIDO: ExplicacionPago = {
  mensaje: "No pudimos confirmar el estado del pago. Revisá tus reservas en un rato y escribinos si sigue igual.",
  reintentable: true,
};

export function explicarPago(status?: string, detalle?: string): ExplicacionPago {
  if (detalle) {
    const porDetalle = POR_DETALLE[detalle.toLowerCase()];
    if (porDetalle) return porDetalle;
  }

  if (status) {
    const porStatus = POR_STATUS[status.toLowerCase()];
    if (porStatus) return porStatus;
  }

  return DESCONOCIDO;
}

/**
 * Los nombres con que MercadoPago informa el resultado al redirigir.
 *
 * No son los mismos que usa la API: la doc de back_urls habla de
 * `success`/`failure` y la de pagos de `approved`/`rejected`. Es el mismo
 * hecho con dos vocabularios, y mezclarlos hacía caer todo en el mensaje
 * genérico de "no pudimos confirmar".
 */
export type Tono = "ok" | "error" | "espera";

/**
 * Qué cara poner. Sale del estado, no del texto del mensaje: inferirlo
 * leyendo la copia es frágil y se rompe apenas alguien reescribe una frase.
 */
const TONO_VUELTA: Record<string, Tono> = {
  approved: "ok",
  rejected: "error",
  pending: "espera",
  in_process: "espera",
};

const ALIAS_VUELTA: Record<string, string> = {
  approved: "approved",
  success: "approved",
  rejected: "rejected",
  failure: "rejected",
  pending: "pending",
  in_process: "in_process",
};

/**
 * Explica la vuelta del checkout a partir del `status` de la query, o `null`
 * si no hay nada honesto que decir.
 *
 * Devuelve `null` —en vez del mensaje genérico— a propósito. Volver del
 * checkout sin haber pagado manda `status=null`, y avisar "no pudimos
 * confirmar el estado del pago" por ese no-evento asusta sin motivo. La
 * tarjeta de la reserva ya muestra la verdad, que viene de la base y no de
 * un parámetro de URL que cualquiera puede escribir.
 */
export function explicarVueltaDeMp(
  status: string | null | undefined
): (ExplicacionPago & { tono: Tono }) | null {
  if (!status) return null;

  const normalizado = ALIAS_VUELTA[status.toLowerCase()];
  if (!normalizado) return null;

  const explicacion = POR_STATUS[normalizado];
  if (!explicacion) return null;

  return { ...explicacion, tono: TONO_VUELTA[normalizado] ?? "espera" };
}

/**
 * Cuánto se espera antes de volver a ofrecer el pago tras un rechazo por
 * duplicado.
 *
 * MercadoPago rechaza como duplicado un cobro parecido hecho con la misma
 * tarjeta en pocos minutos. Si ese cobro "parecido" fue sobre ESTA reserva y su
 * webhook todavía no llegó, nuestro `montoPagado` dice cero por un rato aunque
 * la plata haya entrado. La espera convierte esa carrera en un dato: pasados
 * estos minutos, si seguimos en cero es porque de verdad no entró nada.
 *
 * Son tres minutos contra un TTL de quince, así que queda tiempo de sobra para
 * pagar.
 */
export const ESPERA_TRAS_DUPLICADO_MS = 3 * 60 * 1000;

const DUPLICADO = "cc_rejected_duplicated_payment";

/**
 * ¿Se le puede ofrecer pagar de nuevo?
 *
 * `explicarPago` traduce lo que dijo MercadoPago. Esto DECIDE, y para decidir
 * hace falta algo que MP no sabe: cuánta plata entró en esta reserva.
 *
 * ── Por qué el duplicado necesita un caso aparte ──────────────────────────
 *
 * MP marca el duplicado como no reintentable y tiene razón en su mundo: su
 * ventana compara tarjeta y monto entre TODAS sus operaciones, no por reserva.
 * Un jugador que pagó otra cancha hace un rato y reserva otra por el mismo
 * monto se come un "duplicado" sobre una reserva donde nunca entró un peso.
 *
 * Esconder el botón ahí deja la reserva en `PENDIENTE_PAGO` con cero pagado y
 * el TTL corriendo: **la persona pierde la cancha sin haber pagado y sin forma
 * de pagar**. El riesgo de pagar dos veces existe sólo si en ESTA reserva ya
 * entró plata, y eso lo dice `montoPagado`, que es el eje donde vive el dinero.
 *
 * Los pendientes siguen sin reintentarse pase lo que pase: ahí hay un cobro en
 * vuelo que puede acreditarse solo, y eso sí sería pagar dos veces.
 */
export function sePuedeReintentarElPago(
  reserva: {
    montoPagado: number;
    ultimoPago: { estadoPago: string; detalleEstado: string | null; createdAt: string | Date } | null;
  },
  ahora: number = Date.now()
): boolean {
  const ultimo = reserva.ultimoPago;

  // Sin intento previo, o sin que MP haya dicho nada concreto, no hay motivo
  // para esconder nada.
  if (!ultimo?.detalleEstado) return true;

  // Que un pago se haya acreditado no dice nada sobre el saldo que queda.
  // Confundirlo es lo que una vez dejó a un jugador sin poder pagar su saldo.
  if (ultimo.estadoPago === "APROBADO") return true;

  const explicacion = explicarPago(undefined, ultimo.detalleEstado);
  if (explicacion.reintentable) return true;

  // No reintentable según MP. El duplicado es el único caso donde su contexto
  // y el nuestro pueden discrepar.
  if (ultimo.detalleEstado.toLowerCase() !== DUPLICADO) return false;

  // Si en esta reserva ya entró plata, reintentar sí sería pagar dos veces.
  if (reserva.montoPagado > 0) return false;

  return ahora - new Date(ultimo.createdAt).getTime() >= ESPERA_TRAS_DUPLICADO_MS;
}

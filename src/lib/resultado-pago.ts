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

import { prisma } from "@sfs/db";
import type { Prisma } from "@prisma/client";

/**
 * Motor de precios dinámicos para canchas.
 *
 * Combina tarifas base + factores horarios + promociones
 * para calcular el precio final de una reserva.
 */

export interface PrecioBreakdown {
  precioBase: number;
  factorAplicado: number;
  descuento: number;
  descuentoTipo: "porcentaje" | "monto_fijo" | null;
  promocionAplicada: string | null;
  precioFinal: number;
  tarifaId: string;
}

export interface PrecioResult {
  success: true;
  data: PrecioBreakdown;
}

export interface PrecioError {
  success: false;
  error: string;
}

/**
 * Calcula el precio para una cancha en una fecha y hora específicas.
 *
 * @param canchaId - UUID de la cancha
 * @param fecha - Fecha en formato ISO (YYYY-MM-DD)
 * @param hora - Hora en formato HH:MM (24h)
 * @param codigoPromocion - Código de promoción opcional
 */
export async function calcularPrecio(
  canchaId: string,
  fecha: string,
  hora: string,
  codigoPromocion?: string
): Promise<PrecioResult | PrecioError> {
  // ─── 1. Determinar día de la semana ────────────────────────────────────

  const date = new Date(fecha + "T12:00:00");
  if (isNaN(date.getTime())) {
    return { success: false, error: "Fecha inválida" };
  }
  const diaSemana = date.getDay(); // 0=Domingo, 6=Sábado

  const [horaNum] = hora.split(":").map(Number);
  if (isNaN(horaNum) || horaNum < 0 || horaNum > 23) {
    return { success: false, error: "Hora inválida" };
  }

  // ─── 2. Buscar todas las tarifas de la cancha ──────────────────────────

  const tarifas = await prisma.tarifa.findMany({
    where: { canchaId },
    include: { promociones: true },
  });

  if (tarifas.length === 0) {
    return { success: false, error: "Esta cancha no tiene tarifas configuradas" };
  }

  // ─── 3. Encontrar la tarifa más específica ─────────────────────────────

  let tarifaSeleccionada: (typeof tarifas)[0] | undefined;

  // 3a: Match exacto de día + rango horario
  tarifaSeleccionada = tarifas.find((t) => {
    if (t.diaSemana !== diaSemana) return false;
    if (t.horaInicio && t.horaFin) {
      const hInicio = new Date(t.horaInicio).getUTCHours();
      const hFin = new Date(t.horaFin).getUTCHours();
      return horaNum >= hInicio && horaNum < hFin;
    }
    return true; // sin rango horario = todo el día
  });

  // 3b: Match solo por día (sin rango horario definido)
  if (!tarifaSeleccionada) {
    tarifaSeleccionada = tarifas.find(
      (t) => t.diaSemana === diaSemana && !t.horaInicio
    );
  }

  // 3c: Fallback — tarifa genérica (sin día ni hora)
  if (!tarifaSeleccionada) {
    tarifaSeleccionada = tarifas.find((t) => t.diaSemana === null);
  }

  if (!tarifaSeleccionada) {
    return {
      success: false,
      error: "No hay tarifa disponible para este día y horario",
    };
  }

  // ─── 4. Calcular precio base × factor ──────────────────────────────────

  const precioBase = Number(tarifaSeleccionada.precioBase);
  const factor = Number(tarifaSeleccionada.factor);
  let precioFinal = precioBase * factor;
  let descuento = 0;
  let descuentoTipo: "porcentaje" | "monto_fijo" | null = null;
  let promocionAplicada: string | null = null;

  // ─── 5. Aplicar promoción si existe ────────────────────────────────────

  if (codigoPromocion) {
    const promo = tarifaSeleccionada.promociones.find(
      (p) => p.codigo === codigoPromocion.toUpperCase()
    );

    if (!promo) {
      return { success: false, error: "Código de promoción no válido" };
    }

    const now = new Date();
    if (now < promo.validoDesde || now > promo.validoHasta) {
      return { success: false, error: "Esta promoción no está vigente" };
    }

    if (promo.usosMaximos !== null && promo.usosActuales >= promo.usosMaximos) {
      return { success: false, error: "Esta promoción ya alcanzó el límite de usos" };
    }

    const valor = Number(promo.valor);

    if (promo.tipoDescuento === "PORCENTAJE") {
      descuento = Math.round(precioFinal * (valor / 100));
      descuentoTipo = "porcentaje";
    } else {
      descuento = Math.min(valor, precioFinal); // no puede superar el precio
      descuentoTipo = "monto_fijo";
    }

    precioFinal = Math.max(0, precioFinal - descuento);
    promocionAplicada = promo.codigo;
  }

  return {
    success: true,
    data: {
      precioBase,
      factorAplicado: factor,
      descuento,
      descuentoTipo,
      promocionAplicada,
      precioFinal,
      tarifaId: tarifaSeleccionada.id,
    },
  };
}

/**
 * Incrementa el contador de usos de una promoción.
 */
export async function usarPromocion(codigo: string): Promise<void> {
  await prisma.promocion.updateMany({
    where: { codigo: codigo.toUpperCase() },
    data: { usosActuales: { increment: 1 } },
  });
}

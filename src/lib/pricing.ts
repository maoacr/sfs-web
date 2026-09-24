import { db, tarifas, promociones } from "@sfs/db";
import { eq, sql } from "drizzle-orm";

/**
 * Motor de precios dinámicos para canchas con Drizzle ORM.
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

export async function calcularPrecio(
  canchaId: string,
  fecha: string,
  hora: string,
  codigoPromocion?: string
): Promise<PrecioResult | PrecioError> {
  const [yearStr, monthStr, dayStr] = fecha.split("-");
  const date = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr), 12, 0, 0));
  if (isNaN(date.getTime())) {
    return { success: false, error: "Fecha inválida" };
  }
  const diaSemana = date.getUTCDay(); // 0=Domingo, 6=Sábado

  const [hStr, mStr] = hora.split(":");
  const horaNum = parseInt(hStr, 10);
  const minNum = parseInt(mStr || "0", 10);
  const minutoInicio = horaNum * 60 + minNum;

  const tarifasList = await db.query.tarifas.findMany({
    where: eq(tarifas.canchaId, canchaId),
    with: {
      promociones: true,
    },
  });

  if (tarifasList.length === 0) {
    return { success: false, error: "Esta cancha no tiene tarifas configuradas" };
  }

  // 1. Tarifa por día y rango horario
  let tarifaSeleccionada = tarifasList.find((t) => {
    if (t.diaSemana !== null && t.diaSemana !== undefined && t.diaSemana !== diaSemana) return false;
    if (t.horaInicio && t.horaFin) {
      const [ih, im] = String(t.horaInicio).split(":").map(Number);
      const [fh, fm] = String(t.horaFin).split(":").map(Number);
      const startMin = ih * 60 + (im || 0);
      const endMin = fh * 60 + (fm || 0);
      return minutoInicio >= startMin && minutoInicio < endMin;
    }
    return false;
  });

  // 2. Tarifa específica por día sin rango
  if (!tarifaSeleccionada) {
    tarifaSeleccionada = tarifasList.find(
      (t) => t.diaSemana !== null && t.diaSemana !== undefined && t.diaSemana === diaSemana && !t.horaInicio
    );
  }

  // 3. Fallback: tarifa base
  if (!tarifaSeleccionada) {
    tarifaSeleccionada = tarifasList.find((t) => t.diaSemana === null || t.diaSemana === undefined);
  }

  if (!tarifaSeleccionada) {
    tarifaSeleccionada = tarifasList[0];
  }

  const precioBase = Number(tarifaSeleccionada.precioBase);
  const factor = Number(tarifaSeleccionada.factor || 1);
  let precioFinal = Math.round(precioBase * factor);
  let descuento = 0;
  let descuentoTipo: "porcentaje" | "monto_fijo" | null = null;
  let promocionAplicada: string | null = null;

  if (codigoPromocion) {
    const promo = tarifaSeleccionada.promociones.find(
      (p) => p.codigo === codigoPromocion.toUpperCase()
    );

    if (!promo) {
      return { success: false, error: "Código de promoción no válido" };
    }

    const now = new Date();
    if (now < new Date(promo.validoDesde) || now > new Date(promo.validoHasta)) {
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
      descuento = Math.min(valor, precioFinal);
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

export async function usarPromocion(codigo: string): Promise<void> {
  await db
    .update(promociones)
    .set({ usosActuales: sql`${promociones.usosActuales} + 1` })
    .where(eq(promociones.codigo, codigo.toUpperCase()));
}

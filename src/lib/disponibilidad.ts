import { aInstante } from "@/lib/zona-horaria";

/** Día de la semana (0=Domingo) de una fecha de calendario, independiente de la zona. */
export function diaSemanaDeFecha(fechaIso: string): number {
  const [year, month, day] = fechaIso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export interface SlotConfigItem {
  diaSemana: number;
  horaApertura: string | Date;
  horaCierre: string | Date;
}

export interface TarifaItem {
  id: string;
  precioBase: string | number;
  diaSemana?: number | null;
  horaInicio?: string | Date | null;
  horaFin?: string | Date | null;
  factor: string | number;
}

export interface ReservaItem {
  id: string;
  slotInicio: Date | string;
  slotFin: Date | string;
  estado: string;
  player?: {
    nombre?: string | null;
    apellido?: string | null;
    apodo?: string | null;
    telefono?: string | null;
  } | null;
}

export interface SlotCalculado {
  inicio: string;
  fin: string;
  horaInicio: string;
  horaFin: string;
  disponible: boolean;
  precio: number;
  reserva?: {
    id: string;
    estado: string;
    player?: string;
    apodo?: string | null;
    telefono?: string | null;
  };
}

/**
 * Convierte un formato de hora (string "HH:MM" / "HH:MM:SS" o Date) a minutos del día (0 - 1439).
 */
export function parseHoraToMinutes(hora: string | Date): number {
  if (hora instanceof Date) {
    return hora.getUTCHours() * 60 + hora.getUTCMinutes();
  }
  if (typeof hora === "string") {
    // Si viene en formato ISO o con T
    if (hora.includes("T")) {
      const d = new Date(hora);
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    }
    const [hStr, mStr] = hora.split(":");
    const h = parseInt(hStr || "0", 10);
    const m = parseInt(mStr || "0", 10);
    return h * 60 + m;
  }
  return 0;
}

/**
 * Formatea minutos del día a string "HH:MM".
 */
export function formatMinutesToHora(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Verifica si dos intervalos de tiempo se solapan.
 * Dos intervalos se solapan si: (A_inicio < B_fin) && (A_fin > B_inicio)
 */
export function haySolapamiento(
  inicioA: Date | number,
  finA: Date | number,
  inicioB: Date | number,
  finB: Date | number
): boolean {
  const tIniA = inicioA instanceof Date ? inicioA.getTime() : inicioA;
  const tFinA = finA instanceof Date ? finA.getTime() : finA;
  const tIniB = inicioB instanceof Date ? inicioB.getTime() : inicioB;
  const tFinB = finB instanceof Date ? finB.getTime() : finB;

  return tIniA < tFinB && tFinA > tIniB;
}

/**
 * Calcula el precio dinámico de un slot específico según tarifas y factores horarios.
 */
export function calcularPrecioSlot(
  diaSemana: number,
  minutoInicio: number,
  tarifas: TarifaItem[]
): { precio: number; tarifaId?: string } {
  if (!tarifas || tarifas.length === 0) {
    return { precio: 0 };
  }

  // 1. Buscar tarifa específica por día y rango horario
  const tarifaConHorario = tarifas.find((t) => {
    if (t.diaSemana !== null && t.diaSemana !== undefined && t.diaSemana !== diaSemana) return false;
    if (t.horaInicio && t.horaFin) {
      const hIni = parseHoraToMinutes(t.horaInicio);
      const hFin = parseHoraToMinutes(t.horaFin);
      return minutoInicio >= hIni && minutoInicio < hFin;
    }
    return false;
  });

  if (tarifaConHorario) {
    const base = Number(tarifaConHorario.precioBase);
    const factor = Number(tarifaConHorario.factor || 1);
    return { precio: Math.round(base * factor), tarifaId: tarifaConHorario.id };
  }

  // 2. Buscar tarifa específica por día sin rango horario
  const tarifaPorDia = tarifas.find(
    (t) => t.diaSemana !== null && t.diaSemana !== undefined && t.diaSemana === diaSemana && !t.horaInicio
  );
  if (tarifaPorDia) {
    const base = Number(tarifaPorDia.precioBase);
    const factor = Number(tarifaPorDia.factor || 1);
    return { precio: Math.round(base * factor), tarifaId: tarifaPorDia.id };
  }

  // 3. Fallback: primera tarifa base disponible
  const tarifaFallback = tarifas[0];
  const base = Number(tarifaFallback.precioBase);
  const factor = Number(tarifaFallback.factor || 1);
  return { precio: Math.round(base * factor), tarifaId: tarifaFallback.id };
}

export function turnoDentroDeHorario(params: {
  slotConfig: SlotConfigItem | undefined;
  hora: string;
  duracionMinutos: number;
}): boolean {
  const { slotConfig, hora, duracionMinutos } = params;
  if (!slotConfig) return false;
  const inicio = parseHoraToMinutes(hora);
  return (
    inicio >= parseHoraToMinutes(slotConfig.horaApertura) &&
    inicio + duracionMinutos <= parseHoraToMinutes(slotConfig.horaCierre)
  );
}

/**
 * Calcula todos los slots disponibles de una cancha para una fecha específica.
 */
export function calcularSlotsDisponibles(params: {
  fechaIso: string; // "YYYY-MM-DD" en la zona de la cancha
  slotConfig: SlotConfigItem;
  duracionSlotMinutos: number;
  reservas: ReservaItem[];
  tarifas: TarifaItem[];
  zonaHoraria: string;
  nowTimestamp?: number; // Para tests deterministas
}): SlotCalculado[] {
  const {
    fechaIso,
    slotConfig,
    duracionSlotMinutos,
    reservas,
    tarifas,
    zonaHoraria,
    nowTimestamp = Date.now(),
  } = params;

  const aperturaMin = parseHoraToMinutes(slotConfig.horaApertura);
  const cierreMin = parseHoraToMinutes(slotConfig.horaCierre);

  if (cierreMin <= aperturaMin || duracionSlotMinutos <= 0) {
    return [];
  }

  const diaSemana = diaSemanaDeFecha(fechaIso);

  const slots: SlotCalculado[] = [];
  let cursorMin = aperturaMin;

  while (cursorMin + duracionSlotMinutos <= cierreMin) {
    const finMin = cursorMin + duracionSlotMinutos;

    const slotInicioDate = aInstante(fechaIso, formatMinutesToHora(cursorMin), zonaHoraria);
    const slotFinDate = aInstante(fechaIso, formatMinutesToHora(finMin), zonaHoraria);

    // Si el turno ya pasó hoy, se puede omitir o marcar no disponible
    const esPasado = slotInicioDate.getTime() < nowTimestamp;

    // Verificar si alguna reserva confirmada o pendiente solapa este slot
    const reservaSolapada = reservas.find((r) => {
      if (r.estado !== "CONFIRMADA" && r.estado !== "PENDIENTE_PAGO" && r.estado !== "PAGO_PARCIAL") {
        return false;
      }
      const rInicio = new Date(r.slotInicio);
      const rFin = new Date(r.slotFin);
      return haySolapamiento(slotInicioDate, slotFinDate, rInicio, rFin);
    });

    const { precio } = calcularPrecioSlot(diaSemana, cursorMin, tarifas);

    const playerName = reservaSolapada?.player
      ? `${reservaSolapada.player.nombre || ""} ${reservaSolapada.player.apellido || ""}`.trim()
      : undefined;

    slots.push({
      inicio: slotInicioDate.toISOString(),
      fin: slotFinDate.toISOString(),
      horaInicio: formatMinutesToHora(cursorMin),
      horaFin: formatMinutesToHora(finMin),
      disponible: !reservaSolapada && !esPasado,
      precio,
      reserva: reservaSolapada
        ? {
            id: reservaSolapada.id,
            estado: reservaSolapada.estado,
            player: playerName || "Usuario",
            apodo: reservaSolapada.player?.apodo,
            telefono: reservaSolapada.player?.telefono,
          }
        : undefined,
    });

    cursorMin = finMin;
  }

  return slots;
}

// Las reservas se guardan como instantes UTC (timestamptz), pero los horarios,
// tarifas y "días" son hora local de la cancha. Estas funciones convierten
// entre ambos usando la zona IANA del complejo (nunca un offset fijo: varias
// zonas cambian de offset por horario de verano).

export const ZONA_HORARIA_DEFAULT = "America/Bogota";

export function esZonaHorariaValida(zona: string): boolean {
  if (!zona) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

function formatoPartes(zona: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function componentes(instante: Date, zona: string) {
  const partes = Object.fromEntries(
    formatoPartes(zona)
      .formatToParts(instante)
      .map((p) => [p.type, p.value])
  );
  return {
    anio: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
    segundo: Number(partes.second),
  };
}

function offsetMs(instante: Date, zona: string): number {
  const c = componentes(instante, zona);
  return Date.UTC(c.anio, c.mes - 1, c.dia, c.hora, c.minuto, c.segundo) - instante.getTime();
}

/** Instante UTC de una fecha ("YYYY-MM-DD") y hora ("HH:MM") locales de la zona. */
export function aInstante(fecha: string, hora: string, zona: string): Date {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  const comoUtc = Date.UTC(anio, mes - 1, dia, h, m);
  // El offset depende del instante; se recalcula una vez por si cruzamos un cambio de horario.
  const primero = comoUtc - offsetMs(new Date(comoUtc), zona);
  return new Date(comoUtc - offsetMs(new Date(primero), zona));
}

/** Fecha ("YYYY-MM-DD") y hora ("HH:MM") locales de un instante en la zona. */
export function partesEnZona(instante: Date | string, zona: string): { fecha: string; hora: string } {
  const c = componentes(new Date(instante), zona);
  const dos = (n: number) => String(n).padStart(2, "0");
  return {
    fecha: `${c.anio}-${dos(c.mes)}-${dos(c.dia)}`,
    hora: `${dos(c.hora)}:${dos(c.minuto)}`,
  };
}

/**
 * Rango UTC que contiene el día de calendario `fecha` en cualquier zona
 * (de UTC+14 a UTC-12). Sirve para prefiltrar en SQL; el filtro exacto por
 * zona se hace después con `partesEnZona`.
 */
export function ventanaDelDia(fecha: string): { desde: Date; hasta: Date } {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const hora = 60 * 60 * 1000;
  return {
    desde: new Date(Date.UTC(anio, mes - 1, dia) - 14 * hora),
    hasta: new Date(Date.UTC(anio, mes - 1, dia + 1) + 12 * hora),
  };
}

/** "YYYY-MM-DD" del día de calendario de un Date según el reloj local (p. ej. un selector de fecha). */
export function fechaDeCalendario(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Fecha de hoy en la zona indicada, o según el reloj local si no se indica. */
export function fechaHoy(zona?: string): string {
  return zona ? partesEnZona(new Date(), zona).fecha : fechaDeCalendario(new Date());
}

export function formatearHora(instante: Date | string, zona: string): string {
  return new Date(instante).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zona,
  });
}

export function formatearFecha(
  instante: Date | string,
  zona: string,
  opciones: Intl.DateTimeFormatOptions = {}
): string {
  return new Date(instante).toLocaleDateString("es-CO", { ...opciones, timeZone: zona });
}

/**
 * Formatea una dirección estructurada de complejo en texto legible.
 * Ej: "Calle 123 #45-67, Bogotá"
 */
export function formatAddress(c: {
  tipoVia?: string | null;
  numeroVia?: string | null;
  numeroSec?: string | null;
  ciudad?: string | null;
  departamento?: string | null;
  [key: string]: any;
}): string {
  const via = c.tipoVia || "";
  const num = c.numeroVia || "";
  const sec = c.numeroSec ? ` #${c.numeroSec}` : "";
  const ciudad = c.ciudad || "";
  return [`${via} ${num}${sec}`.trim(), ciudad].filter(Boolean).join(", ") || "Sin dirección";
}

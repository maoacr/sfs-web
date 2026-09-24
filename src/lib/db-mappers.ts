import type { Complejo } from "@sfs/db";
import { tiposCancha, type TipoCancha } from "@/lib/schemas";

// The API contract predates the Drizzle schema; these adapters keep the
// frontend contract stable while the database uses its own naming.

const TIPO_CANCHA_DB = {
  F5: "FUTBOL_5",
  F6: "FUTBOL_6",
  F7: "FUTBOL_7",
  F8: "FUTBOL_8",
  F9: "FUTBOL_9",
  F11: "FUTBOL_11",
} as const satisfies Record<TipoCancha, string>;

export type TipoCanchaDb = (typeof TIPO_CANCHA_DB)[TipoCancha];

export function tipoCanchaToDb(tipo: TipoCancha): TipoCanchaDb {
  return TIPO_CANCHA_DB[tipo];
}

export function tipoCanchaToApi(tipo: TipoCanchaDb): TipoCancha {
  return tiposCancha.find((t) => TIPO_CANCHA_DB[t] === tipo)!;
}

export function toApiCancha<T extends { tipo: TipoCanchaDb }>(
  cancha: T
): Omit<T, "tipo"> & { tipo: TipoCancha } {
  return { ...cancha, tipo: tipoCanchaToApi(cancha.tipo) };
}

export function toApiComplejo<T extends Pick<Complejo, "latitud" | "longitud">>(complejo: T) {
  const { latitud, longitud, ...rest } = complejo;
  return {
    ...rest,
    lat: latitud === null ? null : Number(latitud),
    lng: longitud === null ? null : Number(longitud),
  };
}

type NombreUsuario = { nombre: string; apellido: string };

export const USUARIO_PUBLICO = {
  id: true,
  nombre: true,
  apellido: true,
  apodo: true,
} as const;

export const USUARIO_CONTACTO = {
  ...USUARIO_PUBLICO,
  email: true,
  telefono: true,
} as const;

export function toApiUsuario<T extends NombreUsuario>(usuario: T) {
  const { nombre, apellido, ...rest } = usuario;
  const [primerNombre, ...otros] = nombre.split(" ");
  return {
    ...rest,
    primerNombre,
    segundoNombre: otros.join(" ") || null,
    apellidos: apellido,
  };
}

export function nombreCompleto(usuario: NombreUsuario): string {
  return `${usuario.nombre} ${usuario.apellido}`.trim();
}

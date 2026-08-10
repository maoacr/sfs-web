import { z } from "zod";

// ─── Tipos de Cancha ─────────────────────────────────────────────────────────

export const tiposCancha = ["F5", "F6", "F7", "F8", "F9", "F11"] as const;
export type TipoCancha = (typeof tiposCancha)[number];

// ─── Estados ─────────────────────────────────────────────────────────────────

export const estadosReserva = [
  "PENDIENTE_PAGO",
  "CONFIRMADA",
  "COMPLETADA",
  "CANCELADA",
] as const;
export type EstadoReserva = (typeof estadosReserva)[number];

export const estadosPago = ["PENDIENTE", "APROBADO", "RECHAZADO", "REEMBOLSADO"] as const;

// ─── Auth ────────────────────────────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede exceder 72 caracteres (bcrypt)");

export const loginSchema = z.object({
  email: z.string().email("Email inválido").max(255),
  password: z.string().min(1, "Contraseña requerida"),
});

export const registerSchema = z.object({
  email: z.string().email("Email inválido").max(255),
  password: passwordSchema,
  primerNombre: z.string().min(1, "Nombre requerido").max(50),
  segundoNombre: z.string().max(50).optional(),
  apellidos: z.string().min(1, "Apellidos requeridos").max(100),
  apodo: z
    .string()
    .min(3, "El apodo debe tener al menos 3 caracteres")
    .max(30)
    .regex(/^[a-zA-Z0-9]+$/, "Solo letras y números")
    .optional(),
  codigoPais: z.string().max(5).default("+57"),
  telefono: z.string().max(15).optional(),
  role: z.enum(["OWNER", "PLAYER"]),
  instagram: z.string().max(30).optional(),
  tiktok: z.string().max(30).optional(),
  twitter: z.string().max(30).optional(),
  facebook: z.string().max(50).optional(),
});

export const updateProfileSchema = z.object({
  primerNombre: z.string().min(1).max(50).optional(),
  segundoNombre: z.string().max(50).optional(),
  apellidos: z.string().min(1).max(100).optional(),
  apodo: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9]+$/)
    .optional(),
  codigoPais: z.string().max(5).optional(),
  telefono: z.string().max(15).optional(),
  instagram: z.string().max(30).optional(),
  tiktok: z.string().max(30).optional(),
  twitter: z.string().max(30).optional(),
  facebook: z.string().max(50).optional(),
});

// ─── Complejos ───────────────────────────────────────────────────────────────

export const createComplejoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(100),
  tipoVia: z.string().max(20).default("Calle"),
  numeroVia: z.string().max(10).default(""),
  numeroSec: z.string().max(10).optional(),
  complemento: z.string().max(100).optional(),
  ciudad: z.string().max(100).default(""),
  departamento: z.string().max(100).default(""),
  descripcion: z.string().max(2000).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  telefono: z.string().max(20).optional(),
  email: z.string().email("Email inválido").max(255).optional().or(z.literal("")),
  instagram: z.string().max(30).optional(),
  tiktok: z.string().max(30).optional(),
  twitter: z.string().max(30).optional(),
  facebook: z.string().max(50).optional(),
});

export const updateComplejoSchema = createComplejoSchema.partial();

// ─── Canchas ─────────────────────────────────────────────────────────────────

export const createCanchaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(100),
  tipo: z.enum(tiposCancha, { message: "Tipo de cancha inválido" }),
  capacidad: z.number().int().min(2, "Capacidad mínima: 2").max(30),
  complejoId: z.string().uuid("ID de complejo inválido"),
  descripcion: z.string().max(2000).optional(),
  servicios: z.array(z.string()).max(20).default([]),
  duracionSlotMinutos: z
    .number()
    .int()
    .min(30, "Mínimo 30 minutos")
    .max(240, "Máximo 240 minutos")
    .default(60),
});

export const updateCanchaSchema = createCanchaSchema
  .omit({ complejoId: true })
  .partial();

// ─── Slots ───────────────────────────────────────────────────────────────────

export const createSlotSchema = z.object({
  diaSemana: z.number().int().min(0).max(6, "Día inválido (0=Domingo, 6=Sábado)"),
  horaApertura: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM requerido"),
  horaCierre: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM requerido"),
});

export const updateSlotSchema = createSlotSchema.partial();

// ─── Tarifas ─────────────────────────────────────────────────────────────────

export const createTarifaSchema = z.object({
  precioBase: z.number().min(0, "El precio no puede ser negativo"),
  diaSemana: z.number().int().min(0).max(6).optional(),
  horaInicio: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Formato HH:MM requerido")
    .optional(),
  horaFin: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Formato HH:MM requerido")
    .optional(),
  factor: z.number().min(0.01).max(10).default(1.0),
});

export const updateTarifaSchema = createTarifaSchema.partial();

// ─── Reservas ────────────────────────────────────────────────────────────────

export const createReservaSchema = z.object({
  canchaId: z.string().uuid("ID de cancha inválido"),
  slotInicio: z.string().datetime("Fecha de inicio inválida (ISO 8601)"),
  slotFin: z.string().datetime("Fecha de fin inválida (ISO 8601)"),
  playerId: z.string().uuid("ID de jugador inválido").optional(),
  playerNombre: z.string().optional(),
});

export const updateReservaSchema = z.object({
  estado: z.enum(estadosReserva).optional(),
});

// ─── Notificaciones ──────────────────────────────────────────────────────────

export const markNotificationSchema = z.object({
  id: z.string().uuid().optional(),
  todas: z.boolean().optional(),
});

// ─── Geocoding ───────────────────────────────────────────────────────────────

export const geocodingQuerySchema = z.object({
  q: z.string().min(1, "Query requerido"),
});

// ─── Disponibilidad ──────────────────────────────────────────────────────────

export const disponibilidadQuerySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD requerido"),
  tipo: z.enum(tiposCancha).optional(),
});

// ─── Paginación común ───────────────────────────────────────────────────────

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Utilidad ────────────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateCanchaInput = z.infer<typeof createCanchaSchema>;
export type UpdateCanchaInput = z.infer<typeof updateCanchaSchema>;
export type CreateComplejoInput = z.infer<typeof createComplejoSchema>;
export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type CreateTarifaInput = z.infer<typeof createTarifaSchema>;
export type CreateReservaInput = z.infer<typeof createReservaSchema>;

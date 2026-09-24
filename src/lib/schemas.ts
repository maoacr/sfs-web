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
  segundoNombre: z.string().max(50).nullish(),
  apellidos: z.string().min(1).max(100).optional(),
  apodo: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9]+$/)
    .nullish(),
  codigoPais: z.string().max(5).optional(),
  telefono: z.string().max(15).nullish(),
  instagram: z.string().max(30).nullish(),
  tiktok: z.string().max(30).nullish(),
  twitter: z.string().max(30).nullish(),
  facebook: z.string().max(50).nullish(),
});

// ─── Complejos ───────────────────────────────────────────────────────────────

// Zod 4 applies .default() values inside .partial(), so update schemas are
// derived from default-free field sets to avoid resetting omitted fields.

const complejoCampos = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(100),
  tipoVia: z.string().max(20),
  numeroVia: z.string().max(10),
  numeroSec: z.string().max(10).optional(),
  complemento: z.string().max(100).optional(),
  ciudad: z.string().max(100),
  departamento: z.string().max(100),
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

export const createComplejoSchema = complejoCampos.extend({
  tipoVia: complejoCampos.shape.tipoVia.default("Calle"),
  numeroVia: complejoCampos.shape.numeroVia.default(""),
  ciudad: complejoCampos.shape.ciudad.default(""),
  departamento: complejoCampos.shape.departamento.default(""),
});

export const updateComplejoSchema = complejoCampos.partial();

// ─── Canchas ─────────────────────────────────────────────────────────────────

const canchaCampos = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(100),
  tipo: z.enum(tiposCancha, { message: "Tipo de cancha inválido" }),
  capacidad: z.number().int().min(2, "Capacidad mínima: 2").max(30),
  complejoId: z.string().uuid("ID de complejo inválido"),
  descripcion: z.string().max(2000).optional(),
  servicios: z.array(z.string()).max(20),
  duracionSlotMinutos: z
    .number()
    .int()
    .min(30, "Mínimo 30 minutos")
    .max(240, "Máximo 240 minutos"),
});

export const createCanchaSchema = canchaCampos.extend({
  servicios: canchaCampos.shape.servicios.default([]),
  duracionSlotMinutos: canchaCampos.shape.duracionSlotMinutos.default(60),
});

export const updateCanchaSchema = canchaCampos.omit({ complejoId: true }).partial();

// ─── Slots ───────────────────────────────────────────────────────────────────

export const createSlotSchema = z.object({
  diaSemana: z.number().int().min(0).max(6, "Día inválido (0=Domingo, 6=Sábado)"),
  horaApertura: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM requerido"),
  horaCierre: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM requerido"),
});

export const updateSlotSchema = createSlotSchema.partial();

// ─── Tarifas ─────────────────────────────────────────────────────────────────

const tarifaCampos = z.object({
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
  factor: z.number().min(0.01).max(10),
});

export const createTarifaSchema = tarifaCampos.extend({
  factor: tarifaCampos.shape.factor.default(1.0),
});

export const updateTarifaSchema = tarifaCampos.partial();

// ─── Reservas ────────────────────────────────────────────────────────────────

export const createReservaSchema = z.object({
  canchaId: z.string().min(1, "ID de cancha requerido"),
  slotInicio: z.string().datetime("Fecha de inicio inválida (ISO 8601)"),
  slotFin: z.string().datetime("Fecha de fin inválida (ISO 8601)"),
  playerId: z.string().min(1).optional(),
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

// ─── Fase 1: Pagos, Partidos, Equipos ────────────────────────────────────────

export const crearPagoSchema = z.object({
  reservaId: z.string().uuid("ID de reserva inválido"),
  monto: z.number().min(1, "El monto debe ser mayor a 0"),
});

export const pagarSaldoSchema = z.object({
  monto: z.number().min(1, "El monto debe ser mayor a 0"),
});

export const confirmarPagoSchema = z.object({
  metodo: z.enum(["efectivo", "nequi", "transferencia"]).default("efectivo"),
});

export const cancelarReservaSchema = z.object({
  motivo: z.string().max(500).optional(),
});

export const crearPartidoSchema = z.object({
  reservaId: z.string().uuid("ID de reserva inválido"),
  equipoAId: z.string().uuid().optional(),
  equipoBId: z.string().uuid().optional(),
  jugadores: z.array(z.string().uuid()).max(30, "Máximo 30 jugadores").default([]),
});

export const crearEquipoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(100),
  fotoUrl: z.string().url("URL inválida").max(500).optional(),
  descripcion: z.string().max(500).optional(),
});

export const updateEquipoSchema = crearEquipoSchema.partial();

export const invitarMiembroSchema = z.object({
  userId: z.string().uuid("ID de usuario inválido"),
  rol: z.enum(["CAPITAN", "MIEMBRO"]).default("MIEMBRO"),
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
export type CrearPagoInput = z.infer<typeof crearPagoSchema>;
export type PagarSaldoInput = z.infer<typeof pagarSaldoSchema>;
export type CrearPartidoInput = z.infer<typeof crearPartidoSchema>;
export type CrearEquipoInput = z.infer<typeof crearEquipoSchema>;

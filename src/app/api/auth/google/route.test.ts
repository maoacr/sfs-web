// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests del endpoint que convierte una identidad de Google en una sesión de
 * SFS. `src/lib/google-auth.test.ts` cubre la REGLA (a qué fila corresponde la
 * persona); esto cubre la EJECUCIÓN: qué se consulta, qué se escribe, qué se
 * responde y, sobre todo, qué NO se toca cuando hay que rechazar.
 *
 * Son tests de caracterización: el código ya existía y funciona. Fijan el
 * comportamiento actual para que una regresión duela en vez de pasar
 * desapercibida — este es el único archivo de la feature donde una
 * equivocación entrega una cuenta ajena.
 */

const h = vi.hoisted(() => {
  // `jwt.ts` lee los secretos en module load, y los imports de ESM se hoistean
  // por encima de cualquier asignación normal. Esto corre antes que todo, así
  // que el route firma tokens de verdad en lugar de obligarnos a mockear jose.
  process.env.JWT_SECRET = "secreto-de-test-para-access";
  process.env.JWT_REFRESH_SECRET = "secreto-de-test-para-refresh";

  return {
    getUser: vi.fn(),
    enviarEmail: vi.fn(),
    findFirst: vi.fn(),
    valoresDelUpdate: vi.fn(),
    valoresDelInsert: vi.fn(),
    filaActualizada: vi.fn(),
    filaCreada: vi.fn(),
  };
});

// `eq` devuelve un objeto inspeccionable para que el mock de `findFirst` pueda
// responder según la COLUMNA consultada. El route lanza las dos búsquedas en
// paralelo; depender del orden en que se resuelven sería frágil.
vi.mock("drizzle-orm", () => ({
  eq: (columna: string, valor: unknown) => ({ columna, valor }),
}));

vi.mock("@sfs/db", () => ({
  db: {
    query: { usuarios: { findFirst: h.findFirst } },
    update: () => ({
      set: (valores: Record<string, unknown>) => {
        h.valoresDelUpdate(valores);
        return { where: () => ({ returning: h.filaActualizada }) };
      },
    }),
    insert: () => ({
      values: (valores: Record<string, unknown>) => {
        h.valoresDelInsert(valores);
        return { returning: h.filaCreada };
      },
    }),
  },
  usuarios: { id: "id", email: "email", googleSub: "google_sub" },
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ auth: { getUser: h.getUser } }),
}));

vi.mock("@/lib/email", () => ({ enviarEmail: h.enviarEmail }));

import { POST } from "./route";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ID_USUARIO = "11111111-1111-4111-8111-111111111111";
const SUB_GOOGLE = "google-sub-abc";

interface Fila {
  id: string;
  email: string;
  rol: string;
  passwordHash: string | null;
  nombre: string;
  apellido: string;
  apodo: string | null;
  avatarUrl: string | null;
}

function fila(cambios: Partial<Fila> = {}): Fila {
  return {
    id: ID_USUARIO,
    email: "jugador@gmail.com",
    rol: "PLAYER",
    passwordHash: "$2b$10$hash-viejo",
    nombre: "Mario",
    apellido: "Crespo",
    apodo: null,
    avatarUrl: null,
    ...cambios,
  };
}

const IDENTITY_DATA_OK: Record<string, unknown> = {
  email_verified: true,
  given_name: "Mario",
  family_name: "Crespo",
  avatar_url: "https://google.test/avatar.png",
};

function sesionDeGoogle(
  opciones: {
    email?: string | null;
    sub?: string;
    identityData?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    identities?: unknown[];
    extraUsuario?: Record<string, unknown>;
  } = {}
) {
  const {
    email = "jugador@gmail.com",
    sub = SUB_GOOGLE,
    identityData = IDENTITY_DATA_OK,
    metadata = {},
    identities,
    extraUsuario = {},
  } = opciones;

  return {
    data: {
      user: {
        id: "uuid-de-supabase",
        email,
        user_metadata: metadata,
        identities:
          identities ?? [{ provider: "google", id: sub, identity_data: identityData }],
        ...extraUsuario,
      },
    },
    error: null,
  };
}

/**
 * Cada test estrena IP. `AUTH_LOGIN` permite 5 requests por minuto y el
 * limitador keyea por `x-forwarded-for`: compartir la IP haría que un test
 * apague al siguiente, y el archivo pasaría a fallar según el orden.
 */
let contadorIp = 0;

function peticion(
  cuerpo: unknown = { accessToken: "token-que-emitió-supabase" },
  ipFija?: string
) {
  contadorIp += 1;
  return new NextRequest("http://localhost/api/auth/google", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ipFija ?? `10.0.0.${contadorIp}`,
    },
    body: JSON.stringify(cuerpo),
  });
}

function registros(encontradas: { porSub?: Fila | null; porEmail?: Fila | null }) {
  const { porSub = null, porEmail = null } = encontradas;
  h.findFirst.mockImplementation(async (args: { where: { columna: string } }) => {
    if (args.where.columna === "google_sub") return porSub;
    if (args.where.columna === "email") return porEmail;
    return null;
  });
}

const noEscribióNada = () => {
  expect(h.valoresDelUpdate).not.toHaveBeenCalled();
  expect(h.valoresDelInsert).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.clearAllMocks();
  h.getUser.mockResolvedValue(sesionDeGoogle());
  h.findFirst.mockResolvedValue(null);
  h.filaActualizada.mockResolvedValue([fila()]);
  h.filaCreada.mockResolvedValue([fila({ passwordHash: null })]);
  h.enviarEmail.mockResolvedValue(undefined);
});

// ─── Rechazos ────────────────────────────────────────────────────────────────

describe("POST /api/auth/google — rechazos", () => {
  it("corta un body sin accessToken antes de llegar a la base", async () => {
    const res = await POST(peticion({}));

    expect(res.status).toBe(400);
    expect(h.getUser).not.toHaveBeenCalled();
    expect(h.findFirst).not.toHaveBeenCalled();
  });

  it("responde 401 si Supabase no reconoce el token", async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: { message: "jwt expired" } });

    const res = await POST(peticion());

    expect(res.status).toBe(401);
    noEscribióNada();
  });

  it("responde 400 si la sesión no viene de Google", async () => {
    h.getUser.mockResolvedValue(
      sesionDeGoogle({ identities: [{ provider: "github", id: "gh-1", identity_data: {} }] })
    );

    const res = await POST(peticion());

    expect(res.status).toBe(400);
    noEscribióNada();
  });

  it("responde 400 si Google no compartió un email", async () => {
    h.getUser.mockResolvedValue(sesionDeGoogle({ email: null }));

    const res = await POST(peticion());

    expect(res.status).toBe(400);
    noEscribióNada();
  });

  it("rechaza sin escribir nada si Google no verificó el email", async () => {
    h.getUser.mockResolvedValue(
      sesionDeGoogle({ identityData: { email_verified: false, given_name: "Mario" } })
    );
    registros({ porEmail: fila() });

    const res = await POST(peticion());

    expect(res.status).toBe(403);
    // Este es el caso que convierte el vínculo por email en una apropiación de
    // cuenta: existe una fila con ese email y NO se la toca.
    noEscribióNada();
  });

  it("no acepta email_confirmed_at de Supabase como prueba de verificación", async () => {
    // Supabase setea `email_confirmed_at` por su cuenta. Caer a ese campo
    // saltearía nuestra propia regla, así que sólo cuenta el claim de Google.
    h.getUser.mockResolvedValue(
      sesionDeGoogle({
        identityData: { given_name: "Mario" },
        extraUsuario: { email_confirmed_at: "2026-01-01T00:00:00Z" },
      })
    );

    const res = await POST(peticion());

    expect(res.status).toBe(403);
    noEscribióNada();
  });

  it("rechaza una cuenta ADMIN, igual que el login con contraseña", async () => {
    registros({ porEmail: fila({ rol: "ADMIN" }) });

    const res = await POST(peticion());

    expect(res.status).toBe(403);
    noEscribióNada();
  });
});

// ─── Caminos felices ─────────────────────────────────────────────────────────

describe("POST /api/auth/google — vínculo y alta", () => {
  it("busca por google_sub Y por email en la misma request", async () => {
    registros({ porSub: fila() });

    await POST(peticion());

    const columnas = h.findFirst.mock.calls.map(
      (llamada) => (llamada[0] as { where: { columna: string } }).where.columna
    );
    expect(columnas).toContain("google_sub");
    expect(columnas).toContain("email");
  });

  it("entra sin escribir nada si el sub ya estaba vinculado", async () => {
    registros({ porSub: fila() });

    const res = await POST(peticion());

    expect(res.status).toBe(200);
    noEscribióNada();
  });

  it("vincula por email, anula la contraseña anterior y avisa por mail", async () => {
    registros({ porEmail: fila({ passwordHash: "$2b$10$hash-del-atacante" }) });

    const res = await POST(peticion());

    expect(res.status).toBe(200);
    expect(h.valoresDelUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ googleSub: SUB_GOOGLE, passwordHash: null })
    );
    expect(h.enviarEmail).toHaveBeenCalledWith(
      "jugador@gmail.com",
      expect.stringContaining("Google"),
      expect.stringContaining("anulada")
    );
  });

  it("no anula ni avisa si la cuenta ya entraba sólo por Google", async () => {
    registros({ porEmail: fila({ passwordHash: null }) });

    const res = await POST(peticion());

    expect(res.status).toBe(200);
    expect(h.valoresDelUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ passwordHash: null })
    );
    expect(h.enviarEmail).not.toHaveBeenCalled();
  });

  it("no pisa el avatar que el usuario ya había elegido", async () => {
    registros({ porEmail: fila({ avatarUrl: "https://sfs.test/mi-foto.png" }) });

    await POST(peticion());

    expect(h.valoresDelUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ avatarUrl: expect.anything() })
    );
  });

  it("crea la cuenta sin contraseña y con el nombre que manda Google", async () => {
    const res = await POST(peticion());

    expect(res.status).toBe(200);
    expect(h.valoresDelInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "jugador@gmail.com",
        googleSub: SUB_GOOGLE,
        passwordHash: null,
        nombre: "Mario",
        apellido: "Crespo",
      })
    );
  });

  it("parte el nombre completo cuando Google no manda given_name", async () => {
    h.getUser.mockResolvedValue(
      sesionDeGoogle({
        identityData: { email_verified: true, full_name: "Mario Alejandro Crespo" },
      })
    );

    await POST(peticion());

    expect(h.valoresDelInsert).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Mario", apellido: "Alejandro Crespo" })
    );
  });
});

// ─── Lo que el cliente NO puede decidir ──────────────────────────────────────

describe("POST /api/auth/google — superficie de ataque", () => {
  /**
   * Aserción end-to-end de que la cuenta creada corresponde a la identidad del
   * TOKEN y no a la que mandó el cliente.
   *
   * Quién lo garantiza en realidad es `googleAuthSchema`, que descarta toda
   * clave que no sea `accessToken` antes de que el handler la vea — por eso
   * `schemas.test.ts` tiene un test dedicado a ese descarte. Verificado con
   * mutación: este test solo falla si se rompen LAS DOS capas (schema laxo y
   * route leyendo del body). Son dos guardias, y cada uno tiene el suyo.
   */
  it("la cuenta creada sale del token, no de lo que mandó el cliente", async () => {
    const res = await POST(
      peticion({
        accessToken: "token-que-emitió-supabase",
        // Un cliente malicioso intentando entrar como otra persona.
        email: "victima@gmail.com",
        sub: "sub-de-la-victima",
        rol: "ADMIN",
      })
    );

    expect(res.status).toBe(200);
    expect(h.valoresDelInsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jugador@gmail.com", googleSub: SUB_GOOGLE })
    );
  });

  it("emite las cookies de sesión de SFS con tokens firmados de verdad", async () => {
    const res = await POST(peticion());

    const acceso = res.cookies.get("sfs_token")?.value;
    const refresh = res.cookies.get("sfs_refresh")?.value;

    expect(acceso?.split(".")).toHaveLength(3);
    expect(refresh?.split(".")).toHaveLength(3);
    expect(res.cookies.get("csrf_token")?.value).toBeTruthy();
  });

  it("corta con 429 cuando se pasa del rate limit de login", async () => {
    const ip = "203.0.113.9";
    const estados: number[] = [];

    for (let intento = 0; intento < 6; intento += 1) {
      const res = await POST(peticion(undefined, ip));
      estados.push(res.status);
    }

    expect(estados.slice(0, 5)).not.toContain(429);
    expect(estados[5]).toBe(429);
  });
});

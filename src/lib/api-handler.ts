import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { AuthError, getAuthUser } from "@/lib/auth-api";
import {
  checkRateLimit,
  getRateLimitKey,
  setRateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { validateCsrf } from "@/lib/csrf";
import type { RateLimitConfig } from "@/lib/rate-limit";

// Re-export for convenience
export type { RateLimitConfig };

/**
 * Tipos: lo que recibe cada handler
 */
export interface ApiContext {
  user?: {
    sub: string;
    email: string;
    role: "OWNER" | "PLAYER";
  };
  /** Segmentos dinámicos de la ruta, p. ej. `{ id }` en `/api/canchas/[id]`. */
  params: Record<string, string>;
}

/**
 * Opciones del wrapper
 */
export interface ApiHandlerOptions<TBody = unknown, TQuery = Record<string, string>> {
  /** Requerir autenticación? (default: false) */
  requireAuth?: boolean;
  /** Rol requerido si requireAuth es true */
  requiredRole?: "OWNER" | "PLAYER";
  /** Schema de Zod para validar el body (POST/PUT/PATCH) */
  bodySchema?: ZodSchema<TBody>;
  /** Schema de Zod para validar query params */
  querySchema?: ZodSchema<TQuery>;
  /** Config de rate limit (usa DEFAULT si no se especifica) */
  rateLimit?: RateLimitConfig;
  /** Requerir CSRF token para unsafe methods? (default: true) */
  requireCsrf?: boolean;
}

/**
 * Wrapper unificado para API routes.
 *
 * Aplica en orden:
 * 1. Rate limiting
 * 2. CSRF validation (unsafe methods)
 * 3. Auth (si requireAuth)
 * 4. Input validation (body + query schemas)
 * 5. Handler execution
 * 6. Error handling
 *
 * Tenant isolation is explicit: each query filters by tenantId/ownership.
 */
export function apiHandler<TBody = unknown, TQuery = Record<string, string>>(
  handler: (
    request: NextRequest,
    context: ApiContext,
    validated: { body?: TBody; query?: TQuery }
  ) => Promise<NextResponse>,
  options: ApiHandlerOptions<TBody, TQuery> = {}
) {
  return async (
    request: NextRequest,
    routeContext?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    // ─── 1. Rate Limiting ─────────────────────────────────────────────────

    const rateKey = getRateLimitKey(request);
    const rateConfig = options.rateLimit || RATE_LIMITS.DEFAULT;

    const rateResult = checkRateLimit(rateKey, rateConfig);
    if (!rateResult.allowed) {
      return setRateLimitHeaders(
        NextResponse.json(
          { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
          { status: 429 }
        ),
        rateResult.remaining,
        rateResult.resetAt
      );
    }

    // ─── 2. CSRF ──────────────────────────────────────────────────────────

    const csrfEnabled = options.requireCsrf !== false;
    if (csrfEnabled && !validateCsrf(request)) {
      return NextResponse.json(
        { error: "CSRF token inválido o faltante" },
        { status: 403 }
      );
    }

    // ─── 3. Auth ──────────────────────────────────────────────────────────

    let user: ApiContext["user"] | undefined;

    if (options.requireAuth) {
      try {
        user = await getAuthUser(request);

        if (options.requiredRole && user.role !== options.requiredRole) {
          return NextResponse.json(
            { error: "No tienes permisos para esta acción" },
            { status: 403 }
          );
        }
      } catch (error) {
        if (error instanceof AuthError) {
          return NextResponse.json(
            { error: error.message },
            { status: error.status }
          );
        }
        throw error;
      }
    }

    // ─── 4. Input Validation ──────────────────────────────────────────────

    let body: TBody | undefined;
    let query: TQuery | undefined;

    try {
      // Query params
      if (options.querySchema) {
        const url = new URL(request.url);
        const raw: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
          raw[key] = value;
        });
        query = options.querySchema.parse(raw);
      }

      // Body
      if (options.bodySchema) {
        const rawBody = await request.json();
        body = options.bodySchema.parse(rawBody);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        }));
        return NextResponse.json(
          { error: "Datos inválidos", details: errors },
          { status: 400 }
        );
      }
      throw error;
    }

    // ─── 5. Execute Handler ───────────────────────────────────────────────

    try {
      const params = (await routeContext?.params) ?? {};
      const response = await handler(request, { user, params }, { body, query });

      // Añadir headers de rate limit a la respuesta
      return setRateLimitHeaders(
        response,
        rateResult.remaining,
        rateResult.resetAt
      );
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status }
        );
      }
      console.error("API Handler error:", error);
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      );
    }
  };
}

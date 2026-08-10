import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";

/**
 * CSRF protection via double-submit cookie pattern.
 *
 * - GET/HEAD/OPTIONS: no requiere token
 * - POST/PUT/PATCH/DELETE: requiere header X-CSRF-Token que coincida con cookie csrf_token
 */

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "X-CSRF-Token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function generateCsrfToken(): string {
  return nanoid(32);
}

export function setCsrfCookie(response: NextResponse): void {
  const token = generateCsrfToken();
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false, // debe ser leíble por JS para enviarlo como header
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 horas
  });
  // También seteamos el header para que el cliente lo cachee
  response.headers.set("X-CSRF-Token", token);
}

export function validateCsrf(request: NextRequest): boolean {
  const method = request.method.toUpperCase();

  // Safe methods no requieren CSRF
  if (SAFE_METHODS.has(method)) return true;

  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) return false;

  return cookieToken === headerToken;
}

/**
 * Middleware helper — usar en Next.js middleware para rutas API.
 * Si falta el header CSRF en unsafe methods, retorna 403.
 */
export function csrfCheck(request: NextRequest): NextResponse | null {
  if (!validateCsrf(request)) {
    return NextResponse.json(
      { error: "CSRF token inválido o faltante" },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Añade el CSRF token a una response (llamar en GET /api/auth/me o similar)
 */
export function addCsrfToken(response: NextResponse): NextResponse {
  setCsrfCookie(response);
  return response;
}

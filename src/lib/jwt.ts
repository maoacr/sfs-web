import { SignJWT } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET!
);

const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES = "7d";

interface TokenPayload {
  sub: string; // user.id
  email: string;
  role: "OWNER" | "PLAYER";
}

export async function signAccessToken(payload: TokenPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_EXPIRES)
    .sign(SECRET);
}

export async function signRefreshToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXPIRES)
    .sign(REFRESH_SECRET);
}

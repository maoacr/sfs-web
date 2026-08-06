import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

const OWNER_ROUTES = "/owner/dashboard";
const PLAYER_ROUTES = "/player/buscar";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("sfs_token")?.value;

  if (!token) {
    redirect("/auth/login");
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role as string;

    redirect(role === "OWNER" ? OWNER_ROUTES : PLAYER_ROUTES);
  } catch {
    redirect("/auth/login");
  }
}

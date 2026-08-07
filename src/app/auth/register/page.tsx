import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { AuthForm } from "@/components/auth-form";

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("sfs_token")?.value;

  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
      const { payload } = await jwtVerify(token, secret);
      const role = payload.role as string;
      redirect(role === "OWNER" ? "/owner/dashboard" : "/player/buscar");
    } catch {
      // Token inválido, mostrar registro
    }
  }

  return <AuthForm mode="register" />;
}

import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.redirect(new URL("/auth/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));

  response.cookies.delete("sfs_token");
  response.cookies.delete("sfs_refresh");

  return response;
}

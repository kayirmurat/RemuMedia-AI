import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "remumedia_auth";

export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  // Şifre ayarlanmadıysa dashboard bilinçli olarak açık kalır (opsiyonel koruma).
  if (!password) return NextResponse.next();

  const pathname = req.nextUrl.pathname;
  if (pathname === "/login" || pathname === "/api/auth/login") {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (cookie === password) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

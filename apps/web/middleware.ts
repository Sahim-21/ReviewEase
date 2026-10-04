import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE } from "@/lib/authCookie";

const PROTECTED_PAGES = ["/admin", "/dashboard", "/owner"];

function hasToken(request: NextRequest): boolean {
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  return Boolean(cookie && cookie.length > 0);
}

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return NextResponse.next();
  }

  if (pathname === "/" || pathname.startsWith("/r/")) {
    return NextResponse.next();
  }

  if ((pathname === "/api/admin" || pathname.startsWith("/api/admin/")) && !hasToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isProtectedPage(pathname) && !hasToken(request)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/owner",
    "/owner/:path*",
    "/api/admin",
    "/api/admin/:path*",
  ],
};

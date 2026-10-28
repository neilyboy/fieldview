import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "fv_session";
const PUBLIC_PAGE = ["/login", "/s/", "/print/"];
const PUBLIC_API = ["/api/auth/login", "/api/share/", "/api/uploads/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isPublic = (isApi ? PUBLIC_API : PUBLIC_PAGE).some((p) => pathname.startsWith(p));
  if (isPublic || pathname.startsWith("/_next") || pathname.startsWith("/sw.js") || pathname === "/manifest.json" || pathname === "/icon.svg" || pathname === "/favicon.ico") {
    return NextResponse.next();
  }
  const token = req.cookies.get(COOKIE)?.value;
  let ok = false;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET!));
      ok = true;
    } catch { ok = false; }
  }
  if (ok) return NextResponse.next();
  if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|icon.svg|manifest.json).*)"] };

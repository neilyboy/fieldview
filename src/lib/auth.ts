import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { scryptSync, timingSafeEqual, randomBytes } from "crypto";

const COOKIE = "fv_session";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = scryptSync(pw, salt, 64);
  return timingSafeEqual(check, Buffer.from(hash, "hex"));
}

export async function createSession(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export async function isAuthed(): Promise<boolean> {
  const store = await cookies();
  const t = store.get(COOKIE)?.value;
  return t ? verifySession(t) : false;
}

export async function requireAuth(): Promise<void> {
  if (!(await isAuthed())) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
}

export function sessionCookie(token: string) {
  return { name: COOKIE, value: token, httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 };
}

// Internal key so server-side Puppeteer can render print views without a session.
export function printKey(siteId: string): string {
  return scryptSync(`${process.env.SESSION_SECRET}:${siteId}`, "fieldview-print", 32).toString("hex").slice(0, 32);
}

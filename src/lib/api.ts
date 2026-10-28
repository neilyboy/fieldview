import { NextResponse } from "next/server";
import { isAuthed } from "./auth";

export function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function guard(): Promise<NextResponse | null> {
  return (await isAuthed()) ? null : err("Unauthorized", 401);
}

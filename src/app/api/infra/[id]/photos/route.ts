import { NextRequest, NextResponse } from "next/server";
import { guard, err } from "@/lib/api";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/uploads";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await guard()) return err("Unauthorized", 401);
  const { id } = await params;
  const item = await db.infraItem.findUnique({ where: { id } });
  if (!item) return err("Not found", 404);
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => typeof f === "object" && "arrayBuffer" in f && (f as File).size > 0);
  const caption = (form.get("caption") as string) || null;
  if (!files.length) return err("No files");
  const out = [];
  for (const file of files) {
    const saved = await saveUpload(file);
    out.push(await db.photo.create({ data: { infraId: id, type: "cablePath", caption, ...saved } }));
  }
  return NextResponse.json(out, { status: 201 });
}

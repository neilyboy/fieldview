import { NextRequest, NextResponse } from "next/server";
import { guard, err } from "@/lib/api";
import { db } from "@/lib/db";
import { saveUpload, deleteUpload } from "@/lib/uploads";

export async function POST(req: NextRequest) {
  if (await guard()) return err("Unauthorized", 401);
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file || !file.type.startsWith("image/")) return err("Upload an image file");
  const prev = await db.setting.findUnique({ where: { id: 1 } });
  const saved = await saveUpload(file);
  const s = await db.setting.upsert({ where: { id: 1 }, update: { logoPath: saved.filePath }, create: { id: 1, logoPath: saved.filePath } });
  if (prev?.logoPath) await deleteUpload(prev.logoPath);
  return NextResponse.json({ logoPath: s.logoPath });
}

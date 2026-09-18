import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { utcDayBucket } from "../../../lib/questions";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { osis?: unknown } | null;
  const osis = typeof body?.osis === "string" ? body.osis.trim() : "";
  if (!osis) return NextResponse.json({ error: "osis_required" }, { status: 400 });

  const verse = await db.verse.findUnique({ where: { osis }, select: { passageId: true } });
  if (!verse) return NextResponse.json({ error: "verse_not_found" }, { status: 404 });

  const bucket = utcDayBucket();
  await db.passagePopularitySignal.upsert({
    where: { passageId_bucket: { passageId: verse.passageId, bucket } },
    update: { count: { increment: 1 } },
    create: { passageId: verse.passageId, bucket, count: 1 },
  });

  return NextResponse.json({ ok: true });
}

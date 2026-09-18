import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { normalizeQuestion, utcDayBucket } from "../../../lib/questions";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { text?: unknown; osis?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const osis = typeof body?.osis === "string" ? body.osis.trim() : "";

  if (text.length < 3 || text.length > 2000) {
    return NextResponse.json({ error: "question_text_invalid" }, { status: 400 });
  }

  const normalizedKey = normalizeQuestion(text);
  if (!normalizedKey) {
    return NextResponse.json({ error: "question_text_invalid" }, { status: 400 });
  }

  const question = await db.question.upsert({
    where: { normalizedKey },
    update: {},
    create: { canonicalText: text, normalizedKey },
  });

  let passageId: string | null = null;
  if (osis) {
    const verse = await db.verse.findUnique({
      where: { osis },
      select: { passageId: true },
    });
    passageId = verse?.passageId ?? null;

    if (passageId) {
      await db.questionPassage.upsert({
        where: { questionId_passageId: { questionId: question.id, passageId } },
        update: { relevance: 1 },
        create: { questionId: question.id, passageId, relevance: 1 },
      });
    }
  }

  const bucket = utcDayBucket();
  await db.popularitySignal.upsert({
    where: { questionId_bucket: { questionId: question.id, bucket } },
    update: { count: { increment: 1 } },
    create: { questionId: question.id, bucket, count: 1 },
  });

  return NextResponse.json({
    id: question.id,
    canonicalText: question.canonicalText,
    normalizedKey,
    passageId,
  });
}

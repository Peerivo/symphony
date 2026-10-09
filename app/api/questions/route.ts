import { db } from "../../../lib/db";
import { normalizeQuestion, utcDayBucket } from "../../../lib/questions";
import { publicPassageWhere } from "../../../lib/publication";
import { IntakeError, intakeFailure, readIntake, takeBudget } from "../../../lib/intake";

export async function POST(request: Request) {
  try {
    if (process.env.QUESTION_INTAKE_ENABLED !== "true") throw new IntakeError(503, "intake_disabled");
    const body = await readIntake(request);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const osis = typeof body.osis === "string" ? body.osis.trim() : "";
    if (text.length < 3 || text.length > 2000 || !normalizeQuestion(text)) throw new IntakeError(400, "question_text_invalid");
    if (body.consent !== true) throw new IntakeError(400, "review_consent_required");
    if (!osis || osis.length > 80) throw new IntakeError(400, "osis_required");
    await takeBudget("questions", 30);
    const verse = await db.verse.findFirst({ where: { osis, passage: { is: publicPassageWhere } }, select: { passageId: true } });
    if (!verse) throw new IntakeError(404, "verse_not_found");
    await db.$transaction(async tx => {
      const question = await tx.question.upsert({
        where: { normalizedKey: normalizeQuestion(text) }, update: {},
        create: { canonicalText: text, normalizedKey: normalizeQuestion(text), reviewStatus: "DRAFT" },
      });
      // Anonymous input cannot change published editorial relationships.
      if (question.reviewStatus === "DRAFT") await tx.questionPassage.upsert({
        where: { questionId_passageId: { questionId: question.id, passageId: verse.passageId } },
        update: {}, create: { questionId: question.id, passageId: verse.passageId, relevance: 0 },
      });
      const bucket = utcDayBucket();
      await tx.popularitySignal.upsert({
        where: { questionId_bucket: { questionId: question.id, bucket } },
        update: { count: { increment: 1 } }, create: { questionId: question.id, bucket, count: 1 },
      });
    });
    // Do not reveal whether another visitor submitted this private question.
    return Response.json({ accepted: true }, { status: 202, headers: { "cache-control": "no-store" } });
  } catch (error) { return intakeFailure(error); }
}

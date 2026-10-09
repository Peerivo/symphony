import { db } from "../../../lib/db";
import { utcDayBucket } from "../../../lib/questions";
import { publicPassageWhere } from "../../../lib/publication";
import { IntakeError, intakeFailure, readIntake, takeBudget } from "../../../lib/intake";

export async function POST(request: Request) {
  try {
    const body = await readIntake(request);
    const osis = typeof body.osis === "string" ? body.osis.trim() : "";
    if (!osis || osis.length > 80) throw new IntakeError(400, "osis_required");
    await takeBudget("views", 600);
    const verse = await db.verse.findFirst({ where: { osis, passage: { is: publicPassageWhere } }, select: { passageId: true } });
    if (!verse) throw new IntakeError(404, "verse_not_found");
    const bucket = utcDayBucket();
    await db.passagePopularitySignal.upsert({
      where: { passageId_bucket: { passageId: verse.passageId, bucket } },
      update: { count: { increment: 1 } }, create: { passageId: verse.passageId, bucket, count: 1 },
    });
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return intakeFailure(error); }
}

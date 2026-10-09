import { db } from "../../../lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await db.$queryRaw`SELECT "reviewStatus" FROM "Question" LIMIT 1`;
    await db.$queryRaw`SELECT "key" FROM "IntakeBudget" LIMIT 1`;
    return Response.json({ status: "ok", revision: process.env.RELEASE_SHA || "development" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

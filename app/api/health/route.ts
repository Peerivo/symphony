import { db } from "../../../lib/db";
import { readinessResponse } from "../../../lib/readiness";
export const dynamic = "force-dynamic";
// Compatibility endpoint: health is readiness; /api/live is process liveness.
export async function GET() {
  return readinessResponse(db);
}

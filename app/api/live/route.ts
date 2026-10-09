import { releaseIdentity } from "../../../lib/readiness";

export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ status: "alive", revision: releaseIdentity().revision }, {
    headers: { "cache-control": "no-store" },
  });
}

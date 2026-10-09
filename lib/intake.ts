import { db } from "./db";

export class IntakeError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}
export async function readIntake(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (!origin || origin !== expected || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new IntakeError(403, "origin_not_allowed");
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new IntakeError(415, "json_required");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new IntakeError(400, "invalid_json");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 12_288) { await reader.cancel(); throw new IntakeError(413, "body_too_large"); }
    chunks.push(value);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new IntakeError(400, "invalid_json"); }
}
export async function takeBudget(key: "questions" | "views", limit: number) {
  // Database-wide cap works across replicas without identifying visitors.
  const bucket = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const rows = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "IntakeBudget" ("key", "bucket", "count") VALUES (${key}, ${bucket}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "bucket" = EXCLUDED."bucket",
      "count" = CASE WHEN "IntakeBudget"."bucket" = EXCLUDED."bucket"
                     THEN "IntakeBudget"."count" + 1 ELSE 1 END
    WHERE "IntakeBudget"."bucket" <> EXCLUDED."bucket" OR "IntakeBudget"."count" < ${limit}
    RETURNING "count"`;
  if (!rows.length) throw new IntakeError(429, "rate_limited");
}
export function intakeFailure(error: unknown) {
  const known = error instanceof IntakeError;
  return Response.json({ error: known ? error.code : "temporarily_unavailable" }, {
    status: known ? error.status : 503,
    headers: { "cache-control": "no-store", ...(known && error.status === 429 ? { "retry-after": "60" } : {}) },
  });
}

import { Prisma, type PrismaClient } from "@prisma/client";

export const expectedMigrations = [
  { name: "20260918153000_m1_corpus", checksum: "1afa72d3b4ed993124651d69ac83c87e100fff8e8793d5f22aec94aef4303637" },
  { name: "20261009084300_publication_gate", checksum: "1a56d4fb5fd96984b64ebad60a991d71704b824e912facf0d47ed6ece06e8ec4" },
] as const;

type MigrationRow = { migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null };
export type ColumnRow = { table_name: string; column_name: string; type_name: string; not_null: boolean };

export function releaseIdentity(built = process.env.APP_REVISION || "development", configured = process.env.RELEASE_SHA) {
  return { revision: built, valid: /^[0-9a-f]{40}$/.test(built) && (!configured || configured === built) };
}

export function migrationsMatch(rows: MigrationRow[]) {
  const active = rows.filter(row => row.rolled_back_at === null);
  return active.length === expectedMigrations.length && expectedMigrations.every(expected =>
    active.some(row => row.migration_name === expected.name && row.checksum === expected.checksum && row.finished_at !== null));
}

const scalarTypes: Record<string, string> = { String: "text", Int: "int4", Float: "float8", Boolean: "bool", DateTime: "timestamp", Json: "jsonb", BigInt: "int8", Decimal: "numeric", Bytes: "bytea" };
export function schemaMatches(rows: ColumnRow[]) {
  const columns = new Map(rows.map(row => [row.table_name + "." + row.column_name, row]));
  return Prisma.dmmf.datamodel.models.every(model => model.fields.filter(field => field.kind !== "object").every(field => {
    const column = columns.get((model.dbName || model.name) + "." + (field.dbName || field.name));
    const type = field.kind === "enum" ? field.type : scalarTypes[field.type];
    return !!column && column.type_name === (field.isList ? "_" + type : type) && column.not_null === field.isRequired;
  }));
}

export async function readinessResponse(client: PrismaClient) {
  const identity = releaseIdentity();
  const unavailable = () => Response.json({ status: "unavailable", revision: identity.revision }, {
    status: 503, headers: { "cache-control": "no-store" },
  });
  // A production build must identify itself independently of runtime env.
  if (!identity.valid) return unavailable();
  try {
    const ready = await client.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
      const migrations = await tx.$queryRaw<MigrationRow[]>`
        SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations`;
      if (!migrationsMatch(migrations)) return false;
      const columns = await tx.$queryRaw<ColumnRow[]>`
        SELECT c.relname AS table_name, a.attname AS column_name, t.typname AS type_name, a.attnotnull AS not_null
        FROM pg_catalog.pg_attribute a
        JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped`;
      if (!schemaMatches(columns)) return false;
      // Exercise reading credentials, rather than only the catalog connection.
      await tx.$queryRaw`SELECT p."id", v."osis", s."rightsStatus" FROM "Passage" p
        JOIN "Verse" v ON v."passageId" = p."id" JOIN "Source" s ON s."id" = p."sourceId" LIMIT 1`;
      await tx.$queryRaw`SELECT "reviewStatus" FROM "Question" LIMIT 1`;
      return true;
    }, { timeout: 5000 });
    if (!ready) return unavailable();
    return Response.json({ status: "ok", revision: identity.revision }, { headers: { "cache-control": "no-store" } });
  } catch {
    // Never return/log SQL, raw database errors or a connection string.
    return unavailable();
  }
}

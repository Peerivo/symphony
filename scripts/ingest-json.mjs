import fs from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { orderPassages, validateManifest } from "./ingestion-contract.mjs";

export { validateManifest } from "./ingestion-contract.mjs";

export class IngestionConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "IngestionConflictError";
  }
}

function sameValue(actual, expected) {
  if (actual instanceof Date || expected instanceof Date) return new Date(actual).getTime() === new Date(expected).getTime();
  return actual === expected;
}
function assertSame(existing, data, label) {
  for (const [field, value] of Object.entries(data)) {
    if (!sameValue(existing[field], value)) {
      throw new IngestionConflictError(`${label}: ${field} conflicts with an existing record; use explicit reviewed versioning instead of overwriting provenance`);
    }
  }
}
async function immutableRecord(model, where, data, label, { compare = data, createOnly = {} } = {}) {
  const existing = await model.findUnique({ where });
  if (existing) {
    assertSame(existing, compare, label);
    return existing;
  }
  return model.create({ data: { ...data, ...createOnly } });
}
function importTime(now) {
  const date = new Date(now());
  if (!Number.isFinite(date.getTime())) throw new Error("The ingestion clock returned an invalid timestamp");
  return date;
}

/**
 * Append-only normalization. Every successful attempt has an immutable manifest
 * audit in Submission.notes and its own IngestionRun. The original Source
 * snapshot is retained; later retrieval/parser metadata belongs to the new run.
 * The current schema cannot safely revise published passages or rights evidence,
 * so conflicting stable identities fail closed until explicit versioning exists.
 *
 * Inject a Prisma-compatible client (and optionally a clock) for integration tests.
 */
export async function importManifest(prisma, input, { now = () => new Date() } = {}) {
  const manifest = validateManifest(input);
  const snapshot = JSON.stringify(manifest);
  const manifestChecksum = `sha256:${createHash("sha256").update(snapshot).digest("hex")}`;
  const startedAt = importTime(now);

  const ingest = async (tx) => {
    const { source: src, corpus: c } = manifest;
    const sourceData = { ...src, fetchedAt: new Date(src.fetchedAt) };
    const { fetchedAt: _fetchedAt, checksum: _checksum, parserVersion: _parserVersion, ...sourceIdentity } = sourceData;
    const source = await immutableRecord(tx.source, { canonicalUrl: src.canonicalUrl }, sourceData, `Source ${src.canonicalUrl}`, { compare: sourceIdentity });
    if (!source.fetchedAt || !/^sha256:[a-fA-F0-9]{64}$/.test(source.checksum ?? "") || !source.parserVersion?.trim()) {
      throw new IngestionConflictError("Existing Source has incomplete provenance; explicit reconciliation is required");
    }
    const tradition = c.tradition
      ? await immutableRecord(tx.tradition, { slug: c.tradition.slug }, c.tradition, `Tradition ${c.tradition.slug}`)
      : null;
    const corpus = await immutableRecord(tx.corpus, { slug: c.slug }, {
      slug: c.slug, name: c.name, kind: c.kind, language: c.language,
      sourceId: source.id, traditionId: tradition?.id ?? null,
    }, `Corpus ${c.slug}`);

    let passageCount = 0;
    for (const w of manifest.works) {
      const author = w.author ? await immutableRecord(tx.person, { slug: w.author.slug }, {
        ...w.author, traditionId: tradition?.id ?? null,
      }, `Author ${w.author.slug}`) : null;
      const work = await immutableRecord(tx.work, { importKey: w.key }, {
        importKey: w.key, corpusId: corpus.id, sourceId: source.id,
        title: w.title, authorId: author?.id ?? null,
        language: w.language, edition: w.edition, publishedYear: w.publishedYear,
      }, `Work ${w.key}`);

      const byKey = new Map();
      for (const p of orderPassages(w.passages)) {
        const passage = await immutableRecord(tx.passage, { importKey: p.key }, {
          importKey: p.key, workId: work.id, sourceId: source.id,
          parentId: p.parentKey == null ? null : byKey.get(p.parentKey),
          ordinal: p.ordinal, kind: p.kind, heading: p.heading, text: p.text,
          locator: p.locator, language: p.language,
        }, `Passage ${p.key}`, { createOnly: { reviewStatus: "DRAFT" } });
        byKey.set(p.key, passage.id);
        passageCount++;

        // Both unique constraints matter: neither OSIS nor passage ownership can
        // be rebound, including when a new edition uses an existing OSIS index.
        const currentVerse = await tx.verse.findUnique({ where: { passageId: passage.id } });
        if (p.verse) {
          const verseData = { ...p.verse, passageId: passage.id };
          if (currentVerse) assertSame(currentVerse, verseData, `Verse for passage ${p.key}`);
          await immutableRecord(tx.verse, { osis: p.verse.osis }, verseData, `Verse ${p.verse.osis}`);
        } else if (currentVerse) {
          throw new IngestionConflictError(`Passage ${p.key} already has a verse index; omission cannot silently remove its provenance`);
        }
      }
    }

    // The schema has no run-manifest column. Preserve the entire validated
    // manifest in the existing submission audit, linked atomically to the run.
    const submission = await tx.submission.create({ data: {
      title: `JSON ingestion v1: ${c.name}`,
      sourceUrl: src.canonicalUrl, sourceId: source.id,
      notes: JSON.stringify({ adapter: "symphony-json", manifestChecksum, manifest }),
    } });
    const run = await tx.ingestionRun.create({ data: {
      submissionId: submission.id, sourceId: source.id, stage: "EXTRACTION",
      status: "SUCCEEDED", parserVersion: src.parserVersion, rawChecksum: src.checksum,
      startedAt, finishedAt: importTime(now),
    } });
    return {
      sourceId: source.id, corpusId: corpus.id, submissionId: submission.id,
      ingestionRunId: run.id, mode: manifest.mode, manifestChecksum,
      works: manifest.works.length, passages: passageCount,
    };
  };

  // Serializable isolation + uniqueness guards close check/create races. A retry
  // rechecks all identities in a fresh transaction; no partial import survives.
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(ingest, { isolationLevel: "Serializable", maxWait: 5000, timeout: 60000 });
    } catch (error) {
      if (attempt >= 2 || !["P2034", "P2002"].includes(error?.code)) throw error;
    }
  }
}

export async function readManifest(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

/** Validation-only mode deliberately never loads Prisma or connects to a DB. */
export async function runCli(args = process.argv.slice(2), { log = console.log, createClient } = {}) {
  const validateOnly = args.includes("--validate-only");
  const files = args.filter((arg) => arg !== "--validate-only");
  if (files.length !== 1 || files[0].startsWith("-") || args.filter((arg) => arg === "--validate-only").length > 1) {
    throw new Error("Usage: node scripts/ingest-json.mjs [--validate-only] <manifest.json>");
  }
  const manifest = validateManifest(await readManifest(files[0]));
  if (validateOnly) {
    const result = { valid: true, manifestVersion: manifest.manifestVersion, mode: manifest.mode, works: manifest.works.length, passages: manifest.works.reduce((sum, w) => sum + w.passages.length, 0) };
    log(JSON.stringify(result, null, 2));
    return result;
  }
  const client = createClient ? await createClient() : new (await import("@prisma/client")).PrismaClient();
  try {
    const result = await importManifest(client, manifest);
    log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    await client.$disconnect();
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  runCli().catch((error) => {
    console.error(`${error.name}: ${error.message}`);
    process.exitCode = 1;
  });
}

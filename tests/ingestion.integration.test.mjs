import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { importManifest, validateManifest } from "../scripts/ingest-json.mjs";

// Explicit opt-in against an already migrated, disposable PostgreSQL database:
// TEST_DATABASE_URL=... node --test tests/ingestion.integration.test.mjs
// Never infer this value from DATABASE_URL or load the application's shared DB.
const testUrl = process.env.TEST_DATABASE_URL;

test("PostgreSQL ingestion: immutable identity, audit, rights and atomic rollback", { skip: !testUrl, timeout: 180000 }, async (t) => {
  let url;
  try { url = new URL(testUrl); } catch { throw new Error("TEST_DATABASE_URL must be an explicit PostgreSQL test database URL"); }
  assert.ok(["postgres:", "postgresql:"].includes(url.protocol), "TEST_DATABASE_URL must use PostgreSQL");
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient({ datasources: { db: { url: testUrl } } });
  const token = randomUUID();
  let sequence = 0;
  const owned = {
    sourceUrls: new Set(), corpusSlugs: new Set(), traditionSlugs: new Set(),
    personSlugs: new Set(), workKeys: new Set(), passageKeys: new Set(),
  };
  function track(manifest) {
    owned.sourceUrls.add(manifest.source.canonicalUrl);
    owned.corpusSlugs.add(manifest.corpus.slug);
    if (manifest.corpus.tradition) owned.traditionSlugs.add(manifest.corpus.tradition.slug);
    for (const work of manifest.works) {
      owned.workKeys.add(work.key);
      if (work.author) owned.personSlugs.add(work.author.slug);
      for (const passage of work.passages ?? []) owned.passageKeys.add(passage.key);
    }
    return manifest;
  }
  function fixture() {
    const suffix = ++sequence;
    const key = `ingestion-test-${token}-${suffix}`;
    const book = `Test${token.replaceAll("-", "")}${suffix}`;
    return track({
      manifestVersion: 1, mode: "FULL_TEXT",
      source: {
        name: `Disposable ingestion test ${key}`, kind: "OTHER",
        canonicalUrl: `https://example.invalid/symphony-ingestion/${token}/${suffix}`,
        rightsStatus: "PUBLIC_DOMAIN", rightsEvidence: "Synthetic test-only text; no third-party corpus or theological claim.",
        fetchedAt: "2026-10-09T08:00:00Z", checksum: `sha256:${"a".repeat(64)}`, parserVersion: "integration-test/1",
      },
      corpus: {
        slug: key, name: "Disposable ingestion test", kind: "OTHER", language: "en",
        tradition: { slug: `${key}-tradition`, name: "Synthetic test classification" },
      },
      works: [{
        key: `${key}:work`, title: "Synthetic integration fixture", edition: "TEST ONLY",
        author: { slug: `${key}-author`, name: "Synthetic test author" },
        passages: [
          { key: `${key}:child`, parentKey: `${key}:parent`, ordinal: 1, kind: "VERSE", text: "Synthetic child text.", locator: "test:child", verse: { osis: `${book}.1.1`, book, chapter: 1, verse: 1 } },
          { key: `${key}:parent`, ordinal: 0, kind: "CHAPTER", text: "Synthetic parent text.", locator: "test:parent" },
        ],
      }],
    });
  }
  const rows = (model, where) => db[model].findMany({ where, orderBy: { id: "asc" } });
  async function snapshot() {
    const sources = await rows("source", { canonicalUrl: { in: [...owned.sourceUrls] } });
    const sourceIds = sources.map((source) => source.id);
    const passages = await rows("passage", { importKey: { in: [...owned.passageKeys] } });
    return {
      source: sources,
      tradition: await rows("tradition", { slug: { in: [...owned.traditionSlugs] } }),
      person: await rows("person", { slug: { in: [...owned.personSlugs] } }),
      corpus: await rows("corpus", { slug: { in: [...owned.corpusSlugs] } }),
      work: await rows("work", { importKey: { in: [...owned.workKeys] } }),
      passage: passages,
      verse: await rows("verse", { passageId: { in: passages.map((passage) => passage.id) } }),
      submission: await rows("submission", { sourceId: { in: sourceIds } }),
      ingestionRun: await rows("ingestionRun", { sourceId: { in: sourceIds } }),
    };
  }
  async function cleanup() {
    // Exact, randomized identities only. No truncation, broad prefix deletion,
    // schema drops, or modifications to pre-existing application/seed records.
    const ownedRows = await snapshot();
    const ids = (model) => ({ id: { in: ownedRows[model].map((row) => row.id) } });
    await db.$transaction(async (tx) => {
      await tx.ingestionRun.deleteMany({ where: ids("ingestionRun") });
      await tx.submission.deleteMany({ where: ids("submission") });
      await tx.verse.deleteMany({ where: ids("verse") });
      await tx.passage.updateMany({ where: ids("passage"), data: { parentId: null } });
      await tx.passage.deleteMany({ where: ids("passage") });
      await tx.work.deleteMany({ where: ids("work") });
      await tx.corpus.deleteMany({ where: ids("corpus") });
      await tx.person.deleteMany({ where: ids("person") });
      await tx.tradition.deleteMany({ where: ids("tradition") });
      await tx.source.deleteMany({ where: ids("source") });
    });
  }

  try {
    await db.$connect();
    const original = fixture();
    const first = await importManifest(db, original);
    const initial = await snapshot();

    await t.test("repeat import reuses one graph, creates two audits, and keeps passages DRAFT", async () => {
      const repeated = await importManifest(db, original);
      const actual = await snapshot();
      for (const model of ["source", "tradition", "person", "corpus", "work", "passage", "verse"]) assert.deepEqual(actual[model], initial[model]);
      assert.equal(actual.source.length, 1);
      assert.equal(actual.corpus.length, 1);
      assert.equal(actual.work.length, 1);
      assert.equal(actual.passage.length, 2);
      assert.equal(actual.verse.length, 1);
      assert.ok(actual.passage.every((passage) => passage.reviewStatus === "DRAFT"));
      const parent = actual.passage.find((passage) => passage.importKey.endsWith(":parent"));
      const child = actual.passage.find((passage) => passage.importKey.endsWith(":child"));
      assert.equal(child.parentId, parent.id);
      assert.equal(actual.verse[0].passageId, child.id);
      assert.equal(first.sourceId, repeated.sourceId);
      assert.equal(first.corpusId, repeated.corpusId);
      assert.notEqual(first.ingestionRunId, repeated.ingestionRunId);
      assert.notEqual(first.submissionId, repeated.submissionId);
      assert.equal(actual.ingestionRun.length, 2);
      assert.equal(actual.submission.length, 2);
      for (const run of actual.ingestionRun) {
        assert.equal(run.status, "SUCCEEDED");
        assert.equal(run.sourceId, first.sourceId);
        assert.equal(run.rawChecksum, original.source.checksum);
        assert.equal(run.parserVersion, original.source.parserVersion);
        const audit = actual.submission.find((submission) => submission.id === run.submissionId);
        assert.deepEqual(JSON.parse(audit.notes).manifest, validateManifest(original));
      }
    });

    const conflicts = [
      ["rights status", () => { const m = structuredClone(original); m.source.rightsStatus = "PERMISSION_GRANTED"; return m; }, /Source.*rightsStatus/],
      ["rights evidence", () => { const m = structuredClone(original); m.source.rightsEvidence = "Changed rights evidence"; return m; }, /Source.*rightsEvidence/],
      ["passage text", () => { const m = structuredClone(original); m.works[0].passages[0].text = "Changed synthetic text"; return m; }, /Passage.*text/],
      ["work importKey owner", () => { const m = fixture(); m.works[0].key = original.works[0].key; return m; }, /Work.*corpusId/],
      ["passage importKey owner", () => { const m = fixture(); m.works[0].passages[0].key = original.works[0].passages[0].key; return m; }, /Passage.*workId/],
      ["OSIS owner", () => { const m = fixture(); m.works[0].passages[0].verse = structuredClone(original.works[0].passages[0].verse); return m; }, /Verse.*passageId/],
    ];
    for (const [name, makeInput, expected] of conflicts) {
      await t.test(`conflicting ${name} cannot change the source, content, index or audit`, async () => {
        const input = track(makeInput());
        const before = await snapshot();
        await assert.rejects(importManifest(db, input), expected);
        assert.deepEqual(await snapshot(), before);
      });
    }

    for (const [name, mutate, expected] of [
      ["unknown parent", (m) => m.works[0].passages[0].parentKey = "absent", /parentKey/],
      ["cyclic hierarchy", (m) => m.works[0].passages[1].parentKey = m.works[0].passages[0].key, /cycle/],
      ["self-parent hierarchy", (m) => m.works[0].passages[0].parentKey = m.works[0].passages[0].key, /cycle/],
      ["requested PUBLISHED status", (m) => m.works[0].passages[0].reviewStatus = "PUBLISHED", /reviewStatus.*not supported/],
      ["LINK_ONLY full text", (m) => m.source.rightsStatus = "LINK_ONLY", /FULL_TEXT denied/],
    ]) {
      await t.test(`${name} writes no rows`, async () => {
        const input = fixture();
        mutate(input);
        const before = await snapshot();
        await assert.rejects(importManifest(db, input), expected);
        assert.deepEqual(await snapshot(), before);
      });
    }

    await t.test("real late foreign-key failure rolls back content, source and already-inserted audit", async () => {
      const input = fixture();
      const before = await snapshot();
      let reachedFailure = false;
      // Use the real PostgreSQL transaction. Only the final run insert is altered
      // to reference a deliberately absent source, provoking an actual FK error.
      const failingClient = {
        $transaction(callback, options) {
          return db.$transaction((tx) => callback(new Proxy(tx, {
            get(target, property) {
              if (property !== "ingestionRun") return Reflect.get(target, property);
              return {
                async create(args) {
                  assert.equal(await tx.source.count({ where: { canonicalUrl: input.source.canonicalUrl } }), 1);
                  assert.equal(await tx.passage.count({ where: { importKey: { in: input.works[0].passages.map((passage) => passage.key) } } }), 2);
                  assert.equal(await tx.submission.count({ where: { sourceUrl: input.source.canonicalUrl } }), 1);
                  reachedFailure = true;
                  return tx.ingestionRun.create({ ...args, data: { ...args.data, sourceId: `missing-${token}` } });
                },
              };
            },
          })), options);
        },
      };
      await assert.rejects(importManifest(failingClient, input), { code: "P2003" });
      assert.equal(reachedFailure, true);
      assert.deepEqual(await snapshot(), before);
    });

    await t.test("concurrent equivalent imports keep one graph and two successful runs", async () => {
      const input = fixture();
      const imported = await Promise.all([importManifest(db, input), importManifest(db, input)]);
      assert.equal(imported[0].sourceId, imported[1].sourceId);
      assert.equal(imported[0].corpusId, imported[1].corpusId);
      assert.notEqual(imported[0].ingestionRunId, imported[1].ingestionRunId);
      assert.equal(await db.work.count({ where: { importKey: input.works[0].key } }), 1);
      assert.equal(await db.passage.count({ where: { work: { importKey: input.works[0].key } } }), 2);
      assert.equal(await db.ingestionRun.count({ where: { sourceId: imported[0].sourceId } }), 2);
    });
  } finally {
    try { await cleanup(); } finally { await db.$disconnect(); }
  }
});

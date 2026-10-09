import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { orderPassages, validateManifest } from "../scripts/ingestion-contract.mjs";
import { importManifest, runCli } from "../scripts/ingest-json.mjs";

function manifest() {
  return {
    manifestVersion: 1, mode: "FULL_TEXT",
    source: {
      name: "Test corpus", kind: "SCRIPTURE", canonicalUrl: "https://example.org/corpus",
      rightsStatus: "PUBLIC_DOMAIN", rightsEvidence: "Test-only public-domain assertion, not a production rights review.",
      fetchedAt: "2026-10-09T08:00:00Z", checksum: `sha256:${"a".repeat(64)}`, parserVersion: "test/1",
    },
    corpus: { slug: "test-corpus", name: "Test", kind: "SCRIPTURE", language: "en", tradition: { slug: "test", name: "Test tradition" } },
    works: [{ key: "test:work", title: "Test work", author: { slug: "test-author", name: "Test author" }, edition: "Test edition", passages: [
      { key: "test:verse", parentKey: "test:chapter", ordinal: 1, kind: "VERSE", text: " A test verse.\n", locator: "Test 1:1", verse: { osis: "Test.1.1", book: "Test", chapter: 1, verse: 1 } },
      { key: "test:chapter", ordinal: 0, kind: "CHAPTER", text: "Chapter heading", locator: "Test 1" },
    ] }],
  };
}

const uniqueFields = {
  source: ["canonicalUrl"], tradition: ["slug"], corpus: ["slug"], person: ["slug"],
  work: ["importKey"], passage: ["importKey"], verse: ["osis", "passageId"], submission: [], ingestionRun: [],
};

/** A copy-on-write transactional fake. No live DB or Prisma package is needed. */
function database({ seed, failOn, retries = [] } = {}) {
  let state = seed ? structuredClone(seed) : Object.fromEntries(Object.keys(uniqueFields).map((key) => [key, []]));
  let serial = Math.max(0, ...Object.values(state).flat().map((row) => Number(row.id?.split("-").at(-1)) || 0));
  const calls = [];
  return {
    calls,
    snapshot: () => structuredClone(state),
    async $transaction(fn, options) {
      calls.push({ action: "transaction", options });
      if (retries.length) throw Object.assign(new Error("retryable failure"), { code: retries.shift() });
      const pending = structuredClone(state);
      const tx = Object.fromEntries(Object.entries(uniqueFields).map(([model, fields]) => [model, {
        async findUnique({ where }) {
          calls.push({ action: `${model}.findUnique`, where });
          return structuredClone(pending[model].find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null);
        },
        async create({ data }) {
          calls.push({ action: `${model}.create`, data });
          if (failOn === `${model}.create`) throw new Error("injected database failure");
          for (const field of fields) {
            if (data[field] != null && pending[model].some((row) => row[field] === data[field])) throw Object.assign(new Error("unique constraint"), { code: "P2002" });
          }
          const row = { id: `${model}-${++serial}`, ...structuredClone(data) };
          pending[model].push(row);
          return structuredClone(row);
        },
      }]));
      const result = await fn(tx);
      state = pending;
      return result;
    },
    async $disconnect() { calls.push({ action: "disconnect" }); },
  };
}

const fixedClock = { now: () => new Date("2026-10-09T08:30:00Z") };

test("validates and detaches full provenance, defaults, hierarchy, and exact passage text", () => {
  const input = manifest();
  const normalized = validateManifest(input);
  assert.equal(normalized.source.fetchedAt, "2026-10-09T08:00:00.000Z");
  assert.equal(normalized.works[0].language, "en");
  assert.equal(normalized.works[0].passages[0].language, "en");
  assert.equal(normalized.works[0].passages[0].text, " A test verse.\n");
  assert.equal(normalized.works[0].passages[1].ordinal, 0);
  input.source.name = "Changed outside validator";
  input.works[0].passages[0].text = "Changed";
  assert.equal(normalized.source.name, "Test corpus");
  assert.equal(normalized.works[0].passages[0].text, " A test verse.\n");
  assert.deepEqual(orderPassages(normalized.works[0].passages).map((p) => p.key), ["test:chapter", "test:verse"]);
});

test("metadata-only accepts an explicitly documented unknown-rights source without passages", () => {
  const input = manifest();
  input.mode = "METADATA_ONLY";
  input.source.rightsStatus = "UNKNOWN";
  delete input.works[0].passages;
  assert.deepEqual(validateManifest(input).works[0].passages, []);
});

const invalidCases = [
  ["version missing", (m) => delete m.manifestVersion, /manifestVersion/],
  ["version unsupported", (m) => m.manifestVersion = 2, /manifestVersion/],
  ["mode unsupported", (m) => m.mode = "PUBLIC", /mode/],
  ["source missing", (m) => delete m.source, /source/],
  ["source name blank", (m) => m.source.name = " ", /source.name/],
  ["source kind invalid", (m) => m.source.kind = "UNKNOWN_KIND", /source.kind/],
  ["canonical URL invalid", (m) => m.source.canonicalUrl = "/relative", /canonicalUrl/],
  ["canonical URL missing slashes", (m) => m.source.canonicalUrl = "https:example.org", /canonicalUrl/],
  ["canonical URL embedded whitespace", (m) => m.source.canonicalUrl = "https://example.org/white space", /canonicalUrl/],
  ["canonical URL unsafe", (m) => m.source.canonicalUrl = "javascript:alert(1)", /canonicalUrl/],
  ["canonical URL credentials", (m) => m.source.canonicalUrl = "https://user:secret@example.org", /canonicalUrl/],
  ["canonical URL fragment", (m) => m.source.canonicalUrl += "#other", /canonicalUrl/],
  ["rights enum invalid", (m) => m.source.rightsStatus = "FREE", /rightsStatus/],
  ...["UNKNOWN", "LINK_ONLY", "RESTRICTED"].map((status) => [`full text ${status}`, (m) => m.source.rightsStatus = status, /FULL_TEXT denied/]),
  ["rights evidence absent", (m) => delete m.source.rightsEvidence, /rightsEvidence/],
  ["rights evidence blank", (m) => m.source.rightsEvidence = " ", /rightsEvidence/],
  ["licensed evidence needs license", (m) => m.source.rightsStatus = "LICENSED", /source.license/],
  ["retrieved timestamp absent", (m) => delete m.source.fetchedAt, /fetchedAt/],
  ["timestamp timezone absent", (m) => m.source.fetchedAt = "2026-10-09T08:00:00", /fetchedAt/],
  ["impossible timestamp", (m) => m.source.fetchedAt = "2026-02-30T00:00:00Z", /fetchedAt/],
  ["checksum absent", (m) => delete m.source.checksum, /checksum/],
  ["checksum malformed", (m) => m.source.checksum = "md5:abc", /checksum/],
  ["parser absent", (m) => delete m.source.parserVersion, /parserVersion/],
  ["corpus missing", (m) => delete m.corpus, /corpus/],
  ["corpus slug whitespace", (m) => m.corpus.slug = " test ", /corpus.slug/],
  ["works must be array", (m) => m.works = {}, /works/],
  ["author incomplete", (m) => delete m.works[0].author.name, /author.name/],
  ["key absent", (m) => delete m.works[0].key, /key/],
  ["work title absent", (m) => delete m.works[0].title, /title/],
  ["year noninteger", (m) => m.works[0].publishedYear = 1.5, /publishedYear/],
  ["passages must be array", (m) => m.works[0].passages = {}, /passages/],
  ["metadata-only passage content", (m) => m.mode = "METADATA_ONLY", /METADATA_ONLY/],
  ["passage locator absent", (m) => delete m.works[0].passages[0].locator, /locator/],
  ["empty passage", (m) => m.works[0].passages[0].text = " \n", /text/],
  ["NUL text", (m) => m.works[0].passages[0].text = "hello\0", /text/],
  ["ordinal negative", (m) => m.works[0].passages[0].ordinal = -1, /ordinal/],
  ["ordinal missing", (m) => delete m.works[0].passages[0].ordinal, /ordinal/],
  ["ordinal fractional", (m) => m.works[0].passages[0].ordinal = 1.5, /ordinal/],
  ["ordinal overflow", (m) => m.works[0].passages[0].ordinal = 2147483648, /ordinal/],
  ["chapter zero", (m) => m.works[0].passages[0].verse.chapter = 0, /chapter/],
  ["verse negative", (m) => m.works[0].passages[0].verse.verse = -1, /verse/],
  ["OSIS mismatch", (m) => m.works[0].passages[0].verse.osis = "Test.2.1", /osis/],
  ["verse kind mismatch", (m) => m.works[0].passages[0].kind = "PARAGRAPH", /kind/],
  ["unknown top field", (m) => m.publish = true, /not supported/],
  ["publication field prohibited", (m) => m.works[0].passages[0].reviewStatus = "PUBLISHED", /reviewStatus/],
  ["duplicate work keys", (m) => m.works.push(structuredClone(m.works[0])), /Duplicate work.key/],
  ["duplicate passage keys", (m) => m.works[0].passages.push(structuredClone(m.works[0].passages[0])), /Duplicate passage.key/],
  ["duplicate OSIS", (m) => m.works[0].passages.push({ ...structuredClone(m.works[0].passages[0]), key: "other:verse" }), /Duplicate passage.verse.osis/],
  ["missing parent", (m) => m.works[0].passages[0].parentKey = "absent", /Unknown or cross-work parentKey/],
  ["self cycle", (m) => m.works[0].passages[0].parentKey = "test:verse", /cycle/],
  ["multi-node cycle", (m) => m.works[0].passages[1].parentKey = "test:verse", /cycle/],
  ["conflicting author identity", (m) => m.works.push({ key: "other-work", title: "Other", author: { slug: "test-author", name: "Different author" } }), /Conflicting author identity/],
];
for (const [name, mutate, expected] of invalidCases) {
  test(`rejects ${name} before database access`, async () => {
    const input = manifest();
    mutate(input);
    const db = database();
    await assert.rejects(importManifest(db, input), expected);
    assert.equal(db.calls.length, 0);
  });
}

test("requires rights evidence for metadata-only sources too", () => {
  const input = manifest();
  input.mode = "METADATA_ONLY";
  input.works = [];
  delete input.source.rightsEvidence;
  assert.throws(() => validateManifest(input), /rightsEvidence/);
});

test("rejects parent references into another work and duplicate passage keys across works", () => {
  const input = manifest();
  input.works.push({ key: "second", title: "Second", passages: [{ key: "second:p", parentKey: "test:chapter", ordinal: 0, text: "Other", locator: "Second:1" }] });
  assert.throws(() => validateManifest(input), /cross-work/);
  input.works[1].passages[0].parentKey = null;
  input.works[1].passages[0].key = "test:chapter";
  assert.throws(() => validateManifest(input), /Duplicate passage.key/);
});

test("orders a deep hierarchy without recursive stack overflow", () => {
  const passages = Array.from({ length: 12000 }, (_, i) => ({ key: `p${i}`, parentKey: i ? `p${i - 1}` : null })).reverse();
  const ordered = orderPassages(passages);
  assert.equal(ordered.length, 12000);
  assert.equal(ordered[0].key, "p0");
  assert.equal(ordered.at(-1).key, "p11999");
});

test("imports parents first, writes only DRAFT passages, and commits the provenance audit atomically", async () => {
  const input = manifest();
  const db = database();
  const result = await importManifest(db, input, fixedClock);
  const state = db.snapshot();
  assert.equal(result.passages, 2);
  assert.equal(state.passage.length, 2);
  assert.equal(state.passage[0].importKey, "test:chapter");
  assert.equal(state.passage[1].parentId, state.passage[0].id);
  assert.equal(state.passage[0].parentId, null);
  assert.ok(state.passage.every((p) => p.reviewStatus === "DRAFT"));
  assert.equal(state.verse[0].passageId, state.passage[1].id);
  assert.equal(state.ingestionRun[0].submissionId, state.submission[0].id);
  assert.equal(state.ingestionRun[0].status, "SUCCEEDED");
  assert.equal(state.ingestionRun[0].rawChecksum, input.source.checksum);
  assert.equal(state.ingestionRun[0].parserVersion, input.source.parserVersion);
  const audit = JSON.parse(state.submission[0].notes);
  assert.deepEqual(audit.manifest, validateManifest(input));
  assert.equal(audit.manifestChecksum, result.manifestChecksum);
  assert.equal(db.calls[0].options.isolationLevel, "Serializable");
});

test("exact repeats reuse all content, preserve published status, and add separate successful runs", async () => {
  const initialDb = database();
  await importManifest(initialDb, manifest(), fixedClock);
  const seed = initialDb.snapshot();
  seed.passage[0].reviewStatus = "PUBLISHED";
  const db = database({ seed });
  await importManifest(db, manifest(), fixedClock);
  const after = db.snapshot();
  for (const model of ["source", "tradition", "corpus", "person", "work", "passage", "verse"]) assert.deepEqual(after[model], seed[model]);
  assert.equal(after.submission.length, 2);
  assert.equal(after.ingestionRun.length, 2);
  assert.notEqual(after.ingestionRun[0].id, after.ingestionRun[1].id);
  assert.notEqual(after.submission[0].id, after.submission[1].id);
  assert.equal(after.passage[0].reviewStatus, "PUBLISHED");
});

test("parser/retrieval changes are recorded in new runs without overwriting original source provenance", async () => {
  const db = database();
  const input = manifest();
  await importManifest(db, input, fixedClock);
  const before = db.snapshot();
  input.source.parserVersion = "test/2";
  input.source.checksum = `sha256:${"b".repeat(64)}`;
  input.source.fetchedAt = "2026-10-09T08:20:00Z";
  await importManifest(db, input, fixedClock);
  const after = db.snapshot();
  assert.deepEqual(after.source, before.source);
  assert.equal(after.ingestionRun[1].parserVersion, "test/2");
  assert.equal(after.ingestionRun[1].rawChecksum, input.source.checksum);
  assert.equal(JSON.parse(after.submission[1].notes).manifest.source.fetchedAt, "2026-10-09T08:20:00.000Z");
});

for (const [name, mutate, expected] of [
  ["source identity", (m) => m.source.name = "Other", /Source.*name/],
  ["rights evidence", (m) => m.source.rightsEvidence = "Changed evidence", /Source.*rightsEvidence/],
  ["rights status", (m) => m.source.rightsStatus = "PERMISSION_GRANTED", /Source.*rightsStatus/],
  ["tradition", (m) => m.corpus.tradition.name = "Other", /Tradition.*name/],
  ["corpus ownership", (m) => m.source.canonicalUrl = "https://example.org/other", /Corpus.*sourceId/],
  ["work ownership", (m) => m.corpus.slug = "other-corpus", /Work.*corpusId/],
  ["author identity", (m) => m.works[0].author.name = "Other", /Author.*name/],
  ["author removal", (m) => delete m.works[0].author, /Work.*authorId/],
  ["edition", (m) => m.works[0].edition = "Other", /Work.*edition/],
  ["passage ownership", (m) => m.works[0].key = "another-work", /Passage.*workId/],
  ["passage text", (m) => m.works[0].passages[0].text = "Edited", /Passage.*text/],
  ["passage locator", (m) => m.works[0].passages[0].locator = "Edited locator", /Passage.*locator/],
  ["parent removal", (m) => delete m.works[0].passages[0].parentKey, /Passage.*parentId/],
  ["verse omission", (m) => delete m.works[0].passages[0].verse, /already has a verse index/],
  ["verse index change", (m) => { m.works[0].passages[0].verse.osis = "Test.1.2"; m.works[0].passages[0].verse.verse = 2; }, /Verse.*osis/],
  ["OSIS rebinding", (m) => { m.works[0].passages[0].key = "new:verse"; }, /Verse.*passageId/],
]) {
  test(`rejects changes to ${name} and rolls back every preceding write`, async () => {
    const db = database();
    await importManifest(db, manifest(), fixedClock);
    const before = db.snapshot();
    const input = manifest();
    mutate(input);
    await assert.rejects(importManifest(db, input, fixedClock), expected);
    assert.deepEqual(db.snapshot(), before);
  });
}

for (const model of ["corpus", "person", "work", "passage", "verse", "submission", "ingestionRun"]) {
  test(`database failure creating ${model} leaves zero partial records`, async () => {
    const db = database({ failOn: `${model}.create` });
    const before = db.snapshot();
    await assert.rejects(importManifest(db, manifest(), fixedClock), /injected database failure/);
    assert.deepEqual(db.snapshot(), before);
  });
}

test("incomplete legacy provenance cannot be silently repaired or reused", async () => {
  const db = database();
  await importManifest(db, manifest(), fixedClock);
  const seed = db.snapshot();
  seed.source[0].checksum = null;
  const legacyDb = database({ seed });
  await assert.rejects(importManifest(legacyDb, manifest(), fixedClock), /incomplete provenance/);
  assert.deepEqual(legacyDb.snapshot(), seed);
});

test("retries serializable and unique-key races in fresh transactions", async () => {
  const db = database({ retries: ["P2034", "P2002"] });
  await importManifest(db, manifest(), fixedClock);
  assert.equal(db.calls.filter((call) => call.action === "transaction").length, 3);
  assert.equal(db.snapshot().ingestionRun.length, 1);
});

test("bounds contention retries and does not report success after transaction failure", async () => {
  const db = database({ retries: ["P2034", "P2034", "P2034", "P2034"] });
  await assert.rejects(importManifest(db, manifest(), fixedClock), { code: "P2034" });
  assert.equal(db.calls.length, 3);
  assert.equal(db.snapshot().source.length, 0);
});

test("validation-only CLI does not instantiate Prisma, and normal CLI disconnects after failure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "symphony-ingestion-"));
  try {
    const file = join(directory, "manifest.json");
    await writeFile(file, JSON.stringify(manifest()));
    let created = false;
    const outputs = [];
    const result = await runCli(["--validate-only", file], { log: (text) => outputs.push(JSON.parse(text)), createClient: () => { created = true; throw new Error("unexpected Prisma initialization"); } });
    assert.equal(created, false);
    assert.equal(result.valid, true);
    assert.equal(outputs.length, 1);
    const db = database({ failOn: "verse.create" });
    await assert.rejects(runCli([file], { log: () => assert.fail("must not log success"), createClient: () => db }), /injected database failure/);
    assert.equal(db.calls.at(-1).action, "disconnect");
    await writeFile(file, JSON.stringify({ ...manifest(), manifestVersion: 0 }));
    await assert.rejects(runCli([file], { createClient: () => { throw new Error("must validate first"); } }), /manifestVersion/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("CLI rejects absent, ambiguous, or unsupported arguments", async () => {
  for (const args of [[], ["one", "two"], ["--help"], ["--validate-only"], ["--validate-only", "--validate-only", "file"]]) await assert.rejects(runCli(args), /Usage:/);
});

for (const value of [null, [], [manifest()], "manifest", true, 1]) {
  test(`rejects a non-object manifest (${JSON.stringify(value)?.slice(0, 30)}) before database access`, async () => {
    const db = database();
    await assert.rejects(importManifest(db, value), /manifest must be an object/);
    assert.equal(db.calls.length, 0);
  });
}

for (const field of ["source", "corpus"]) {
  test(`rejects array-valued ${field} before database access`, async () => {
    const input = manifest();
    input[field] = [input[field]];
    const db = database();
    await assert.rejects(importManifest(db, input), new RegExp(`${field} must be an object`));
    assert.equal(db.calls.length, 0);
  });
}

test("orders a wide hierarchy without spreading all children onto the call stack", () => {
  const passages = [{ key: "root", parentKey: null }];
  for (let index = 0; index < 150000; index++) passages.push({ key: `child-${index}`, parentKey: "root" });
  const ordered = orderPassages(passages);
  assert.equal(ordered.length, passages.length);
  assert.equal(ordered[0].key, "root");
  assert.equal(ordered.at(-1).key, "child-149999");
});

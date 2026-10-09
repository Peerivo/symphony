import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";

// Opt in only with a disposable test database. Never use DATABASE_URL implicitly.
// Run: TEST_DATABASE_URL=... node --import tsx --test tests/search.integration.test.mjs
const testUrl = process.env.TEST_DATABASE_URL;
test("PostgreSQL search: recall, rank, publication, provenance and linked knowledge", { skip: !testUrl }, async (t) => {
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_URL = testUrl;
  const { db } = await import("../lib/db.ts");
  const { searchCorpus } = await import("../lib/search.ts");
  const seed = JSON.parse(await fs.readFile(new URL("../fixtures/ingestion/legal-seed-russyn.json", import.meta.url), "utf8"));
  const token = randomUUID();
  const sourceIds = [], questionIds = [], claimIds = [], fragmentIds = [];
  let corpus;
  const passageIds = new Map();
  try {
    const source = await db.source.create({ data: {
      ...seed.source, canonicalUrl: `https://example.invalid/symphony-search-test/${token}`,
      name: "Disposable synthetic search fixture; not a Scripture edition", fetchedAt: new Date(seed.source.fetchedAt),
    } });
    sourceIds.push(source.id);
    const blocked = await db.source.create({ data: {
      ...seed.source, canonicalUrl: `https://example.invalid/symphony-search-test-blocked/${token}`,
      name: "Blocked disposable search fixture", rightsStatus: "LINK_ONLY", fetchedAt: new Date(seed.source.fetchedAt),
    } });
    sourceIds.push(blocked.id);
    const incomplete = await db.source.create({ data: {
      name: "Incomplete disposable search fixture", kind: "SCRIPTURE", rightsStatus: "PUBLIC_DOMAIN",
      canonicalUrl: `https://example.invalid/symphony-search-test-incomplete/${token}`,
    } });
    sourceIds.push(incomplete.id);
    corpus = await db.corpus.create({ data: { slug: `search-test-${token}`, name: "Disposable search fixture", kind: "SCRIPTURE", sourceId: source.id } });
    const work = await db.work.create({ data: { corpusId: corpus.id, sourceId: source.id, title: "Synthetic test strings", language: "ru", edition: "TEST ONLY" } });
    async function passage(label, text, options = {}) {
      const row = await db.passage.create({ data: {
        workId: work.id, sourceId: options.sourceId ?? source.id, ordinal: passageIds.size + 1,
        text, locator: `test:${label}`, kind: "VERSE", reviewStatus: options.reviewStatus ?? "PUBLISHED",
        verse: { create: { osis: `Test${token}.${passageIds.size + 1}.1`, book: `Test${token}`, chapter: passageIds.size + 1, verse: 1 } },
      }, include: { verse: true } });
      passageIds.set(label, row.id);
      return row;
    }
    const exactReference = await passage("reference", "Disposable synthetic exact-reference fixture.");
    // This address is outside the starter seed. The disposable DB must not contain
    // a complete Bible import; do not repoint any pre-existing verse identity.
    await db.verse.update({ where: { id: exactReference.verse.id }, data: { osis: "Obad.1.21", book: "Obad", chapter: 1, verse: 21 } });
    const quote = await passage("quote", "Колеблющимися и увлекающимися всяким ветром учения.");
    const exactPhrase = await passage("exact-phrase", "Сапфировый лучистый знак.");
    await passage("overlap", "Лучистый знак несет сапфировый цвет.");
    const draft = await passage("draft", "Сапфировый лучистый закрытослово.", { reviewStatus: "DRAFT" });
    const blockedPassage = await passage("blocked", "Сапфировый лучистый запретослово.", { sourceId: blocked.id });
    const incompletePassage = await passage("incomplete", "Сапфировый лучистый неполнослово.", { sourceId: incomplete.id });
    const privateOnly = "непубликуемая тайнофраза";
    const draftQuestion = await db.question.create({ data: { canonicalText: privateOnly, normalizedKey: `draft-${token}`, reviewStatus: "DRAFT" } });
    questionIds.push(draftQuestion.id);
    const question = await db.question.create({ data: {
      canonicalText: "О чем этот отрывок?", normalizedKey: `published-${token}`, reviewStatus: "PUBLISHED",
      passages: { create: [{ passageId: quote.id }, { passageId: draft.id }] },
      signals: { create: [{ bucket: new Date("2026-01-01T00:00:00Z"), count: 3 }, { bucket: new Date("2026-01-02T00:00:00Z"), count: 7 }] },
    } });
    questionIds.push(question.id);
    const fragment = await db.sourceFragment.create({ data: {
      sourceId: source.id, passageId: quote.id, quotedText: "Свидетельство связи", locator: "test:linked", reviewStatus: "PUBLISHED",
    } });
    fragmentIds.push(fragment.id);
    const unpublishedFragment = await db.sourceFragment.create({ data: {
      sourceId: source.id, passageId: quote.id, quotedText: privateOnly, reviewStatus: "DRAFT",
    } });
    fragmentIds.push(unpublishedFragment.id);
    const claim = await db.claim.create({ data: {
      text: "Проверенная тестовая связь", reviewStatus: "PUBLISHED", sourceFragmentId: fragment.id,
      passages: { create: [{ passageId: quote.id }, { passageId: draft.id }] },
    } });
    claimIds.push(claim.id);
    const unsupportedClaim = await db.claim.create({ data: {
      text: privateOnly, reviewStatus: "PUBLISHED", sourceFragmentId: unpublishedFragment.id,
    } });
    claimIds.push(unsupportedClaim.id);

    await t.test("Russian and canonical OSIS references resolve the exact indexed passage", async () => {
      for (const query of ["Авд 1:21", "Obad.1.21"]) {
        const result = await searchCorpus(query);
        assert.deepEqual(result.verses.map((verse) => verse.passageId), [exactReference.id]);
      }
    });
    await t.test("Russian inflections retrieve a non-contiguous approximate quotation", async () => {
      const result = await searchCorpus("где сказано про ветры учения?");
      assert.ok(result.verses.some((verse) => verse.passageId === quote.id));
      assert.ok(result.verses.length <= 12);
      assert.ok(result.questions.some((item) => item.id === question.id));
      assert.ok(result.claims.some((item) => item.id === claim.id));
      assert.ok(result.fragments.some((item) => item.id === fragment.id));
      const linked = result.questions.find((item) => item.id === question.id);
      assert.equal(linked.signals.reduce((sum, item) => sum + item.count, 0), 10);
      assert.deepEqual(linked.passages.map((link) => link.passageId), [quote.id]);
      assert.deepEqual(result.claims.find((item) => item.id === claim.id).passages.map((link) => link.passageId), [quote.id]);
    });
    await t.test("normalized phrase ranks ahead of unordered lexical overlap", async () => {
      const result = await searchCorpus("сапфировый лучистый");
      assert.equal(result.verses[0]?.passageId, exactPhrase.id);
      const actualIds = result.verses.map((verse) => verse.passageId);
      assert.equal(actualIds.includes(draft.id), false);
      assert.equal(actualIds.includes(blockedPassage.id), false);
      assert.equal(actualIds.includes(incompletePassage.id), false);
    });
    await t.test("draft questions/fragments and unsupported claims stay private", async () => {
      const result = await searchCorpus(privateOnly);
      assert.equal(result.questions.some((item) => item.id === draftQuestion.id), false);
      assert.equal(result.fragments.some((item) => item.id === unpublishedFragment.id), false);
      assert.equal(result.claims.some((item) => item.id === unsupportedClaim.id), false);
    });
    await t.test("SQL-looking input remains bound data and cannot expose blocked rows", async () => {
      const result = await searchCorpus("сапфировый' OR 1=1 --");
      assert.equal(result.verses.some((verse) => [draft.id, blockedPassage.id, incompletePassage.id].includes(verse.passageId)), false);
      assert.ok(result.verses.length <= 12);
    });
    await t.test("empty and wildcard-only inputs do not match the whole corpus", async () => {
      assert.deepEqual(await searchCorpus("% _ !!!"), { verses: [], questions: [], claims: [], fragments: [] });
    });
  } finally {
    if (claimIds.length) await db.claim.deleteMany({ where: { id: { in: claimIds } } });
    if (fragmentIds.length) await db.sourceFragment.deleteMany({ where: { id: { in: fragmentIds } } });
    if (questionIds.length) await db.question.deleteMany({ where: { id: { in: questionIds } } });
    if (corpus) await db.corpus.delete({ where: { id: corpus.id } });
    if (sourceIds.length) await db.source.deleteMany({ where: { id: { in: sourceIds } } });
    await db.$disconnect();
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const testUrl = process.env.TEST_DATABASE_URL;

test("reading context only shows published, rights-cleared verses from the same work and chapter", { skip: !testUrl }, async () => {
  process.env.DATABASE_URL = testUrl;
  process.env.DIRECT_URL = testUrl;
  const { db } = await import("../lib/db");
  const { getVersePage } = await import("../lib/verse-page");
  const { adjacentPublishedVerses } = await import("../lib/reading-context");
  const id = randomUUID().replaceAll("-", "").slice(0, 18);
  const book = "Ctx" + id;
  const sourceIds: string[] = [];
  let corpusId: string | undefined;
  try {
    const publicSource = await db.source.create({ data: {
      name: "Disposable context fixture", kind: "SCRIPTURE", rightsStatus: "PUBLIC_DOMAIN",
      rightsEvidence: "Test fixture only", fetchedAt: new Date(), checksum: "test-checksum",
      parserVersion: "integration-test/1", canonicalUrl: "https://example.invalid/context/" + id,
    } });
    sourceIds.push(publicSource.id);
    const deniedSource = await db.source.create({ data: {
      name: "Unlicensed fixture", kind: "SCRIPTURE", rightsStatus: "LINK_ONLY",
      rightsEvidence: "Test fixture only", fetchedAt: new Date(), checksum: "test-checksum",
      parserVersion: "integration-test/1", canonicalUrl: "https://example.invalid/denied/" + id,
    } });
    sourceIds.push(deniedSource.id);
    const corpus = await db.corpus.create({ data: {
      slug: "context-" + id, name: "Disposable context corpus", kind: "SCRIPTURE",
      sourceId: publicSource.id,
    } });
    corpusId = corpus.id;
    const work = await db.work.create({ data: {
      corpusId: corpus.id, sourceId: publicSource.id, title: "Test book", language: "ru",
    } });
    const otherWork = await db.work.create({ data: {
      corpusId: corpus.id, sourceId: publicSource.id, title: "Different edition", language: "ru",
    } });
    let ordinal = 0;
    async function add(verse: number, opts: {
      workId?: string; sourceId?: string; reviewStatus?: "PUBLISHED" | "DRAFT"; chapter?: number;
    } = {}) {
      const chapter = opts.chapter ?? 1;
      const osis = `${book}.${chapter}.${verse}`;
      ordinal++;
      await db.passage.create({ data: {
        workId: opts.workId ?? work.id, sourceId: opts.sourceId ?? publicSource.id,
        ordinal, kind: "VERSE", reviewStatus: opts.reviewStatus ?? "PUBLISHED",
        text: "Synthetic text " + verse, locator: "test:" + verse, language: "ru",
        verse: { create: { osis, book, chapter, verse } },
      } });
      return osis;
    }
    const one = await add(1);
    const draft = await add(2, { reviewStatus: "DRAFT" });
    const denied = await add(3, { sourceId: deniedSource.id });
    const four = await add(4);
    const five = await add(5);
    const other = await add(6, { workId: otherWork.id });
    const seven = await add(7);
    const chapterTwo = await add(1, { chapter: 2 });

    const page4 = await getVersePage(four);
    assert.ok(page4);
    assert.deepEqual(page4.context.map(v => v.osis), [four, five]);
    assert.deepEqual(adjacentPublishedVerses(page4.context, 4), {
      previous: null, next: page4.context[1],
    });

    const page5 = await getVersePage(five);
    assert.ok(page5);
    assert.deepEqual(page5.context.map(v => v.osis), [four, five, seven]);
    assert.deepEqual(adjacentPublishedVerses(page5.context, 5), {
      previous: page5.context[0], next: null,
    });

    assert.equal(await getVersePage(draft), null);
    assert.equal(await getVersePage(denied), null);
    const page1 = await getVersePage(one);
    assert.ok(page1);
    assert.deepEqual(page1.context.map(v => v.osis), [one]);
    assert.equal(page1.context.some(v => [draft, denied, other, chapterTwo].includes(v.osis)), false);
  } finally {
    if (corpusId) await db.corpus.delete({ where: { id: corpusId } });
    if (sourceIds.length) await db.source.deleteMany({ where: { id: { in: sourceIds } } });
    await db.$disconnect();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { publishSeed } from '../scripts/publish-seed.mjs';
import { validateManifest } from '../scripts/ingestion-contract.mjs';

// Exercise the real publisher and committed evidence without connecting to a DB.
const manifest = validateManifest(JSON.parse(await fs.readFile(new URL('../fixtures/ingestion/legal-seed-russyn.json', import.meta.url), 'utf8')));
const snapshot = await fs.readFile(new URL('../fixtures/ingestion/legal-seed-snapshots.json', import.meta.url));
const approval = { reviewer: 'publication-test-reviewer', evidence: 'Committed source snapshot verified in this test' };
const keys = manifest.works.flatMap(work => work.passages.map(passage => passage.key));

function fixture() {
  const source = { id: 'test-source', ...structuredClone(manifest.source), fetchedAt: new Date(manifest.source.fetchedAt) };
  const corpus = {
    id: 'test-corpus', slug: manifest.corpus.slug, name: manifest.corpus.name,
    kind: manifest.corpus.kind, language: manifest.corpus.language,
    sourceId: source.id, traditionId: null,
  };
  const passages = manifest.works.flatMap((definition, workIndex) => {
    const work = {
      id: `test-work-${workIndex}`, importKey: definition.key, corpusId: corpus.id,
      sourceId: source.id, title: definition.title, language: definition.language,
      edition: definition.edition, publishedYear: definition.publishedYear,
      authorId: null, corpus: structuredClone(corpus),
    };
    return definition.passages.map((passage, passageIndex) => {
      const id = `test-passage-${workIndex}-${passageIndex}`;
      return {
        id, importKey: passage.key, workId: work.id, sourceId: source.id,
        text: passage.text, locator: passage.locator, kind: passage.kind,
        ordinal: passage.ordinal, heading: passage.heading, language: passage.language,
        parentId: null, reviewStatus: 'DRAFT', work: structuredClone(work),
        verse: { id: `test-verse-${workIndex}-${passageIndex}`, ...passage.verse, passageId: id },
      };
    });
  });
  const state = { source, passages, writes: [], transactions: 0 };
  const tx = {
    source: {
      async findUnique(args) {
        assert.deepEqual(args, { where: { canonicalUrl: manifest.source.canonicalUrl } });
        return state.source;
      },
    },
    passage: {
      async findMany(args) {
        assert.deepEqual(args.where, { importKey: { in: keys }, sourceId: state.source.id });
        assert.deepEqual(args.include, { work: { include: { corpus: true } }, verse: true });
        return state.passages;
      },
      async update(args) {
        state.writes.push({ model: 'Passage', ...structuredClone(args) });
        const passage = state.passages.find(row => row.id === args.where.id);
        assert.ok(passage, 'publication can update only the verified seed rows');
        Object.assign(passage, args.data);
        return passage;
      },
    },
    editorialDecision: {
      async create(args) {
        state.writes.push({ model: 'EditorialDecision', ...structuredClone(args) });
        return args.data;
      },
    },
  };
  state.prisma = {
    async $transaction(callback, options) {
      state.transactions++;
      assert.equal(options.isolationLevel, 'Serializable');
      assert.ok(options.timeout >= 30_000, 'publication must allow a full verified seed transaction');
      // Deliberately do not simulate rollback: a failed preflight must never
      // attempt any update or decision, even if a real DB would roll it back.
      return callback(tx);
    },
  };
  return state;
}

test('seed publication verifies the committed snapshot and publishes exactly 35 reviewed passages', async () => {
  assert.equal(keys.length, 35);
  assert.equal('sha256:' + createHash('sha256').update(snapshot).digest('hex'), manifest.source.checksum);
  const state = fixture();
  assert.deepEqual(await publishSeed(state.prisma, approval), {
    publishedPassages: 35, source: manifest.source.canonicalUrl,
  });
  const updates = state.writes.filter(write => write.model === 'Passage');
  const decisions = state.writes.filter(write => write.model === 'EditorialDecision');
  assert.equal(updates.length, 35);
  assert.equal(decisions.length, 35);
  assert.deepEqual(updates.map(write => write.where.id).sort(), state.passages.map(row => row.id).sort());
  assert.ok(state.passages.every(row => row.reviewStatus === 'PUBLISHED'));
  for (let index = 0; index < updates.length; index++) {
    assert.deepEqual(updates[index].data, { reviewStatus: 'PUBLISHED' });
    assert.equal(decisions[index].data.entityType, 'Passage');
    assert.equal(decisions[index].data.entityId, updates[index].where.id);
    assert.equal(decisions[index].data.status, 'PUBLISHED');
    assert.deepEqual(JSON.parse(decisions[index].data.evidence), {
      operator: approval.reviewer, reviewEvidence: approval.evidence,
      source: manifest.source.canonicalUrl, checksum: manifest.source.checksum,
    });
  }
  state.writes.length = 0;
  await publishSeed(state.prisma, approval);
  assert.deepEqual(state.writes, [], 'already-published seed must not create duplicate publication decisions');
});

const sourceMutations = [
  ['name', 'Wrong source'], ['kind', 'OTHER'], ['canonicalUrl', 'https://example.invalid/wrong'],
  ['rightsStatus', 'PERMISSION_GRANTED'], ['rightsEvidence', 'Unverified rights'],
  ['license', 'Wrong license'], ['fetchedAt', new Date('2000-01-01T00:00:00Z')],
  ['checksum', 'sha256:' + '0'.repeat(64)], ['parserVersion', 'unverified-parser/9'],
];
const nestedMutations = [
  ['corpus slug', row => { row.work.corpus.slug = 'wrong-corpus'; }, /corpus metadata mismatch: slug/],
  ['corpus name', row => { row.work.corpus.name = 'Wrong corpus'; }, /corpus metadata mismatch: name/],
  ['corpus kind', row => { row.work.corpus.kind = 'OTHER'; }, /corpus metadata mismatch: kind/],
  ['corpus language', row => { row.work.corpus.language = 'en'; }, /corpus metadata mismatch: language/],
  ['corpus source', row => { row.work.corpus.sourceId = 'wrong-source'; }, /corpus metadata mismatch: sourceId/],
  ['corpus tradition', row => { row.work.corpus.traditionId = 'unreviewed-tradition'; }, /corpus metadata mismatch: traditionId/],
  ['work key', row => { row.work.importKey = 'wrong-work'; }, /work metadata mismatch: importKey/],
  ['work corpus', row => { row.work.corpusId = 'wrong-corpus'; }, /work metadata mismatch: corpusId/],
  ['work source', row => { row.work.sourceId = 'wrong-source'; }, /work metadata mismatch: sourceId/],
  ['work title', row => { row.work.title = 'Wrong title'; }, /work metadata mismatch: title/],
  ['work edition', row => { row.work.edition = 'Wrong edition'; }, /work metadata mismatch: edition/],
  ['work language', row => { row.work.language = 'en'; }, /work metadata mismatch: language/],
  ['work year', row => { row.work.publishedYear = 2000; }, /work metadata mismatch: publishedYear/],
  ['work author', row => { row.work.authorId = 'unreviewed-author'; }, /work metadata mismatch: authorId/],
  ['passage work', row => { row.workId = 'wrong-work'; }, /passage metadata mismatch: workId/],
  ['passage source', row => { row.sourceId = 'wrong-source'; }, /passage metadata mismatch: sourceId/],
  ['passage text', row => { row.text = 'Unreviewed text'; }, /passage metadata mismatch: text/],
  ['passage locator', row => { row.locator = 'https://example.invalid/wrong#V1'; }, /passage metadata mismatch: locator/],
  ['passage kind', row => { row.kind = 'QUOTE'; }, /passage metadata mismatch: kind/],
  ['passage ordinal', row => { row.ordinal = -1; }, /passage metadata mismatch: ordinal/],
  ['passage heading', row => { row.heading = 'Unreviewed heading'; }, /passage metadata mismatch: heading/],
  ['passage language', row => { row.language = 'en'; }, /passage metadata mismatch: language/],
  ['passage parent', row => { row.parentId = 'unreviewed-parent'; }, /passage metadata mismatch: parentId/],
  ['verse OSIS', row => { row.verse.osis = 'Wrong.1.1'; }, /verse metadata mismatch: osis/],
  ['verse book', row => { row.verse.book = 'Wrong'; }, /verse metadata mismatch: book/],
  ['verse chapter', row => { row.verse.chapter = 999; }, /verse metadata mismatch: chapter/],
  ['verse number', row => { row.verse.verse = 999; }, /verse metadata mismatch: verse/],
  ['verse passage', row => { row.verse.passageId = 'wrong-passage'; }, /verse metadata mismatch: passageId/],
  ['missing verse', row => { row.verse = null; }, /verse metadata mismatch/],
  ['editorial rejection', row => { row.reviewStatus = 'REJECTED'; }, /review reconciliation/],
];

test('seed publication rejects mismatched provenance before its first write', async t => {
  for (const [field, value] of sourceMutations) {
    await t.test(`source ${field}`, async () => {
      const state = fixture();
      state.source[field] = value;
      await assert.rejects(publishSeed(state.prisma, approval), new RegExp(`source metadata mismatch: ${field}`));
      assert.deepEqual(state.writes, []);
    });
  }
  for (const [name, mutate, expected] of nestedMutations) {
    await t.test(`last passage: ${name}`, async () => {
      const state = fixture();
      mutate(state.passages.at(-1));
      await assert.rejects(publishSeed(state.prisma, approval), expected);
      assert.deepEqual(state.writes, [], 'all 35 rows must pass before the first publication or decision');
      assert.ok(state.passages.slice(0, -1).every(row => row.reviewStatus === 'DRAFT'));
    });
  }
});

test('seed publication rejects missing source, incomplete keys and missing approval without writes', async t => {
  for (const [name, mutate] of [
    ['missing source', state => { state.source = null; }],
    ['missing final passage', state => { state.passages.pop(); }],
    ['duplicate key instead of final passage', state => { state.passages.at(-1).importKey = state.passages[0].importKey; }],
  ]) {
    await t.test(name, async () => {
      const state = fixture();
      mutate(state);
      await assert.rejects(publishSeed(state.prisma, approval), /complete verified seed|content mismatch/);
      assert.deepEqual(state.writes, []);
    });
  }
  for (const input of [{ ...approval, reviewer: ' ' }, { ...approval, evidence: '' }]) {
    const state = fixture();
    await assert.rejects(publishSeed(state.prisma, input), /Reviewer and review evidence are required/);
    assert.equal(state.transactions, 0);
    assert.deepEqual(state.writes, []);
  }
});

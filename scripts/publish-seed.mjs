import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { validateManifest } from './ingestion-contract.mjs';

// Trusted operator command, deliberately not exposed as an HTTP endpoint.
// Only the committed, independently source-verified scripture seed is eligible.
export async function publishSeed(prisma, { reviewer, evidence }) {
  if (!reviewer?.trim() || !evidence?.trim()) throw new Error('Reviewer and review evidence are required');
  const manifest = validateManifest(JSON.parse(await fs.readFile(new URL('../fixtures/ingestion/legal-seed-russyn.json', import.meta.url), 'utf8')));
  const snapshot = await fs.readFile(new URL('../fixtures/ingestion/legal-seed-snapshots.json', import.meta.url));
  if ('sha256:' + crypto.createHash('sha256').update(snapshot).digest('hex') !== manifest.source.checksum) throw new Error('Seed snapshot checksum mismatch');
  const keys = manifest.works.flatMap(work => work.passages.map(p => p.key));
  return prisma.$transaction(async tx => {
    const same = (actual, expected, label) => {
      for (const [key, value] of Object.entries(expected)) {
        const observed = actual?.[key];
        const equal = observed instanceof Date || value instanceof Date
          ? new Date(observed).getTime() === new Date(value).getTime() : observed === value;
        if (!equal) throw new Error(`Seed ${label} metadata mismatch: ${key}`);
      }
    };
    const source = await tx.source.findUnique({ where: { canonicalUrl: manifest.source.canonicalUrl } });
    if (!source) throw new Error('Import the complete verified seed first');
    same(source, { ...manifest.source, fetchedAt: new Date(manifest.source.fetchedAt) }, 'source');
    if (source.rightsStatus !== 'PUBLIC_DOMAIN') throw new Error('Seed rights mismatch');
    const passages = await tx.passage.findMany({ where: { importKey: { in: keys }, sourceId: source.id }, include: { work: { include: { corpus: true } }, verse: true } });
    if (passages.length !== keys.length) throw new Error('Import the complete verified seed first');
    // Verify every displayed identity before the first publication write.
    for (const work of manifest.works) for (const definition of work.passages) {
      const actual = passages.find(p => p.importKey === definition.key);
      if (!actual) throw new Error('Seed content mismatch');
      same(actual.work.corpus, { slug: manifest.corpus.slug, name: manifest.corpus.name,
        kind: manifest.corpus.kind, language: manifest.corpus.language, sourceId: source.id, traditionId: null }, 'corpus');
      same(actual.work, { importKey: work.key, corpusId: actual.work.corpus.id, sourceId: source.id,
        title: work.title, language: work.language, edition: work.edition, publishedYear: work.publishedYear, authorId: null }, 'work');
      same(actual, { importKey: definition.key, workId: actual.work.id, sourceId: source.id,
        text: definition.text, locator: definition.locator, kind: definition.kind, ordinal: definition.ordinal,
        heading: definition.heading, language: definition.language, parentId: null }, 'passage');
      same(actual.verse, { ...definition.verse, passageId: actual.id }, 'verse');
      if (!['DRAFT','PUBLISHED'].includes(actual.reviewStatus)) throw new Error('Seed requires review reconciliation');
    }
    for (const actual of passages) {
      if (actual.reviewStatus === 'PUBLISHED') continue;
      await tx.passage.update({ where: { id: actual.id }, data: { reviewStatus: 'PUBLISHED' } });
      await tx.editorialDecision.create({ data: { entityType: 'Passage', entityId: actual.id, status: 'PUBLISHED',
        reason: 'Source text and public-domain rights verified; no interpretation or theological claim generated.',
        evidence: JSON.stringify({ operator: reviewer, reviewEvidence: evidence, source: source.canonicalUrl, checksum: source.checksum }) } });
    }
    return { publishedPassages: passages.length, source: source.canonicalUrl };
  }, { isolationLevel: "Serializable", timeout: 30000 });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [reviewer, evidence] = process.argv.slice(2);
  const prisma = new PrismaClient();
  try { console.log(JSON.stringify(await publishSeed(prisma, { reviewer, evidence }))); }
  finally { await prisma.$disconnect(); }
}

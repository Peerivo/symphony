import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { readinessResponse } from '../lib/readiness';

const testUrl = process.env.TEST_DATABASE_URL;
test('PostgreSQL readiness rejects schema and ledger drift with transaction rollback', { skip: !testUrl }, async () => {
  const url = new URL(testUrl!);
  assert.ok(['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) && url.pathname.endsWith('_test'), 'Isolated loopback _test database required');
  process.env.APP_REVISION = 'a'.repeat(40);
  process.env.RELEASE_SHA = process.env.APP_REVISION;
  const db = new PrismaClient({ datasources: { db: { url: testUrl } } });
  try {
    assert.equal((await readinessResponse(db)).status, 200);
    // Each deliberate drift stays inside a transaction and rolls back, even on assertion failure.
    for (const sql of [
      'ALTER TABLE "Verse" RENAME TO "Verse_readiness_probe"',
      'ALTER TABLE "Passage" RENAME COLUMN "reviewStatus" TO "reviewStatus_readiness_probe"',
      'UPDATE public._prisma_migrations SET checksum = repeat(\'0\', 64) WHERE migration_name = \'20261009084300_publication_gate\'',
    ]) {
      const rollback = new Error('rollback-readiness-probe');
      await assert.rejects(db.$transaction(async tx => {
        await tx.$executeRawUnsafe(sql); // Fixed test-only SQL; no production/input interpolation.
        const inTransaction = { $transaction: (fn: (tx: unknown) => unknown) => fn(tx) } as unknown as PrismaClient;
        assert.equal((await readinessResponse(inTransaction)).status, 503);
        throw rollback;
      }), error => error === rollback);
      assert.equal((await readinessResponse(db)).status, 200);
    }
  } finally { await db.$disconnect(); }
});

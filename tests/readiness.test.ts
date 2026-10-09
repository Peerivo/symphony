import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expectedMigrations, migrationsMatch, schemaMatches, releaseIdentity, type ColumnRow } from '../lib/readiness';

// Independent schema oracle: the committed SQL, rather than the runtime DMMF.
const columns: ColumnRow[] = [];
const typeMap: Record<string, string> = { TEXT: 'text', INTEGER: 'int4', 'DOUBLE PRECISION': 'float8', BOOLEAN: 'bool', 'TIMESTAMP(3)': 'timestamp' };
const column = (table: string, name: string, sqlType: string, tail: string): ColumnRow => ({
  table_name: table, column_name: name, type_name: typeMap[sqlType] || sqlType.replaceAll('"', ''),
  not_null: /NOT NULL|PRIMARY KEY/.test(tail),
});
for (const migration of expectedMigrations) {
  const sql = readFileSync(`prisma/migrations/${migration.name}/migration.sql`, 'utf8');
  for (const table of sql.matchAll(/CREATE TABLE "([^"]+)" \(([\s\S]*?)\n\);/g)) {
    for (const line of table[2].split('\n')) {
      const match = line.match(/^\s*"([^"]+)"\s+("[^"]+"|DOUBLE PRECISION|TIMESTAMP\(3\)|TEXT|INTEGER|BOOLEAN)(.*)$/);
      if (match) columns.push(column(table[1], match[1], match[2], match[3]));
    }
  }
  for (const added of sql.matchAll(/ALTER TABLE "([^"]+)" ADD COLUMN\s+"([^"]+)" ("[^"]+"|\w+(?:\(\d+\))?) ([^;]+);/g)) {
    columns.push(column(added[1], added[2], added[3], added[4]));
  }
}
const migrated = expectedMigrations.map(migration => ({ migration_name: migration.name, checksum: migration.checksum, finished_at: new Date(), rolled_back_at: null }));

test('readiness accepts the committed SQL column contract and binds migration bytes', () => {
  assert.equal(schemaMatches(columns), true);
  assert.equal(migrationsMatch(migrated), true);
  for (const migration of expectedMigrations) {
    assert.equal(createHash('sha256').update(readFileSync(`prisma/migrations/${migration.name}/migration.sql`)).digest('hex'), migration.checksum);
  }
});
test('missing verse table or publication column, changed type and nullable publication fail closed', () => {
  for (const removed of ['Verse', 'Source', 'Passage']) assert.equal(schemaMatches(columns.filter(row => row.table_name !== removed)), false);
  assert.equal(schemaMatches(columns.filter(row => !(row.table_name === 'Passage' && row.column_name === 'reviewStatus'))), false);
  assert.equal(schemaMatches(columns.map(row => row.table_name === 'Passage' && row.column_name === 'reviewStatus' ? { ...row, not_null: false } : row)), false);
  assert.equal(schemaMatches(columns.map(row => row.table_name === 'Verse' && row.column_name === 'chapter' ? { ...row, type_name: 'text' } : row)), false);
});
test('unfinished, missing, changed, unexpected and ambiguous migrations are unavailable', () => {
  assert.equal(migrationsMatch([]), false);
  assert.equal(migrationsMatch(migrated.slice(1)), false);
  assert.equal(migrationsMatch(migrated.map(row => ({ ...row, finished_at: null }))), false);
  assert.equal(migrationsMatch(migrated.map(row => ({ ...row, checksum: '0'.repeat(64) }))), false);
  assert.equal(migrationsMatch([...migrated, { ...migrated[0], migration_name: 'unexpected' }]), false);
  assert.equal(migrationsMatch([...migrated, migrated[0]]), false);
  assert.equal(migrationsMatch([...migrated, { ...migrated[0], finished_at: null, rolled_back_at: new Date() }]), true);
});
test('release identity is built into the artifact and runtime mismatch cannot claim readiness', () => {
  const sha = 'a'.repeat(40);
  assert.deepEqual(releaseIdentity(sha, sha), { revision: sha, valid: true });
  assert.equal(releaseIdentity(sha, 'b'.repeat(40)).valid, false);
  assert.equal(releaseIdentity('development', sha).valid, false);
  for (const invalid of ['', 'a'.repeat(39), 'A'.repeat(40), '../revision']) assert.equal(releaseIdentity(invalid, invalid).valid, false);
});

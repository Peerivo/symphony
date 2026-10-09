import { PrismaClient } from '@prisma/client';
const expected = process.env.EXPECTED_DATABASE;
if (!expected || !/^symphony(?:_[a-z0-9]+)?$/.test(expected)) throw new Error('Dedicated Symphony database required');
if (!process.env.BACKUP_RECEIPT?.trim()) throw new Error('Restorable backup/preflight evidence required');
for (const name of ['DATABASE_URL','DIRECT_URL']) {
  const url = new URL(process.env[name] || '');
  if (!['postgres:','postgresql:'].includes(url.protocol) || decodeURIComponent(url.pathname.slice(1)) !== expected) throw new Error(name + ' must target the approved dedicated database');
}
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
try {
  const [row] = await prisma.$queryRaw`SELECT current_database() AS database, current_user AS role`;
  if (row.database !== expected) throw new Error('Connected database mismatch');
  console.log(JSON.stringify({ database: row.database, preflight: 'dedicated_target_verified', backupReceiptProvided: true }));
} finally { await prisma.$disconnect(); }

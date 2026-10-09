import { cp, access, writeFile } from 'node:fs/promises';
await access('.next/standalone/server.js');
await cp('.next/static', '.next/standalone/.next/static', { recursive: true });
try { await access('public'); await cp('public', '.next/standalone/public', { recursive: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const release = JSON.stringify({ revision: process.env.RELEASE_SHA || 'development' }) + '\n';
await writeFile('.next/release.json', release);
await writeFile('.next/standalone/release.json', release);

# M1 release boundary

## First release

Read-only, provenance-first scripture pilot: a source-verified selection of 35 Russian Synodal verses, exact and approximate lexical search, verse pages, corpus navigation and source/rights evidence. This is not a full Bible, an AI answer service or a verified theological interpretation corpus. Empty interpretation and debate sections say so.

Question intake defaults OFF (`QUESTION_INTAKE_ENABLED=false`). Enabling it requires an approved operator/contact, retention/deletion process and actual moderation ownership. The optional intake requires explicit consent, stores drafts privately, never publishes raw questions automatically, rejects cross-origin/oversized requests and uses a database-wide anonymous aggregate request budget. It creates no user tracking identifier. A canonical question must be anonymized and reviewed before publication. There is no public moderation endpoint.

Every content entity starts DRAFT. Public reads require PUBLISHED; source-backed content also requires a source with rights and provenance. Import manifests cannot set editorial state. The importer rejects global OSIS collisions: M1 supports one edition per OSIS. Multi-edition identity migration is required before adding another Bible edition.

## Verified seed publication

1. Review `docs/SEED_SOURCE.md`, the exact archived source HTML and `npm test` snapshot tests.
2. `npm run ingest:json -- fixtures/ingestion/legal-seed-russyn.json` imports private DRAFT passages atomically.
3. A trusted database operator may run `npm run seed:publish -- '<operator identity>' '<review evidence reference>'`. The command checks exact committed source checksum, text, work and verse identities and publishes only this seed, recording append-only editorial decisions. It cannot publish submitted questions, claims or interpretations.
4. Check /corpus, /sources and /verse/John.3.16. Full-text Azbyka import remains forbidden.

No database credential is checked into this repository. Source rights and the repository's software license are separate. Open license PR #2 is not accepted or merged by this work.

## Deployment and migration safety

- No migration on push or merge. `.github/workflows/migrate-production.yml` is manual only, main-only, serialized, production-environment-bound, exact-SHA-bound and checks a green CI for the same SHA.
- Operator must provide a dedicated Symphony database name and a restorable backup/preflight evidence receipt. Receipt presence is an attestation, not automated proof of restorability; verify a restore before dispatch.
- The preflight opens the DIRECT_URL connection and verifies `current_database()` against the exact expected name. It never prints credentials. It refuses shared database names such as `postgres`.
- Configure environment protection and separate runtime/migration roles outside the app. Runtime role must not be superuser and must not reuse another application's access. If Prisma requires DIRECT_URL at runtime, set it to the runtime connection, not the migration credential.
- Enabling the production environment, new credentials, database, network access, domain and migration dispatch require separately approved infrastructure work. This code change does none of those things.
- Database tables have RLS enabled and no direct anonymous/authenticated Supabase access. Server-to-server runtime role needs explicitly reviewed privileges/policies; the app never uses a browser Supabase key.

## Container

`docker build -t symphony:<sha> .` produces a non-root Next.js standalone container. It does not run migrations or seeds. Supply runtime DATABASE_URL, APP_ORIGIN, RELEASE_SHA and any runtime-only DIRECT_URL required by Prisma. Keep intake off. Proxy HTTPS traffic to its internal port 3000. `/api/health` returns 503 if database/schema access fails and otherwise reports the release revision.

## Release evidence required

- exact commit and successful unit, PostgreSQL integration, typecheck, build and mobile/desktop browser tests;
- backup restore evidence and migration result for the dedicated database;
- runtime current SHA, /api/health, source search, verse/source pages and false intake default on the real domain;
- no raw question appears in public pages/search; repeated requests and rejected ingestion leave coherent data;
- verified rollback image and database compatibility (roll back application image; never reset production data).

Local/CI results do not establish production readiness by themselves. Until live-domain E2E passes, release is pending.

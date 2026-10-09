# Work release handoff — 2026-10-09

## Scope and owner

Owner: Oleg (`olegka85`), Peerivo/symphony. Target: `symphony.peerivo.net`, existing REG.RU №1, a dedicated Symphony database on Beget. This task is a read-only pilot of 35 source-verified verses. Intake remains disabled. PR #2 is excluded. No paid resources, organization policy changes, Actions execution or server CI migration are authorized.

The current Global contract is version 1.13.0. Its production migration route remains GitHub Actions; the task forbids Actions. No production DDL, role creation, grants/policies or manual `prisma migrate deploy` is allowed through SSH while that conflict remains. The owner authorized isolated local test migrations, which do not authorize production DDL.

## Observed infrastructure

Read-only inspection on 2026-10-09 found no Symphony service, container, deployment directory or nginx vhost on REG.RU №1. Beget's existing PostgreSQL clusters contain no database or role with a Symphony name. Their credentials were neither read nor reused. No Symphony backup or restore evidence was found. PostgreSQL listeners remain private. Treat this as a first release, not an upgrade or an existing green deployment.

The release owner is this task; there was no queued/running Gateway release when inspected. Recheck current main, open PRs, Gateway jobs and any on-server release lock before a later deployment. Claim an exclusive project-specific lock; a stale inspection is not a lease.

## Remaining release gates, in order

1. Obtain a Work/execution environment supporting a normal unprivileged PostgreSQL process and Docker. This Work maps only UID 0, denies setgroups and has no Docker socket/binary. Do not fake getuid, patch PostgreSQL, create privilege workarounds or test against production. Run the real integration groups without skips, apply the two committed migrations only to a disposable loopback `_test` database, import/publish only the exact reviewed seed there, and run all four viewport reading journeys.
2. Separately approve the replacement production migration route or a scoped exception to the current route. Record who owns the migration/release, exact SHA, target database, execution boundary, backup receipt and authorization. Do not silently rewrite the existing workflow to permit shell DDL.
3. Under that route, provision a dedicated `symphony` database, `symphony_migrator` owner and distinct `symphony_app` login. Runtime must be NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, not a migration-role member, and have no CREATE/schema ownership. Revoke PUBLIC connection/schema access and Supabase anonymous/authenticated grants. Apply and test explicit role-scoped RLS for public content; DRAFT questions, ingestion audits, editorial decisions and submitted private text must not be readable by the runtime or public Data API. No all-table unrestricted runtime policy is accepted.
4. Grant the runtime only the reads used by the pilot and SELECT on `_prisma_migrations(migration_name,checksum,finished_at,rolled_back_at)`. The view budget/statistics endpoint additionally needs bounded writes on `IntakeBudget` and `PassagePopularitySignal`; it never needs publication, import, DDL, audit or question-write privileges. Verify permission denials and genuine application queries using that role before deployment. Current integration coverage with an owner role does not prove this boundary.
5. Deliver the runtime connection exclusively through a supported protected server-side value/file mechanism (Gateway stored values, never chat or tool-visible plaintext). Runtime DIRECT_URL uses runtime credentials; migration credentials stay only in the authorized migration runner. Do not put values in command arguments, image layers, a tarball or a PR.
6. Use a dedicated restricted SSH forwarding identity or approved private network between REG.RU №1 and Beget. Bind forwarding to loopback/the exact Symphony Docker-network address and restrict destinations to the exact dedicated PostgreSQL endpoint. Do not widen existing tunnels, reuse neighboring application identities or publish port 5432. Check both connection success and refusal from an unauthorized peer.
7. Back up the fresh migrated/imported database with a verified SHA-256 receipt, restore into a disposable isolated database, compare migration metadata and all 35 texts/identities with the committed seed, and verify search there. First release has no previous Symphony application image. A dump's existence is not restoration evidence.
8. Build the exact commit in Work with lockfile dependencies and build argument RELEASE_SHA, smoke the Docker image against the disposable PostgreSQL, record the immutable image digest and UID, and retain that digest with its source/build receipts. Never rebuild on REG.RU or treat a tarball as a passed container test.
9. Recheck host port occupancy and available capacity. Use existing nginx and its existing certbot/TLS mechanism. Add only the Symphony host with a loopback upstream. Validate nginx config before its reload, confirm DNS/TLS for the exact domain, and preserve other vhosts. If the global public-web registry remains `enabled:false` despite a public release request, resolve that classification and first-release observability requirements before claiming production readiness.
10. Run real HTTPS mobile/desktop journeys, compare the embedded SHA, require readiness 200, confirm source/verse/search/reload and intake 503, and read back the actual running image digest. A deploy acknowledgement alone is not success.

## Rollback

For the first release, disable only the Symphony upstream/vhost or stop only its container, restoring any prior file from its exact backup. Keep the dedicated database and dumps; never reset/drop production data as an application rollback. Keep all neighboring services running.

For subsequent releases, keep the previous immutable image digest and proxy config. Probe it against an isolated restore of the current schema; rollback is allowed only after this compatibility check. Swap only the Symphony container/upstream and confirm HTTPS, embedded SHA and readiness. The strict migration probe deliberately refuses unreviewed schema versions. A schema rollback is a new migration operation and needs its own route/authorization.

## Local evidence limits

The local passing checks and skipped checks are recorded separately in the task's evidence receipt and release bundle. Database-disabled E2E verifies outage/retry, keyboard controls, empty punctuation queries and malformed routes; it is not evidence that PostgreSQL-backed search, the published corpus or the live domain works. RLS/minimum-role tests and container execution remain mandatory, even if tests from an earlier commit ran elsewhere.

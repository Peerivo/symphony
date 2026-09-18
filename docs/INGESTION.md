# Corpus ingestion contract

Every adapter MUST emit a versioned manifest before normalized records are accepted.

Required provenance:
- source identity and canonical URL;
- retrieval/import timestamp;
- raw snapshot checksum;
- parser/adapter version;
- rights status and evidence;
- original author/work/section locator;
- language and edition when known.

Pipeline: source registry -> raw immutable snapshot -> deterministic parser -> normalized Work/WorkSection -> semantic links -> search projection.

A parser update never silently rewrites provenance. Reprocessing creates a new import run and keeps enough metadata to reproduce the normalized record.

## Rights gate
FULL_TEXT ingestion is allowed only for PUBLIC_DOMAIN, LICENSED or PERMISSION_GRANTED sources. UNKNOWN defaults to metadata/link-only until reviewed.

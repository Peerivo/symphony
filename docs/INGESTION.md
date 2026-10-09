# Corpus ingestion contract

Every adapter MUST emit a versioned manifest before normalized records are accepted.

Required provenance:
- source identity and canonical URL;
- retrieval/import timestamp;
- raw snapshot checksum;
- parser/adapter version;
- rights status and evidence;
- original author/work/passage locator;
- language and edition when known.

Canonical content path:

`Source -> Corpus -> Work -> Passage -> optional Verse index`

Canonical editorial/ingestion pipeline:

`Submission -> Intake -> Classification -> Extraction -> Fragmentation -> Linking -> Review -> TheologicalReview -> Publication -> Corrections/Versions`

A parser update never silently rewrites provenance. Reprocessing creates a new IngestionRun and stable import keys make normalization idempotent.

## Rights gate

FULL_TEXT ingestion is allowed only for PUBLIC_DOMAIN, LICENSED or PERMISSION_GRANTED sources.

UNKNOWN, LINK_ONLY and RESTRICTED do not permit full-text ingestion. Public web availability is not permission.

## Semantic extraction

Interpretation, Topic, Claim, Argument, Objection and Response extraction happens only after Passage/SourceFragment provenance exists. AI may assist extraction/linking, but every published source-backed statement must resolve to the exact SourceFragment or Passage used as evidence.

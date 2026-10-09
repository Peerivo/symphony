# JSON ingestion adapter

Run:

`npm run ingest:json -- fixtures/ingestion/<manifest>.json`

Modes:
- `METADATA_ONLY` — source/corpus/work metadata only; passage text is rejected.
- `FULL_TEXT` — allowed only when rightsStatus is PUBLIC_DOMAIN, LICENSED or PERMISSION_GRANTED.

Every source requires a canonical URL. Work and Passage records use stable import keys for idempotent reprocessing.

The adapter is intentionally rights-gated. Public web availability does not enable FULL_TEXT.

A full-text manifest may provide flat passages with `parentKey` to build hierarchy. Scripture passages may include a `verse` object with OSIS/book/chapter/verse.

This adapter is the first deterministic implementation of:
`Source -> raw/import manifest -> Corpus -> Work -> Passage -> Verse index`.

Question/Claim/Interpretation extraction is a later stage and must preserve exact SourceFragment provenance.

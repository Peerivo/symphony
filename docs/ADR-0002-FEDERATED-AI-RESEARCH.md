# ADR-0002 (proposal): federated sources and evidence-grounded AI answers

Status: PROPOSED — architecture design, not approval for scraping, bulk import, model calls, migrations or production deployment.
Date: 2026-11-26
Related: docs/ARCHITECTURE.md, docs/INGESTION.md, docs/RELEASE_READINESS.md, draft PR #5.

## Problem and product change

Symphony M1 contains a provenance-first graph and a 35-verse rights-verified read-only pilot. Its planned end state includes Bible text, patristic interpretations, questions, debate maps and theological reviews. Recreating the complete verse-by-verse commentary collections already available through Azbyka and other publishers is redundant and operationally unrealistic.

New primary user journey: **a natural-language question produces an evidence-grounded research answer**, linking to actual Scripture passages, the specific attributed viewpoints and source documents, with alternate interpretations and limitations clearly identified. The verse reader remains a useful exploration view, but is no longer the primary ingestion driver.

## Source and retrieval strategy

| Mode | Content that may be kept | Required gate |
| --- | --- | --- |
| LINK_ONLY | Canonical URL, title, source identity, author metadata, applicable OSIS verse/range, timestamps and link status | Public metadata; avoid copying protected prose |
| SEARCH_RESULT | Search-provider-supplied link/snippet subject to provider terms | Respect provider license, attribution and excerpt limits; do not silently persist or republish full text |
| PERMITTED_FETCH | Page content fetched on demand for processing under an explicit permission/terms policy, with bounded TTL | Robots/terms/rate controls, same-host allowlist, legal status and evidence |
| LICENSED/PUBLIC_DOMAIN | Full text and chunk embeddings where exact edition/translation is approved | Rights evidence per edition/work, editorial review, immutable provenance |
| UNAVAILABLE/RESTRICTED | Link and explanation, without content-based AI claim | Fail closed; do not infer interpretation from a title |

Do not treat public readability, author death date, no robots block, or the portal's permission to download as proof of unrestricted reuse. A modern translation, compilation or digital edition can have separate rights. Seek an approved machine-readable index/feed and authorization from the portal for frequent extraction. No bulk crawl before that.

Azbyka verification (2026-11-26):
- Commentary deep-link examples: https://azbyka.ru/biblia/in/?Jn.1:1= and https://azbyka.ru/biblia/in/?Jn.3:16= .
- These pages already arrange interpretations by Bible verse, author and work.
- The documented webmaster endpoints at https://azbyka.ru/azbuka-very-na-vashem-sajte cover specific widgets (quote, term, question of the day), **not a documented bulk Bible commentary API**.
- Do not assume a URL is valid just because it can be generated; normalize OSIS aliases and verify the link when first surfaced.
- Prioritize a collaboration/feed request for per-verse metadata, canonical author/work IDs, range coverage, text/reuse rights, change feed and rate limits.

## Canonical knowledge graph: retain, extend rather than replace

Retain `Corpus -> Work -> Passage`, Scripture `Verse`, `Source`, `SourceFragment`, `Interpretation`, `Question`, `Topic`, `Claim`, `Argument`, `Objection`, `Response`, `EditorialDecision`.

Add a **federated source registry**, initially without schema changes (typed provider boundary + tests), then via reviewed migrations:

- `ExternalDocument`: provider, stable external ID, canonical URL, source/work/person identity, kind, rights mode/evidence, last indexed/check timestamp, checksum/ETag, status.
- `ExternalVerseLink`: external document ID, `osis`, beginning/end reference, source fragment locator and relationship type; a range applies to all covered verses but retains the original range.
- `RetrievalReceipt`: provider, query/fetch timestamp, parser/provider revision, retrieved URL, source fingerprint, cache status, outcome and errors; avoid logging raw private questions where unnecessary.
- `AnswerEvidence`: assertion-to-evidence binding (external stable URL/locator or approved internal passage), quoted span if permitted, verification/fetch timestamp, confidence in matching the source **not** theological truth.
- `AnswerRun`: private, bounded-lived question/retrieval state and model/version metadata with no automatic public publication. Consent/retention separate from canonical Question promotion.

Deduplicate by canonical source ID + edition + locator + fragment fingerprint, not just text. Book aliases and versification (including Psalms) need explicit mappings, never silent renumbering. Keep internal DRAFT/PUBLISHED boundary: external discoveries are **not** editorially published interpretations.

## Request path

```text
User asks a question
  -> reference/topic/claim classifier + language and tradition scope
  -> concurrent retrieval under per-provider budgets:
       A. local vetted Scripture and published graph
       B. federated external metadata / verse links (Azbyka first)
       C. permitted external search results and on-demand fetched evidence
  -> normalize biblical addresses, expand relevant context (chapter, parallels,
     linked commentary ranges, topics, source fragments)
  -> deduplicate, rights-check and evidence sufficiency gate
  -> AI synthesizes structured answer exclusively from evidence pack
  -> citation verification and formatting
  -> answer + verse context + authors/interpretations + original links
     + contested viewpoints/limits + follow-up question
```

"Entire context" means an expandable **bounded, relevant evidence graph**, not blindly loading every commentary on every verse into an LLM prompt. Budget expansion by breadth, relevance, source diversity, token size, latency and source rights. Request-time external search has a short deadline and stale-cache fallback with a visible timestamp. Do not fetch dozens of pages synchronously. A queue can refresh the permitted index later; a question must still return local evidence and links when external providers are unavailable.

## LLM boundary (RAG, not an oracle)

Use an interchangeable server-side LLM adapter and prompt versioning, never a browser key. Retrieval and citation enforcement are deterministic server code; model is used for parsing a question, proposing search directions and composing an answer. External HTML, comments, injected prompts and quotations are untrusted data: sanitize, cap size, do not allow them to override model policies or issue network/tool commands.

Every factual theological assertion in the answer must map to an exact checked source or be explicitly labeled as the model's synthesis. Render author/source/verse/URL for cited positions. Distinguish *Scripture*, *attributed interpretation*, *denominational claim*, *AI explanation* and *unresolved question*. The AI does not assert official Church endorsement, issue editorial decisions or invent patristic quotes. If evidence is insufficient, provide grounded findings and explicitly say what is missing; link-only records produce references, not source-derived summaries.

Keep raw prompts, personal questions, model outputs and usage analytics private by default, with deletion/retention rules. No automatic writing from Q&A into the public knowledge graph.

## UI composition

Default screen: one prominent question input, with response in conversational language and inline numbered source references.

For each answer provide a concise answer, `why these passages`, `what named interpreters say`, alternative readings where relevant, exact linked sources, and expand-to-read biblical chapter/parallel verses. Each source card shows provenance and whether content was fetched or only linked. Optional filters: tradition, Bible edition, authors, period, original language, only reviewed sources. A user can switch from the answer to verse-reader or debate/claim explorer.

## Delivery sequence / gates

| Stage | Deliverable | Definition of done |
| --- | --- | --- |
| A (immediate) | ADR and direct link-only verse registry for Azbyka with verified URL normalization | No copying content; link matches actual reference; tested; can coexist with M1 |
| B | Federated source providers and evidence pack API with cached metadata | Provider timeouts, safe HTML parsing only where permitted, provenance, fail-closed rights, no private-content leaks |
| C | Server-side AI answer endpoint, streaming and evidence/citation validator | Answer from vetted evidence; insufficient evidence means no fabricated claim; mock-model tests and E2E |
| D | Permissioned metadata/bulk feed or negotiated API from Azbyka and other publishers | Rights and volume approved, import idempotent and measurable, no destructive reimport |
| E | Parallel passages + claim/debate map, evaluation sets and editorial curation | Precision/relevance/factuality testing, source coverage and operator controls; production release separately approved |

Stage A implementation: `lib/external-commentary.ts`, verse-page external link, unit tests and desktop/mobile E2E; limited to the five distinct Bible books in the current M1 pilot. On-demand external scraping, AI answering and batch index import are **not implemented** by this change.

Milestone A does not require scraping or storing full text. Stages B/C can proceed with public-domain data and link-only external metadata while permissioned imports are negotiated. Production rollout remains gated by real-domain tests and separately approved infrastructure.

## Evaluation / abuse constraints

Test queries: exact references (John 1:1, John 3:16), ambiguous Russian names/editions, Psalm numbering, multi-verse exegesis, attributed author positions, known disagreement, no available evidence, unreachable third-party site, deliberate prompt injection in source HTML, unsupported copyright, duplicate documents and excessive search fan-out. Track citation support, false attribution, source diversity, p95 latency and cost. No unbounded crawl, proxy open redirect, SSRF, unsafe URL or arbitrary outbound fetch.

# Public-domain Russian starter corpus

This is a small, explicit **35-verse Russian-language demonstration corpus**, not
an entire Bible or an authoritative set of theological interpretations. It adds no
invented questions, claims, interpretations, popularity or editorial approval.

## Source and rights evidence

- Edition: **Синодальный перевод**, publisher-hosted `russyn` edition at
  <https://ebible.org/russyn/>.
- Primary rights evidence: <https://ebible.org/russyn/copyright.htm>. The publisher
  labels this edition “Public Domain” and identifies the language as Russian.
  Both the page and selected chapters were actually fetched on 2026-10-09.
- The source's copyright page reports source files dated 2025-12-12. The manifest
  identifies that digital edition; it does not assert that it is a facsimile of a
  particular historical printed edition.
- Text is taken from eBible.org, **not Azbyka**. No commentary, other edition,
  decorative asset, stylesheet or font is imported or licensed by this declaration.
- `fixtures/ingestion/legal-seed-snapshots.json` preserves the exact retrieved
  HTML bytes as base64, the exact retrieval URLs and SHA-256 for each response.
  It includes the rights page so its evidence is auditable without network access.
- `source.checksum` in `legal-seed-russyn.json` is the SHA-256 of the complete
  UTF-8 snapshot JSON file, including its final newline. Per-document checksums
  are hashes of decoded **original response bytes**, not normalized verse text.
- `source.fetchedAt`: `2026-10-09T08:36:11Z`; parser version:
  `symphony-ebible-html-excerpt/1.0.0`.

The publisher's public-domain declaration is the permission evidence for this
specific text. This is not a blanket assertion about all Synodal editions or
about other material hosted by the publisher.

## Deterministic extraction

The v1 excerpt parser identifies `<span class="verse" id="Vn">…</span>`
markers, takes the text through the next marker (or the trailing navigation for
the last verse), removes HTML tags, decodes entities and collapses whitespace.
It does **not** modernize spelling, repair apparent source typos, translate text,
renumber verses or import chapter headings into the verse body. Tests replay
this extraction directly against the checked-in bytes and compare every verse.

Every passage has a stable edition-specific import key and an exact chapter URL
with `#Vn` locator. Work and passage language are explicitly `ru`. The selected
text is:

| Book | Source | Included verses |
| --- | --- | --- |
| Бытие | <https://ebible.org/russyn/GEN01.htm> | 1:1–5 |
| Псалтырь | <https://ebible.org/russyn/PSA022.htm> | 22:1–6 |
| Евангелие от Иоанна | <https://ebible.org/russyn/JHN01.htm> | 1:1–5, 14 |
| Евангелие от Иоанна | <https://ebible.org/russyn/JHN03.htm> | 3:16–18 |
| Послание к Ефесянам | <https://ebible.org/russyn/EPH04.htm> | 4:11–16, 26, 29, 32 |
| Первое послание к Коринфянам | <https://ebible.org/russyn/1CO13.htm> | 13:4–8, 13 |

Psalm numbering is preserved exactly as this edition supplies it: “Господь -
Пастырь мой” is **Ps.22.1**, not the Ps.23.1 address found in some other editions.
Reference normalization never silently changes numbering.

## Import and publication

```sh
npm run ingest:json -- fixtures/ingestion/legal-seed-russyn.json
```

Import is idempotent and does **not** publish text: records start in DRAFT.
Use the trusted operator publication workflow after source review. Do not run the
snapshot JSON through the importer; it is evidence, not an ingestion manifest.
Never import a second edition into the current global OSIS identity. The importer
must reject an existing verse bound to a different passage rather than overwrite
it. Multi-edition support requires edition/versification-scoped identities first.

## Smoke searches after explicit publication

- `Быт. 1:1` → Gen.1.1
- `John.3.16`, `Ин 3:16`, `Евангелие от Иоанна 3:16` → John.3.16
- `1 Кор 13:4`, `1Cor.13.4` → 1Cor.13.4
- `Пс 22:1` → Ps.22.1 in this edition
- `Еф 4:14` → Eph.4.14
- `где сказано про ветры учения?` → Eph.4.14 by Russian stem overlap
- `сотворил небо землю` → Gen.1.1 without an exact phrase match
- `любовь не завидует` → 1Cor.13.4 with phrase priority
- `% _ !!!` → empty; punctuation is never a SQL wildcard

## Search scope and limits

Search uses PostgreSQL's built-in Russian/English full-text dictionaries for
inflected words, normalized phrase priority, distinct matched-lexeme coverage,
and `ts_rank_cd` as a tie-breaker. The SQL is parameterized. It retrieves at most
12 candidates of each kind and hydrates only those IDs; it does not pull the
corpus into application memory. Statements time out after two seconds, source
text considered for a hit is capped at 32,000 characters, input at 300 characters
and 12 distinct query terms. Same-chapter reference ranges accept at most 50
verses and return the first 12; cross-chapter ranges are not supported.

Published, rights-cleared matching verses can also retrieve their linked reviewed
questions, claims and exact source fragments. Candidate and hydration queries
both enforce publication/provenance guards. Nested unpublished passages are
filtered. Question popularity is aggregated separately and cannot outrank text.

This is lexical recall, not semantic search, typo correction or a doctrinal
answer engine. It cannot infer synonyms absent from the text. Full-text
expressions currently scan eligible source text, so a larger production corpus
will need matching indexed tsvectors and measured query plans. The small release
is time-bounded; it does not claim indexed full-corpus scalability.

Technical references:
<https://www.postgresql.org/docs/current/textsearch-controls.html> and
<https://www.postgresql.org/docs/current/textsearch-dictionaries.html>.

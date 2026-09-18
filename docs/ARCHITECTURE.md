# Symphony canonical architecture

## One graph, distinct corpora

Symphony is one provenance-first knowledge graph, while Scripture, patristic works, councils, confessional documents, other religious traditions, media and debates remain distinct corpus types.

Canonical content path:

`Corpus -> Work -> Passage`

A Passage is the addressable unit. It may be a verse, paragraph, section, quotation or media segment. Scripture verses have a specialized `Verse` index with OSIS identity.

## Knowledge path

`Passage -> Interpretation -> Topic -> Claim -> Argument -> Objection -> Response -> SourceFragment -> Person -> EditorialDecision`

A claim is never treated as “what an entire religion thinks” without attribution. It may point to a person, tradition, exact source fragment and related passages/topics.

The debate map used by “Путь истины” is:

`question/thesis -> passages -> interpretations -> claims -> arguments/evidence -> objections -> responses -> current status -> primary sources`

Claim status records agreement/disagreement without flattening it into a binary verdict: ASSERTED, AGREED, DISPUTED, PARTIAL, DIVERGENT_DEFINITION, DIVERGENT_TEXT, UNRESOLVED, SUPERSEDED.

## Verse page

1. text, edition and context;
2. parallel passages;
3. interpretations with provenance;
4. frequently asked questions;
5. “Путь истины”;
6. disagreement/debate map;
7. exact primary-source fragments and provenance.

## Questions are knowledge

A user query is not only a transient search log. After normalization/deduplication it can become a canonical Question node and link to multiple passages/topics. PopularitySignal is aggregated separately so frequently asked questions can surface on verse/topic pages without publishing personal raw query data.

## Media

Video/audio is not a detached content silo. It is decomposed into addressable Passage/SourceFragment segments with time locators, then linked to claims, topics, Scripture passages, cited sources, objections and responses.

## AI boundary

AI is a retrieval/linking/extraction assistant over the verified corpus. It must not silently invent theological provenance. Source-backed assertions in the product must resolve to exact corpus/source fragments. AI-generated summaries are derivative content and must be marked as such when introduced.

# Unified search contract

One input accepts: exact Scripture reference, approximate quotation, natural-language question, or an attributed claim such as “мне сказали, что…”.

M1 pipeline:
1. normalize query;
2. detect Scripture references;
3. lexical search over verses/work sections/questions;
4. retrieve linked Question/Interpretation/Claim nodes;
5. rank popular questions separately from textual relevance;
6. render provenance for every source-backed result.

Semantic/vector retrieval is an additive recall layer, never a provenance substitute. User questions may be promoted into canonical Question nodes after normalization/deduplication; raw personal query text is not published by default.

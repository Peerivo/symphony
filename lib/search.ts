import { Prisma } from "@prisma/client";
import { db } from "./db";
import { publicClaimWhere, publicPassageWhere, publicQuestionWhere, publicSourceFragmentWhere } from "./publication";
import { orderByIds, prepareSearchQuery, SEARCH_RESULT_LIMIT, type SearchQuery } from "./search-query";

type Entity = "verse" | "question" | "claim" | "fragment";
type Candidate = { id: string; passageId: string | null };

// Static identifiers only. All user input and identifiers from retrieved rows are
// bind parameters; never interpolate raw user text into SQL or a LIKE pattern.
function sourceIsPublic(alias: Prisma.Sql) {
  return Prisma.sql`${alias}."rightsStatus" IN ('PUBLIC_DOMAIN', 'LICENSED', 'PERMISSION_GRANTED')
    AND ${alias}."canonicalUrl" IS NOT NULL AND ${alias}."rightsEvidence" IS NOT NULL
    AND ${alias}."fetchedAt" IS NOT NULL AND ${alias}."checksum" IS NOT NULL
    AND ${alias}."parserVersion" IS NOT NULL`;
}

function candidateQuery(plan: SearchQuery, entity: Entity, passageIds: string[] = []) {
  const linkedIds = passageIds.length ? Prisma.join(passageIds) : Prisma.sql`NULL`;
  const definitions = {
    verse: {
      from: Prisma.sql`"Verse" e JOIN "Passage" p ON p.id = e."passageId" JOIN "Source" s ON s.id = p."sourceId"`,
      text: Prisma.sql`p.text`, passage: Prisma.sql`e."passageId"`,
      published: Prisma.sql`p."reviewStatus" = 'PUBLISHED' AND p.locator IS NOT NULL AND ${sourceIsPublic(Prisma.sql`s`)}`,
      linked: Prisma.sql`false`,
    },
    question: {
      from: Prisma.sql`"Question" e`, text: Prisma.sql`e."canonicalText"`, passage: Prisma.sql`NULL::text`,
      published: Prisma.sql`e."reviewStatus" = 'PUBLISHED'`,
      linked: Prisma.sql`EXISTS (SELECT 1 FROM "QuestionPassage" link WHERE link."questionId" = e.id AND link."passageId" IN (${linkedIds}))`,
    },
    claim: {
      from: Prisma.sql`"Claim" e JOIN "SourceFragment" f ON f.id = e."sourceFragmentId" JOIN "Source" s ON s.id = f."sourceId"`,
      text: Prisma.sql`e.text`, passage: Prisma.sql`NULL::text`,
      published: Prisma.sql`e."reviewStatus" = 'PUBLISHED' AND f."reviewStatus" = 'PUBLISHED' AND f.locator IS NOT NULL AND ${sourceIsPublic(Prisma.sql`s`)}`,
      linked: Prisma.sql`EXISTS (SELECT 1 FROM "ClaimPassage" link WHERE link."claimId" = e.id AND link."passageId" IN (${linkedIds}))`,
    },
    fragment: {
      from: Prisma.sql`"SourceFragment" e JOIN "Source" s ON s.id = e."sourceId"`,
      text: Prisma.sql`e."quotedText"`, passage: Prisma.sql`e."passageId"`,
      published: Prisma.sql`e."reviewStatus" = 'PUBLISHED' AND e.locator IS NOT NULL AND ${sourceIsPublic(Prisma.sql`s`)}`,
      linked: Prisma.sql`COALESCE(e."passageId" IN (${linkedIds}), false)`,
    },
  };
  const def = definitions[entity];
  if (entity === "verse" && plan.reference) {
    const ref = plan.reference;
    return Prisma.sql`SELECT e.id, e."passageId" FROM ${def.from}
      WHERE ${def.published} AND e.book = ${ref.book} AND e.chapter = ${ref.chapter}
        AND e.verse BETWEEN ${ref.verse} AND ${ref.endVerse}
      ORDER BY e.verse ASC, e.id ASC LIMIT ${SEARCH_RESULT_LIMIT}`;
  }
  // Built-in PostgreSQL dictionaries provide inflection recall without installing
  // extensions. At least two distinct non-stopword lexemes must overlap for a
  // multi-word query. This avoids returning every verse containing just "Бог".
  return Prisma.sql`
    WITH input AS (
      SELECT ${plan.phrase}::text AS phrase, ${plan.configuration}::regconfig AS config,
        websearch_to_tsquery(${plan.configuration}::regconfig, ${plan.terms.join(" OR ")}) AS term_query,
        tsvector_to_array(to_tsvector(${plan.configuration}::regconfig, ${plan.terms.join(" ")})) AS lexemes
    )
    SELECT e.id, ${def.passage} AS "passageId"
    FROM ${def.from} CROSS JOIN input
    CROSS JOIN LATERAL (
      SELECT to_tsvector(input.config, replace(lower(left(COALESCE(${def.text}, ''), 32000)), 'ё', 'е')) AS document,
        trim(regexp_replace(replace(lower(left(COALESCE(${def.text}, ''), 32000)), 'ё', 'е'), '[^[:alnum:]]+', ' ', 'g')) AS normalized
    ) text_search
    CROSS JOIN LATERAL (
      SELECT (SELECT count(*) FROM unnest(input.lexemes) AS token
        WHERE token = ANY(tsvector_to_array(text_search.document))) AS coverage,
        (${plan.terms.length > 0} AND strpos(' ' || text_search.normalized || ' ', ' ' || input.phrase || ' ') > 0) AS phrase_match,
        ${def.linked} AS linked
    ) relevance
    WHERE ${def.published} AND (
      relevance.linked OR relevance.phrase_match OR
      (text_search.document @@ input.term_query AND relevance.coverage >= greatest(1, least(2, cardinality(input.lexemes))))
    )
    ORDER BY relevance.phrase_match DESC, relevance.linked DESC, relevance.coverage DESC,
      ts_rank_cd(text_search.document, input.term_query, 32) DESC, e.id ASC
    LIMIT ${SEARCH_RESULT_LIMIT}`;
}

export async function searchCorpus(rawQuery: string) {
  const plan = prepareSearchQuery(rawQuery);
  if (!plan) return { verses: [], questions: [], claims: [], fragments: [] };

  // Each statement has a database-side timeout and every candidate list is
  // bounded before hydration. A large corpus cannot be downloaded into Node.
  const candidates = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
    const verses = await tx.$queryRaw<Candidate[]>(candidateQuery(plan, "verse"));
    const passageIds = verses.flatMap((verse) => verse.passageId ? [verse.passageId] : []);
    const questions = await tx.$queryRaw<Candidate[]>(candidateQuery(plan, "question", passageIds));
    const claims = await tx.$queryRaw<Candidate[]>(candidateQuery(plan, "claim", passageIds));
    const fragments = await tx.$queryRaw<Candidate[]>(candidateQuery(plan, "fragment", passageIds));
    return { verses, questions, claims, fragments };
  }, { maxWait: 2000, timeout: 10000 });

  const ids = {
    verses: candidates.verses.map((item) => item.id), questions: candidates.questions.map((item) => item.id),
    claims: candidates.claims.map((item) => item.id), fragments: candidates.fragments.map((item) => item.id),
  };
  // Reapply publication filters during hydration, including nested relation
  // payloads. A publication state change must not expose drafts or blocked text.
  const [verses, questions, claims, fragments, popularity] = await Promise.all([
    db.verse.findMany({
      where: { id: { in: ids.verses }, passage: { is: publicPassageWhere } },
      include: { passage: { include: { source: true, work: { include: { corpus: true } } } } },
      take: SEARCH_RESULT_LIMIT,
    }),
    db.question.findMany({
      where: { AND: [publicQuestionWhere, { id: { in: ids.questions } }] },
      include: { passages: { where: { passage: { is: publicPassageWhere } },
        include: { passage: { include: { verse: true } } }, take: 20, orderBy: { passageId: "asc" } } },
      take: SEARCH_RESULT_LIMIT,
    }),
    db.claim.findMany({
      where: { AND: [publicClaimWhere, { id: { in: ids.claims } }] },
      include: { tradition: true, person: true,
        passages: { where: { passage: { is: publicPassageWhere } },
          include: { passage: { include: { verse: true } } }, take: 20, orderBy: { passageId: "asc" } },
        sourceFragment: { include: { source: true } } },
      take: SEARCH_RESULT_LIMIT,
    }),
    db.sourceFragment.findMany({
      where: { AND: [publicSourceFragmentWhere, { id: { in: ids.fragments } }] },
      include: { source: true, speaker: true,
        passage: { where: publicPassageWhere, include: { verse: true } } },
      take: SEARCH_RESULT_LIMIT,
    }),
    // Aggregate popularity separately. Never use it to outrank textual relevance
    // or load the complete history of signal buckets into the search response.
    db.popularitySignal.groupBy({ by: ["questionId"], where: { questionId: { in: ids.questions } }, _sum: { count: true } }),
  ]);
  const counts = new Map(popularity.map((item) => [item.questionId, item._sum.count ?? 0]));
  return {
    verses: orderByIds(verses, ids.verses),
    questions: orderByIds(questions, ids.questions).map((question) => ({ ...question, signals: [{ count: counts.get(question.id) ?? 0 }] })),
    claims: orderByIds(claims, ids.claims), fragments: orderByIds(fragments, ids.fragments),
  };
}

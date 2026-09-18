-- Symphony M1 canonical corpus graph.
-- Production application is performed by GitHub Actions with prisma migrate deploy.

CREATE TYPE "RightsStatus" AS ENUM ('UNKNOWN','PUBLIC_DOMAIN','LICENSED','PERMISSION_GRANTED','LINK_ONLY','RESTRICTED');
CREATE TYPE "SourceKind" AS ENUM ('SCRIPTURE','PATRISTIC','WORK','COUNCIL','LITURGICAL','COMMENTARY','CONFESSIONAL','TAFSIR','HADITH','ARTICLE','BOOK','MEDIA','USER_QUESTION','OTHER');
CREATE TYPE "CorpusKind" AS ENUM ('SCRIPTURE','PATRISTIC','COUNCIL','LITURGICAL','CONFESSIONAL','COMMENTARY','APOLOGETIC','INTERRELIGIOUS','MEDIA','OTHER');
CREATE TYPE "PassageKind" AS ENUM ('BOOK','CHAPTER','VERSE','SECTION','PARAGRAPH','QUOTE','MEDIA_SEGMENT','OTHER');
CREATE TYPE "LinkKind" AS ENUM ('INTERPRETS','SUPPORTS','OPPOSES','PARALLEL_TO','REFERENCES','CITES','DEFINES','ABOUT','ANSWERS','RESPONDS_TO','RELATED_TO');
CREATE TYPE "ClaimStatus" AS ENUM ('ASSERTED','AGREED','DISPUTED','PARTIAL','DIVERGENT_DEFINITION','DIVERGENT_TEXT','UNRESOLVED','SUPERSEDED');
CREATE TYPE "EditorialRole" AS ENUM ('CONTRIBUTOR','INTAKE_EDITOR','CORPUS_EDITOR','SOURCE_REVIEWER','THEOLOGICAL_REVIEWER','PUBLISHER','ADMIN');
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT','IN_REVIEW','THEOLOGICAL_REVIEW','APPROVED','REJECTED','PUBLISHED','SUPERSEDED');
CREATE TYPE "IngestionStage" AS ENUM ('INTAKE','CLASSIFICATION','EXTRACTION','FRAGMENTATION','LINKING','REVIEW','THEOLOGICAL_REVIEW','PUBLICATION','CORRECTION');
CREATE TYPE "IngestionRunStatus" AS ENUM ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED');

CREATE TABLE "Tradition" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL
);

CREATE TABLE "School" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "traditionId" TEXT NOT NULL REFERENCES "Tradition"("id")
);
CREATE UNIQUE INDEX "School_traditionId_name_key" ON "School"("traditionId","name");

CREATE TABLE "Person" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT UNIQUE,
  "name" TEXT NOT NULL,
  "traditionId" TEXT REFERENCES "Tradition"("id")
);

CREATE TABLE "Source" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "kind" "SourceKind" NOT NULL,
  "canonicalUrl" TEXT UNIQUE,
  "rightsStatus" "RightsStatus" NOT NULL DEFAULT 'UNKNOWN',
  "rightsEvidence" TEXT,
  "license" TEXT,
  "fetchedAt" TIMESTAMP(3),
  "checksum" TEXT,
  "parserVersion" TEXT
);

CREATE TABLE "Corpus" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "kind" "CorpusKind" NOT NULL,
  "language" TEXT,
  "traditionId" TEXT REFERENCES "Tradition"("id"),
  "sourceId" TEXT REFERENCES "Source"("id")
);

CREATE TABLE "Work" (
  "id" TEXT PRIMARY KEY,
  "corpusId" TEXT NOT NULL REFERENCES "Corpus"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "importKey" TEXT UNIQUE,
  "authorId" TEXT REFERENCES "Person"("id"),
  "sourceId" TEXT REFERENCES "Source"("id"),
  "language" TEXT,
  "edition" TEXT,
  "publishedYear" INTEGER
);
CREATE INDEX "Work_corpusId_title_idx" ON "Work"("corpusId","title");

CREATE TABLE "Passage" (
  "id" TEXT PRIMARY KEY,
  "workId" TEXT NOT NULL REFERENCES "Work"("id") ON DELETE CASCADE,
  "importKey" TEXT UNIQUE,
  "parentId" TEXT REFERENCES "Passage"("id"),
  "sourceId" TEXT REFERENCES "Source"("id"),
  "ordinal" INTEGER NOT NULL,
  "kind" "PassageKind" NOT NULL DEFAULT 'PARAGRAPH',
  "heading" TEXT,
  "text" TEXT NOT NULL,
  "locator" TEXT,
  "language" TEXT
);
CREATE INDEX "Passage_workId_ordinal_idx" ON "Passage"("workId","ordinal");
CREATE INDEX "Passage_kind_idx" ON "Passage"("kind");

CREATE TABLE "Verse" (
  "id" TEXT PRIMARY KEY,
  "passageId" TEXT NOT NULL UNIQUE REFERENCES "Passage"("id") ON DELETE CASCADE,
  "osis" TEXT NOT NULL UNIQUE,
  "book" TEXT NOT NULL,
  "chapter" INTEGER NOT NULL,
  "verse" INTEGER NOT NULL
);
CREATE INDEX "Verse_book_chapter_verse_idx" ON "Verse"("book","chapter","verse");

CREATE TABLE "SourceFragment" (
  "id" TEXT PRIMARY KEY,
  "passageId" TEXT REFERENCES "Passage"("id"),
  "sourceId" TEXT REFERENCES "Source"("id"),
  "speakerId" TEXT REFERENCES "Person"("id"),
  "quotedText" TEXT,
  "locator" TEXT,
  "startChar" INTEGER,
  "endChar" INTEGER,
  "startSeconds" INTEGER,
  "endSeconds" INTEGER,
  "pageFrom" INTEGER,
  "pageTo" INTEGER,
  "checksum" TEXT
);
CREATE INDEX "SourceFragment_passageId_idx" ON "SourceFragment"("passageId");
CREATE INDEX "SourceFragment_sourceId_idx" ON "SourceFragment"("sourceId");

CREATE TABLE "Interpretation" (
  "id" TEXT PRIMARY KEY,
  "passageId" TEXT NOT NULL REFERENCES "Passage"("id") ON DELETE CASCADE,
  "traditionId" TEXT REFERENCES "Tradition"("id"),
  "personId" TEXT REFERENCES "Person"("id"),
  "sourceFragmentId" TEXT REFERENCES "SourceFragment"("id"),
  "summary" TEXT
);
CREATE INDEX "Interpretation_passageId_idx" ON "Interpretation"("passageId");
CREATE INDEX "Interpretation_traditionId_idx" ON "Interpretation"("traditionId");

CREATE TABLE "Topic" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "description" TEXT
);

CREATE TABLE "Question" (
  "id" TEXT PRIMARY KEY,
  "canonicalText" TEXT NOT NULL,
  "normalizedKey" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "QuestionPassage" (
  "questionId" TEXT NOT NULL REFERENCES "Question"("id") ON DELETE CASCADE,
  "passageId" TEXT NOT NULL REFERENCES "Passage"("id") ON DELETE CASCADE,
  "relevance" DOUBLE PRECISION NOT NULL DEFAULT 1,
  PRIMARY KEY("questionId","passageId")
);

CREATE TABLE "QuestionTopic" (
  "questionId" TEXT NOT NULL REFERENCES "Question"("id") ON DELETE CASCADE,
  "topicId" TEXT NOT NULL REFERENCES "Topic"("id") ON DELETE CASCADE,
  "relevance" DOUBLE PRECISION NOT NULL DEFAULT 1,
  PRIMARY KEY("questionId","topicId")
);

CREATE TABLE "Claim" (
  "id" TEXT PRIMARY KEY,
  "text" TEXT NOT NULL,
  "status" "ClaimStatus" NOT NULL DEFAULT 'ASSERTED',
  "traditionId" TEXT REFERENCES "Tradition"("id"),
  "personId" TEXT REFERENCES "Person"("id"),
  "sourceFragmentId" TEXT REFERENCES "SourceFragment"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

CREATE TABLE "ClaimPassage" (
  "claimId" TEXT NOT NULL REFERENCES "Claim"("id") ON DELETE CASCADE,
  "passageId" TEXT NOT NULL REFERENCES "Passage"("id") ON DELETE CASCADE,
  "relevance" DOUBLE PRECISION NOT NULL DEFAULT 1,
  PRIMARY KEY("claimId","passageId")
);

CREATE TABLE "ClaimTopic" (
  "claimId" TEXT NOT NULL REFERENCES "Claim"("id") ON DELETE CASCADE,
  "topicId" TEXT NOT NULL REFERENCES "Topic"("id") ON DELETE CASCADE,
  "relevance" DOUBLE PRECISION NOT NULL DEFAULT 1,
  PRIMARY KEY("claimId","topicId")
);

CREATE TABLE "Argument" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT NOT NULL REFERENCES "Claim"("id") ON DELETE CASCADE,
  "text" TEXT NOT NULL,
  "personId" TEXT REFERENCES "Person"("id"),
  "sourceFragmentId" TEXT REFERENCES "SourceFragment"("id")
);
CREATE INDEX "Argument_claimId_idx" ON "Argument"("claimId");

CREATE TABLE "Objection" (
  "id" TEXT PRIMARY KEY,
  "claimId" TEXT NOT NULL REFERENCES "Claim"("id") ON DELETE CASCADE,
  "text" TEXT NOT NULL,
  "personId" TEXT REFERENCES "Person"("id"),
  "sourceFragmentId" TEXT REFERENCES "SourceFragment"("id"),
  "unresolved" BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX "Objection_claimId_idx" ON "Objection"("claimId");

CREATE TABLE "Response" (
  "id" TEXT PRIMARY KEY,
  "objectionId" TEXT NOT NULL REFERENCES "Objection"("id") ON DELETE CASCADE,
  "text" TEXT NOT NULL,
  "personId" TEXT REFERENCES "Person"("id"),
  "sourceFragmentId" TEXT REFERENCES "SourceFragment"("id")
);
CREATE INDEX "Response_objectionId_idx" ON "Response"("objectionId");

CREATE TABLE "KnowledgeLink" (
  "id" TEXT PRIMARY KEY,
  "fromType" TEXT NOT NULL,
  "fromId" TEXT NOT NULL,
  "toType" TEXT NOT NULL,
  "toId" TEXT NOT NULL,
  "kind" "LinkKind" NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "evidence" TEXT
);
CREATE INDEX "KnowledgeLink_fromType_fromId_idx" ON "KnowledgeLink"("fromType","fromId");
CREATE INDEX "KnowledgeLink_toType_toId_idx" ON "KnowledgeLink"("toType","toId");

CREATE TABLE "PopularitySignal" (
  "id" TEXT PRIMARY KEY,
  "questionId" TEXT NOT NULL REFERENCES "Question"("id") ON DELETE CASCADE,
  "bucket" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX "PopularitySignal_questionId_bucket_key" ON "PopularitySignal"("questionId","bucket");

CREATE TABLE "PersonEditorialRole" (
  "id" TEXT PRIMARY KEY,
  "personId" TEXT NOT NULL REFERENCES "Person"("id") ON DELETE CASCADE,
  "corpusId" TEXT REFERENCES "Corpus"("id") ON DELETE CASCADE,
  "role" "EditorialRole" NOT NULL
);
CREATE INDEX "PersonEditorialRole_personId_role_idx" ON "PersonEditorialRole"("personId","role");
CREATE INDEX "PersonEditorialRole_corpusId_role_idx" ON "PersonEditorialRole"("corpusId","role");

CREATE TABLE "EditorialDecision" (
  "id" TEXT PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "reviewerId" TEXT REFERENCES "Person"("id"),
  "status" "ReviewStatus" NOT NULL,
  "reason" TEXT,
  "evidence" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EditorialDecision_entityType_entityId_idx" ON "EditorialDecision"("entityType","entityId");
CREATE INDEX "EditorialDecision_status_idx" ON "EditorialDecision"("status");

CREATE TABLE "Submission" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT,
  "sourceUrl" TEXT,
  "notes" TEXT,
  "submittedByPersonId" TEXT REFERENCES "Person"("id"),
  "sourceId" TEXT REFERENCES "Source"("id"),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "IngestionRun" (
  "id" TEXT PRIMARY KEY,
  "submissionId" TEXT REFERENCES "Submission"("id") ON DELETE SET NULL,
  "sourceId" TEXT REFERENCES "Source"("id"),
  "stage" "IngestionStage" NOT NULL,
  "status" "IngestionRunStatus" NOT NULL DEFAULT 'QUEUED',
  "parserVersion" TEXT,
  "rawChecksum" TEXT,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "IngestionRun_stage_status_idx" ON "IngestionRun"("stage","status");

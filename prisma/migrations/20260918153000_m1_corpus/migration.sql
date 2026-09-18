-- M1 initial corpus schema.
-- Generated from the canonical Prisma model; production application is GitHub Actions only.
CREATE TYPE "RightsStatus" AS ENUM ('UNKNOWN','PUBLIC_DOMAIN','LICENSED','PERMISSION_GRANTED','LINK_ONLY','RESTRICTED');
CREATE TYPE "SourceKind" AS ENUM ('SCRIPTURE','PATRISTIC','WORK','COUNCIL','LITURGICAL','COMMENTARY','CONFESSIONAL','TAFSIR','HADITH','ARTICLE','BOOK','USER_QUESTION','OTHER');
CREATE TYPE "LinkKind" AS ENUM ('INTERPRETS','SUPPORTS','OPPOSES','PARALLEL_TO','REFERENCES','ABOUT','ANSWERS','RELATED_TO');
CREATE TABLE "Tradition" ("id" TEXT PRIMARY KEY,"name" TEXT NOT NULL UNIQUE);
CREATE TABLE "School" ("id" TEXT PRIMARY KEY,"name" TEXT NOT NULL,"traditionId" TEXT NOT NULL REFERENCES "Tradition"("id"));
CREATE UNIQUE INDEX "School_traditionId_name_key" ON "School"("traditionId","name");
CREATE TABLE "Author" ("id" TEXT PRIMARY KEY,"name" TEXT NOT NULL,"traditionId" TEXT REFERENCES "Tradition"("id"));
CREATE TABLE "Source" ("id" TEXT PRIMARY KEY,"name" TEXT NOT NULL,"kind" "SourceKind" NOT NULL,"canonicalUrl" TEXT,"rightsStatus" "RightsStatus" NOT NULL DEFAULT 'UNKNOWN',"rightsEvidence" TEXT,"license" TEXT,"fetchedAt" TIMESTAMP(3),"checksum" TEXT,"parserVersion" TEXT);
CREATE TABLE "Work" ("id" TEXT PRIMARY KEY,"title" TEXT NOT NULL,"authorId" TEXT REFERENCES "Author"("id"),"sourceId" TEXT NOT NULL REFERENCES "Source"("id"),"language" TEXT);
CREATE TABLE "WorkSection" ("id" TEXT PRIMARY KEY,"workId" TEXT NOT NULL REFERENCES "Work"("id") ON DELETE CASCADE,"parentId" TEXT REFERENCES "WorkSection"("id"),"ordinal" INTEGER NOT NULL,"heading" TEXT,"text" TEXT NOT NULL,"locator" TEXT);
CREATE INDEX "WorkSection_workId_ordinal_idx" ON "WorkSection"("workId","ordinal");
CREATE TABLE "Verse" ("id" TEXT PRIMARY KEY,"osis" TEXT NOT NULL UNIQUE,"book" TEXT NOT NULL,"chapter" INTEGER NOT NULL,"verse" INTEGER NOT NULL,"text" TEXT NOT NULL,"edition" TEXT,"sourceId" TEXT REFERENCES "Source"("id"));
CREATE INDEX "Verse_book_chapter_verse_idx" ON "Verse"("book","chapter","verse");
CREATE TABLE "Interpretation" ("id" TEXT PRIMARY KEY,"verseId" TEXT REFERENCES "Verse"("id"),"sectionId" TEXT NOT NULL REFERENCES "WorkSection"("id"),"traditionId" TEXT REFERENCES "Tradition"("id"),"summary" TEXT);
CREATE INDEX "Interpretation_verseId_idx" ON "Interpretation"("verseId");
CREATE TABLE "Question" ("id" TEXT PRIMARY KEY,"canonicalText" TEXT NOT NULL,"normalizedKey" TEXT NOT NULL UNIQUE,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "QuestionVerse" ("questionId" TEXT NOT NULL REFERENCES "Question"("id") ON DELETE CASCADE,"verseId" TEXT NOT NULL REFERENCES "Verse"("id") ON DELETE CASCADE,"relevance" DOUBLE PRECISION NOT NULL DEFAULT 1,PRIMARY KEY("questionId","verseId"));
CREATE TABLE "Claim" ("id" TEXT PRIMARY KEY,"text" TEXT NOT NULL,"traditionId" TEXT REFERENCES "Tradition"("id"),"sourceSectionId" TEXT);
CREATE TABLE "KnowledgeLink" ("id" TEXT PRIMARY KEY,"fromType" TEXT NOT NULL,"fromId" TEXT NOT NULL,"toType" TEXT NOT NULL,"toId" TEXT NOT NULL,"kind" "LinkKind" NOT NULL,"weight" DOUBLE PRECISION NOT NULL DEFAULT 1,"evidence" TEXT);
CREATE INDEX "KnowledgeLink_fromType_fromId_idx" ON "KnowledgeLink"("fromType","fromId");
CREATE INDEX "KnowledgeLink_toType_toId_idx" ON "KnowledgeLink"("toType","toId");
CREATE TABLE "PopularitySignal" ("id" TEXT PRIMARY KEY,"questionId" TEXT NOT NULL REFERENCES "Question"("id") ON DELETE CASCADE,"bucket" TIMESTAMP(3) NOT NULL,"count" INTEGER NOT NULL DEFAULT 1);
CREATE UNIQUE INDEX "PopularitySignal_questionId_bucket_key" ON "PopularitySignal"("questionId","bucket");

-- AlterTable
ALTER TABLE "Passage" ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Interpretation" ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Argument" ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Objection" ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "SourceFragment" ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "IntakeBudget" (
    "key" TEXT NOT NULL,
    "bucket" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "IntakeBudget_pkey" PRIMARY KEY ("key")
);


-- Server-only database access; protect against accidental Supabase Data API exposure.
ALTER TABLE "Tradition" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Tradition" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Tradition" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Tradition" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "School" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "School" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "School" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "School" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "Person" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Person" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Person" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Person" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "Source" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Source" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Source" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Source" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "Corpus" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Corpus" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Corpus" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Corpus" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "Work" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Work" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Work" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Work" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "Passage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Passage" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Passage" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Passage" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "Verse" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Verse" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Verse" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Verse" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "Interpretation" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Interpretation" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Interpretation" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Interpretation" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "Topic" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Topic" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Topic" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Topic" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "Question" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Question" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Question" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Question" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "QuestionPassage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "QuestionPassage" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "QuestionPassage" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "QuestionPassage" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "QuestionTopic" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "QuestionTopic" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "QuestionTopic" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "QuestionTopic" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "Claim" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Claim" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Claim" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Claim" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "ClaimPassage" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ClaimPassage" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "ClaimPassage" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "ClaimPassage" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "ClaimTopic" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "ClaimTopic" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "ClaimTopic" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "ClaimTopic" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "Argument" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Argument" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Argument" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Argument" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "Objection" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Objection" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Objection" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Objection" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "Response" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Response" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Response" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Response" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "SourceFragment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "SourceFragment" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "SourceFragment" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "SourceFragment" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "KnowledgeLink" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "KnowledgeLink" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "KnowledgeLink" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "KnowledgeLink" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "PopularitySignal" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PopularitySignal" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "PopularitySignal" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "PopularitySignal" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "PersonEditorialRole" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PersonEditorialRole" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "PersonEditorialRole" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "PersonEditorialRole" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "EditorialDecision" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "EditorialDecision" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "EditorialDecision" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "EditorialDecision" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "Submission" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "Submission" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "Submission" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "Submission" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "IngestionRun" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "IngestionRun" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "IngestionRun" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "IngestionRun" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "PassagePopularitySignal" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "PassagePopularitySignal" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "PassagePopularitySignal" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "PassagePopularitySignal" FROM authenticated;
  END IF;
END $$;
ALTER TABLE "IntakeBudget" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "IntakeBudget" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "IntakeBudget" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "IntakeBudget" FROM authenticated;
  END IF;
END $$;

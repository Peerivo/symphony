import type { Prisma } from "@prisma/client";

// Public reads fail closed. Importing data never publishes it.
export const publicSourceWhere = {
  rightsStatus: { in: ["PUBLIC_DOMAIN", "LICENSED", "PERMISSION_GRANTED"] },
  canonicalUrl: { not: null }, rightsEvidence: { not: null },
  fetchedAt: { not: null }, checksum: { not: null }, parserVersion: { not: null },
} satisfies Prisma.SourceWhereInput;
export const publicPassageWhere = {
  reviewStatus: "PUBLISHED", locator: { not: null }, source: { is: publicSourceWhere },
} satisfies Prisma.PassageWhereInput;
export const publicQuestionWhere = { reviewStatus: "PUBLISHED" } satisfies Prisma.QuestionWhereInput;
export const publicSourceFragmentWhere = {
  reviewStatus: "PUBLISHED", locator: { not: null }, source: { is: publicSourceWhere },
} satisfies Prisma.SourceFragmentWhereInput;
export const publicClaimWhere = {
  reviewStatus: "PUBLISHED", sourceFragment: { is: publicSourceFragmentWhere },
} satisfies Prisma.ClaimWhereInput;
export const publicInterpretationWhere = {
  reviewStatus: "PUBLISHED", sourceFragment: { is: publicSourceFragmentWhere },
} satisfies Prisma.InterpretationWhereInput;
export const publicArgumentWhere = {
  reviewStatus: "PUBLISHED", sourceFragment: { is: publicSourceFragmentWhere },
} satisfies Prisma.ArgumentWhereInput;
export const publicObjectionWhere = {
  reviewStatus: "PUBLISHED", sourceFragment: { is: publicSourceFragmentWhere },
} satisfies Prisma.ObjectionWhereInput;
export const publicResponseWhere = {
  reviewStatus: "PUBLISHED", sourceFragment: { is: publicSourceFragmentWhere },
} satisfies Prisma.ResponseWhereInput;

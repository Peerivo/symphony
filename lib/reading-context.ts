import { db } from "./db";
import { publicPassageWhere } from "./publication";

export const CONTEXT_RADIUS = 2;

type VerseAddress = {
  book: string;
  chapter: number;
  verse: number;
  passage: { workId: string };
};

// The range is numeric, not a promise that every verse of a chapter is available.
export function contextBounds(verse: number) {
  return { gte: Math.max(1, verse - CONTEXT_RADIUS), lte: verse + CONTEXT_RADIUS };
}

// Both the source and the editorial status must pass the same public gate as
// the main verse page. Matching book/chapter alone can cross editions/works.
export async function getPublishedVerseContext(current: VerseAddress) {
  return db.verse.findMany({
    where: {
      book: current.book,
      chapter: current.chapter,
      verse: contextBounds(current.verse),
      passage: { is: { ...publicPassageWhere, workId: current.passage.workId } },
    },
    select: {
      osis: true,
      verse: true,
      passage: { select: { text: true } },
    },
    orderBy: { verse: "asc" },
    take: CONTEXT_RADIUS * 2 + 1,
  });
}

export function adjacentPublishedVerses<T extends { verse: number }>(
  context: readonly T[],
  currentVerse: number,
) {
  return {
    previous: context.find((item) => item.verse === currentVerse - 1) ?? null,
    next: context.find((item) => item.verse === currentVerse + 1) ?? null,
  };
}

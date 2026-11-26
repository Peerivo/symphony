/**
 * Link-only source adapter: metadata and navigation, never remote HTML retrieval.
 * M1 has verified the canonical URL pattern for each supported pilot book.
 * A generated per-verse link is NOT an assertion that commentary is present.
 */
const AZBYKA_PILOT_BOOKS: Readonly<Record<string, string>> = Object.freeze({
  Gen: "Gen",
  Ps: "Ps",
  John: "Jn",
  Eph: "Eph",
  "1Cor": "1Cor",
});

export type CommentaryReference = {
  provider: "azbyka";
  mode: "LINK_ONLY";
  url: string;
  sourceLabel: string;
};

/** Returns null for unknown/unsupported/unsafe references. */
export function externalCommentaryForVerse(osis: string): CommentaryReference | null {
  const match = /^([1-3]?[A-Za-z]+)\.([1-9]\d{0,2})\.([1-9]\d{0,2})$/.exec(osis);
  if (!match) return null;
  const book = AZBYKA_PILOT_BOOKS[match[1]];
  if (!book) return null;
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  if (!Number.isSafeInteger(chapter) || !Number.isSafeInteger(verse)) return null;
  return {
    provider: "azbyka",
    mode: "LINK_ONLY",
    sourceLabel: "Азбука веры",
    url: `https://azbyka.ru/biblia/in/?${book}.${chapter}:${verse}=`,
  };
}

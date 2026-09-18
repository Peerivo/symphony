import { db } from "./db";

const BOOK_ALIASES: Record<string,string> = {
  "пс": "Ps",
  "пс.": "Ps",
  "псалом": "Ps",
  "еф": "Eph",
  "еф.": "Eph",
  "ефесянам": "Eph",
  "ин": "John",
  "ин.": "John",
  "иоанна": "John",
};

function osisFromQuery(query: string) {
  const match = query.trim().toLocaleLowerCase("ru").match(/^([а-яё.]+)\s*(\d+)\s*[:.,]\s*(\d+)$/i);
  if (!match) return null;
  const book = BOOK_ALIASES[match[1]];
  return book ? `${book}.${match[2]}.${match[3]}` : null;
}

export async function searchCorpus(rawQuery: string) {
  const query = rawQuery.trim();
  if (query.length < 2) return { verses: [], questions: [], claims: [], fragments: [] };

  const osis = osisFromQuery(query);

  const [verses, questions, claims, fragments] = await Promise.all([
    db.verse.findMany({
      where: {
        OR: [
          ...(osis ? [{ osis }] : []),
          { osis: { contains: query, mode: "insensitive" } },
          { passage: { is: { text: { contains: query, mode: "insensitive" } } } },
        ],
      },
      include: { passage: { include: { work: { include: { corpus: true } } } } },
      take: 12,
    }),
    db.question.findMany({
      where: { canonicalText: { contains: query, mode: "insensitive" } },
      include: { passages: { include: { passage: { include: { verse: true } } } }, signals: true },
      take: 12,
    }),
    db.claim.findMany({
      where: { text: { contains: query, mode: "insensitive" } },
      include: {
        tradition: true,
        person: true,
        passages: { include: { passage: { include: { verse: true } } } },
        sourceFragment: { include: { source: true } },
      },
      take: 12,
    }),
    db.sourceFragment.findMany({
      where: { quotedText: { contains: query, mode: "insensitive" } },
      include: { source: true, speaker: true, passage: { include: { verse: true } } },
      take: 12,
    }),
  ]);

  return { verses, questions, claims, fragments };
}

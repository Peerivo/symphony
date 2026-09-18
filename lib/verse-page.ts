import { db } from "./db";

export async function getVersePage(osis: string) {
  const verse = await db.verse.findUnique({
    where: { osis },
    include: {
      passage: {
        include: {
          work: {
            include: {
              corpus: true,
              author: true,
              source: true,
            },
          },
          source: true,
          interpretations: {
            include: {
              tradition: true,
              person: true,
              sourceFragment: { include: { source: true } },
            },
          },
          questionLinks: {
            include: {
              question: { include: { signals: true, topics: { include: { topic: true } } } },
            },
          },
          claimLinks: {
            include: {
              claim: {
                include: {
                  tradition: true,
                  person: true,
                  sourceFragment: { include: { source: true } },
                  arguments: {
                    include: { person: true, sourceFragment: { include: { source: true } } },
                  },
                  objections: {
                    include: {
                      person: true,
                      sourceFragment: { include: { source: true } },
                      responses: {
                        include: { person: true, sourceFragment: { include: { source: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!verse) return null;

  const questions = verse.passage.questionLinks
    .map((link) => ({
      ...link.question,
      relevance: link.relevance,
      popularity: link.question.signals.reduce((sum, signal) => sum + signal.count, 0),
    }))
    .sort((a, b) => b.popularity - a.popularity || b.relevance - a.relevance);

  return { ...verse, questions };
}

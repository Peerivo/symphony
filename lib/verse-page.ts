import { db } from "./db";
import { publicPassageWhere, publicQuestionWhere, publicInterpretationWhere, publicClaimWhere, publicArgumentWhere, publicObjectionWhere, publicResponseWhere } from "./publication";

export async function getVersePage(osis: string) {
  const verse = await db.verse.findFirst({
    where: { osis, passage: { is: publicPassageWhere } },
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
            where: publicInterpretationWhere,
            include: {
              tradition: true,
              person: true,
              sourceFragment: { include: { source: true } },
            },
          },
          questionLinks: {
            where: { question: { is: publicQuestionWhere } },
            include: {
              question: { include: { signals: true, topics: { include: { topic: true } } } },
            },
          },
          claimLinks: {
            where: { claim: { is: publicClaimWhere } },
            include: {
              claim: {
                include: {
                  tradition: true,
                  person: true,
                  sourceFragment: { include: { source: true } },
                  arguments: {
                    where: publicArgumentWhere,
                    include: { person: true, sourceFragment: { include: { source: true } } },
                  },
                  objections: {
                    where: publicObjectionWhere,
                    include: {
                      person: true,
                      sourceFragment: { include: { source: true } },
                      responses: {
                        where: publicResponseWhere,
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

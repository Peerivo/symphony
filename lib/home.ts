import { db } from "./db";
import { publicPassageWhere, publicQuestionWhere } from "./publication";

export async function getHomeHighlights() {
  const [questionGroups, passageGroups] = await Promise.all([
    db.popularitySignal.groupBy({
      by: ["questionId"],
      where: { question: { is: publicQuestionWhere } },
      _sum: { count: true },
      orderBy: { _sum: { count: "desc" } },
      take: 8,
    }),
    db.passagePopularitySignal.groupBy({
      by: ["passageId"],
      where: { passage: { is: publicPassageWhere } },
      _sum: { count: true },
      orderBy: { _sum: { count: "desc" } },
      take: 8,
    }),
  ]);

  const [questions, passages] = await Promise.all([
    db.question.findMany({
      where: { ...publicQuestionWhere, id: { in: questionGroups.map(x => x.questionId) } },
    }),
    db.passage.findMany({
      where: { ...publicPassageWhere, id: { in: passageGroups.map(x => x.passageId) } },
      include: { verse: true, work: { include: { corpus: true } } },
    }),
  ]);

  const firstPassages = passages.length ? [] : await db.passage.findMany({
    where: { ...publicPassageWhere, verse: { isNot: null } },
    include: { verse: true, work: { include: { corpus: true } } },
    orderBy: [{ workId: "asc" }, { ordinal: "asc" }], take: 8,
  });

  const qById = new Map(questions.map(x => [x.id, x]));
  const pById = new Map(passages.map(x => [x.id, x]));

  return {
    questions: questionGroups.flatMap(x => {
      const question = qById.get(x.questionId);
      return question ? [{ ...question, popularity: x._sum.count ?? 0 }] : [];
    }),
    passages: passageGroups.length ? passageGroups.flatMap(x => {
      const passage = pById.get(x.passageId);
      return passage ? [{ ...passage, popularity: x._sum.count ?? 0 }] : [];
    }) : firstPassages.map(passage => ({ ...passage, popularity: 0 })),
  };
}

import { db } from "./db";

export async function getHomeHighlights() {
  const [questionGroups, passageGroups] = await Promise.all([
    db.popularitySignal.groupBy({
      by: ["questionId"],
      _sum: { count: true },
      orderBy: { _sum: { count: "desc" } },
      take: 8,
    }),
    db.passagePopularitySignal.groupBy({
      by: ["passageId"],
      _sum: { count: true },
      orderBy: { _sum: { count: "desc" } },
      take: 8,
    }),
  ]);

  const [questions, passages] = await Promise.all([
    db.question.findMany({
      where: { id: { in: questionGroups.map(x => x.questionId) } },
    }),
    db.passage.findMany({
      where: { id: { in: passageGroups.map(x => x.passageId) } },
      include: { verse: true, work: { include: { corpus: true } } },
    }),
  ]);

  const qById = new Map(questions.map(x => [x.id, x]));
  const pById = new Map(passages.map(x => [x.id, x]));

  return {
    questions: questionGroups.flatMap(x => {
      const question = qById.get(x.questionId);
      return question ? [{ ...question, popularity: x._sum.count ?? 0 }] : [];
    }),
    passages: passageGroups.flatMap(x => {
      const passage = pById.get(x.passageId);
      return passage ? [{ ...passage, popularity: x._sum.count ?? 0 }] : [];
    }),
  };
}

import { db } from "../../lib/db";
import { publicPassageWhere } from "../../lib/publication";
export const dynamic = "force-dynamic";
export default async function Corpus() {
  const verses = await db.verse.findMany({ where: { passage: { is: publicPassageWhere } },
    include: { passage: { include: { work: true } } }, orderBy: [{ book: "asc" }, { chapter: "asc" }, { verse: "asc" }], take: 200 });
  return <main><a href="/">← Симфония</a><h1>Читать корпус</h1>
    <p>Пилотный набор проверенных фрагментов. Это не полное издание Библии. Редакция и источник указаны на странице каждого стиха.</p>
    {!verses.length && <p>Опубликованных фрагментов пока нет.</p>}
    {verses.map(v => <article className="evidence" key={v.id}><h2><a href={"/verse/" + v.osis}>{v.passage.work.title} {v.chapter}:{v.verse}</a></h2><p>{v.passage.text}</p><small>{v.passage.work.edition || v.passage.work.title}</small></article>)}
  </main>;
}

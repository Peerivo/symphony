import { rightsLabel } from "../../lib/source-labels";
import { db } from "../../lib/db";
import { publicSourceWhere, publicPassageWhere } from "../../lib/publication";
export const dynamic = "force-dynamic";
export default async function Sources() {
  const sources = await db.source.findMany({ where: { ...publicSourceWhere, passages: { some: publicPassageWhere } }, orderBy: { name: "asc" }, take: 100 });
  return <main><a href="/">← Симфония</a><h1>Источники и права</h1>
    <p>Цитаты воспроизводятся из указанных источников. Толкования и позиции публикуются только после отдельной редакционной проверки. Доступность сайта сама по себе не разрешает копирование.</p>
    {!sources.length && <p>Опубликованных источников пока нет.</p>}
    {sources.map(source => <article className="evidence" key={source.id}><h2>{source.name}</h2>
      <p><a href={source.canonicalUrl!} rel="noreferrer">К первоисточнику ↗</a></p>
      <p>Статус прав: {rightsLabel(source.rightsStatus)}. {source.license}</p><p>{source.rightsEvidence}</p>
      <small>Получено: {source.fetchedAt?.toISOString().slice(0, 10)} · Обработчик: {source.parserVersion}</small>
      <p className="checksum">Контрольная сумма: {source.checksum}</p>
    </article>)}
  </main>;
}

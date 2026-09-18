import { notFound } from "next/navigation";
import { QuestionBox } from "../../../components/QuestionBox";
import { ViewTracker } from "../../../components/ViewTracker";
import { getVersePage } from "../../../lib/verse-page";

export const dynamic = "force-dynamic";

function attribution(person?: { name: string } | null, tradition?: { name: string } | null) {
  return [person?.name, tradition?.name].filter(Boolean).join(" · ") || "Источник";
}

export default async function VersePage({ params }: { params: Promise<{ osis: string }> }) {
  const { osis } = await params;
  const verse = await getVersePage(decodeURIComponent(osis));
  if (!verse) notFound();

  const p = verse.passage;
  const source = p.source ?? p.work.source;

  return (
    <main>
      <ViewTracker osis={verse.osis} />
      <a href="/">← Симфония</a>
      <p className="eyebrow">{p.work.corpus.name}</p>
      <h1>{verse.book} {verse.chapter}:{verse.verse}</h1>
      <blockquote>{p.text}</blockquote>
      <p className="meta">
        {p.work.edition || p.work.title}
        {p.work.author ? " · " + p.work.author.name : ""}
        {p.locator ? " · " + p.locator : ""}
      </p>

      <QuestionBox osis={verse.osis} />

      <section>
        <h2>Главное по этому месту</h2>
        {verse.questions.length === 0 && <p>Первые вопросы по этому месту ещё не накоплены.</p>}
        {verse.questions.slice(0, 8).map((q, i) => (
          <a className="question" href={"/search?q=" + encodeURIComponent(q.canonicalText)} key={q.id}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            {q.canonicalText}
            <b>{q.popularity || "→"}</b>
          </a>
        ))}
      </section>

      <section className="result">
        <p className="eyebrow">ТОЛКОВАНИЯ</p>
        <h2>Как это место объясняют источники</h2>
        {p.interpretations.length === 0 && <p>Проверенные толкования ещё не связаны с этим местом.</p>}
        {p.interpretations.map((item) => (
          <article className="evidence" key={item.id}>
            <b>{attribution(item.person, item.tradition)}</b>
            {item.summary && <p>{item.summary}</p>}
            {item.sourceFragment?.quotedText && <blockquote>{item.sourceFragment.quotedText}</blockquote>}
            {item.sourceFragment?.source?.canonicalUrl && (
              <a href={item.sourceFragment.source.canonicalUrl}>Первоисточник ↗</a>
            )}
          </article>
        ))}
      </section>

      <section className="path">
        <p className="eyebrow">ПУТЬ ИСТИНЫ</p>
        <h2>Вопросы, позиции и разногласия</h2>
        {p.claimLinks.length === 0 && <p>Для этого места ещё не опубликована проверенная карта диспута.</p>}
        {p.claimLinks.map(({ claim }) => (
          <article className="claim" key={claim.id}>
            <div className="claim-head">
              <b>{attribution(claim.person, claim.tradition)}</b>
              <span>{claim.status}</span>
            </div>
            <p>{claim.text}</p>
            {claim.arguments.map((argument) => (
              <div className="argument" key={argument.id}>
                <strong>Аргумент:</strong> {argument.text}
              </div>
            ))}
            {claim.objections.map((objection) => (
              <div className="objection" key={objection.id}>
                <strong>Возражение:</strong> {objection.text}
                {objection.responses.map((response) => (
                  <div className="response" key={response.id}>
                    <strong>Ответ:</strong> {response.text}
                  </div>
                ))}
              </div>
            ))}
          </article>
        ))}
      </section>

      <section className="result">
        <p className="eyebrow">PROVENANCE</p>
        <p>
          {source ? <>Источник: <b>{source.name}</b>. Права: <b>{source.rightsStatus}</b>.</> : "Источник не указан."}
        </p>
        {source?.canonicalUrl && <a href={source.canonicalUrl}>Открыть источник ↗</a>}
      </section>
    </main>
  );
}

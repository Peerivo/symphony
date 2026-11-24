import { rightsLabel, sourceHref } from "../../../lib/source-labels";
import { notFound } from "next/navigation";
import { QuestionBox } from "../../../components/QuestionBox";
import { ViewTracker } from "../../../components/ViewTracker";
import { getVersePage } from "../../../lib/verse-page";
import { adjacentPublishedVerses } from "../../../lib/reading-context";

export const dynamic = "force-dynamic";

function attribution(person?: { name: string } | null, tradition?: { name: string } | null) {
  return [person?.name, tradition?.name].filter(Boolean).join(" · ") || "Источник";
}

export default async function VersePage({ params }: { params: Promise<{ osis: string }> }) {
  const { osis } = await params;
  if (osis.length > 80 || !/^[1-3]?[A-Za-z]+\.[1-9]\d*\.[1-9]\d*$/.test(osis)) notFound();
  const verse = await getVersePage(osis);
  if (!verse) notFound();

  const p = verse.passage;
  const source = p.source ?? p.work.source;
  const { previous, next } = adjacentPublishedVerses(verse.context, verse.verse);

  return (
    <main>
      <ViewTracker osis={verse.osis} />
      <a href="/">← Симфония</a>
      <p className="eyebrow">{p.work.corpus.name}</p>
      <h1>{p.work.title} {verse.chapter}:{verse.verse}</h1>
      <blockquote>{p.text}</blockquote>
      <p className="meta">
        {p.work.edition || p.work.title}
        {p.work.author ? " · " + p.work.author.name : ""}
        {p.locator && !p.locator.startsWith("https://") ? " · " + p.locator : ""}
      </p>

      <section className="reading-context" aria-labelledby="reading-context-heading">
        <p className="eyebrow">ЧТЕНИЕ ПИСАНИЯ</p>
        <h2 id="reading-context-heading">В контексте главы</h2>
        <p className="meta">Показаны только доступные опубликованные стихи в пределах двух номеров от выбранного. Это не полный текст главы.</p>
        <ol className="verse-context">
          {verse.context.map((item) => (
            <li key={item.osis} className={item.osis === verse.osis ? "selected" : undefined}>
              <a href={"/verse/" + item.osis} aria-current={item.osis === verse.osis ? "page" : undefined}>
                {verse.chapter}:{item.verse}
              </a>
              <span>{item.passage.text}</span>
            </li>
          ))}
        </ol>
        {(previous || next) && <nav className="verse-navigation" aria-label="Переход между соседними стихами">
          {previous
            ? <a href={"/verse/" + previous.osis}>← Предыдущий стих ({verse.chapter}:{previous.verse})</a>
            : <span />}
          {next && <a href={"/verse/" + next.osis}>Следующий стих ({verse.chapter}:{next.verse}) →</a>}
        </nav>}
      </section>

      {process.env.QUESTION_INTAKE_ENABLED === "true" ? <QuestionBox osis={verse.osis} /> : <p className="meta">Приём вопросов появится после открытия редакционной очереди.</p>}

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
        <p className="eyebrow">ИСТОЧНИК И ПРАВА</p>
        <p>
          {source ? <>Источник: <b>{source.name}</b>. Права: <b>{rightsLabel(source.rightsStatus)}</b>.</> : "Источник не указан."}
        </p>
        {source?.canonicalUrl && <a href={sourceHref(p.locator, source.canonicalUrl)}>Открыть источник ↗</a>}
      </section>
    </main>
  );
}

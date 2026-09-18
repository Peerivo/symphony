import { searchCorpus } from "../../lib/search";

export const dynamic = "force-dynamic";

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const results = q ? await searchCorpus(q) : { verses: [], questions: [], claims: [], fragments: [] };
  const total = results.verses.length + results.questions.length + results.claims.length + results.fragments.length;

  return (
    <main>
      <a href="/">← Симфония</a>
      <p className="eyebrow">ПОИСК ПО ВСЕМУ КОРПУСУ</p>
      <h1>{q ? "«" + q + "»" : "Введите стих, цитату или вопрос"}</h1>
      <form>
        <input name="q" defaultValue={q} placeholder="Еф 4:14 или «мне сказали, что…»" />
        <button>Найти</button>
      </form>

      {q && total === 0 && (
        <section className="result">
          <h2>В корпусе пока нет готового совпадения</h2>
          <p>Вопрос можно задать на странице связанного места Писания; после нормализации он становится частью общего графа Симфонии.</p>
        </section>
      )}

      {results.verses.length > 0 && <section className="result">
        <p className="eyebrow">ПИСАНИЕ</p>
        <h2>Места</h2>
        {results.verses.map(v => <article className="evidence" key={v.id}>
          <h3><a href={"/verse/" + v.osis}>{v.book} {v.chapter}:{v.verse}</a></h3>
          <p>{v.passage.text}</p>
          <small>{v.passage.work.corpus.name} · {v.passage.work.title}</small>
        </article>)}
      </section>}

      {results.questions.length > 0 && <section className="result">
        <p className="eyebrow">ВОПРОСЫ</p>
        <h2>Люди спрашивают</h2>
        {results.questions.map(question => {
          const count = question.signals.reduce((sum, s) => sum + s.count, 0);
          return <article className="evidence" key={question.id}>
            <b>{question.canonicalText}</b>
            <p>{question.passages.map(x => x.passage.verse?.osis).filter(Boolean).join(" · ") || "Связи уточняются"}{count ? " · " + count + " запросов" : ""}</p>
          </article>;
        })}
      </section>}

      {results.claims.length > 0 && <section className="path">
        <p className="eyebrow">ПУТЬ ИСТИНЫ</p>
        <h2>Связанные утверждения и позиции</h2>
        {results.claims.map(claim => <article className="claim" key={claim.id}>
          <div className="claim-head"><b>{claim.person?.name || claim.tradition?.name || "Атрибутированный источник"}</b><span>{claim.status}</span></div>
          <p>{claim.text}</p>
          {claim.sourceFragment?.source?.canonicalUrl && <a href={claim.sourceFragment.source.canonicalUrl}>Первоисточник ↗</a>}
        </article>)}
      </section>}

      {results.fragments.length > 0 && <section className="result">
        <p className="eyebrow">ПЕРВОИСТОЧНИКИ</p>
        <h2>Точные фрагменты</h2>
        {results.fragments.map(fragment => <article className="evidence" key={fragment.id}>
          {fragment.speaker && <b>{fragment.speaker.name}</b>}
          {fragment.quotedText && <blockquote>{fragment.quotedText}</blockquote>}
          <small>{fragment.locator || fragment.passage?.verse?.osis || "Источник"}</small>
          {fragment.source?.canonicalUrl && <p><a href={fragment.source.canonicalUrl}>Открыть источник ↗</a></p>}
        </article>)}
      </section>}
    </main>
  );
}

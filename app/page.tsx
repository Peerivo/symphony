import { getHomeHighlights } from "../lib/home";

export const dynamic = "force-dynamic";

export default async function Home() {
  const highlights = await getHomeHighlights();

  return (
    <main>
      <header><b>Симфония</b><span>Писание · Толкования · Вопросы · Первоисточники</span></header>
      <nav><a href="/corpus">Читать корпус</a> · <a href="/sources">Источники и права</a></nav>

      <section className="hero">
        <p className="eyebrow">ЕДИНЫЙ ПОИСК ПО КОРПУСУ</p>
        <h1>Спросите так, как думаете.</h1>
        <p>Ссылка на стих, приблизительная цитата, вопрос или «мне сказали, что…»</p>
        <form action="/search">
          <input name="q" aria-label="Стих, цитата или вопрос" maxLength={500} placeholder="Например: где сказано про ветры учения?" />
          <button>Найти</button>
        </form>
        <small>Пилотный корпус: 35 стихов Синодального перевода. Поиск по тексту и ссылкам; приём вопросов пока закрыт.</small>
      </section>

      <section>
        <p className="eyebrow">ЧАСТО СПРАШИВАЮТ</p>
        <h2>Вопросы, которые формируют Симфонию</h2>
        {highlights.questions.length === 0 && <p>Частые вопросы появятся здесь по мере использования.</p>}
        {highlights.questions.map((q, i) => (
          <a className="question" href={"/search?q=" + encodeURIComponent(q.canonicalText)} key={q.id}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            {q.canonicalText}
            <b>{q.popularity}</b>
          </a>
        ))}
      </section>

      <section className="result">
        <p className="eyebrow">ОПУБЛИКОВАННЫЙ КОРПУС</p>
        <h2>Начните с места Писания</h2>
        {highlights.passages.length === 0 && <p>Статистика чтения начнёт собираться после публикации корпуса.</p>}
        {highlights.passages.map((p) => (
          <article className="evidence" key={p.id}>
            <h3>{p.verse ? <a href={"/verse/" + p.verse.osis}>{p.work.title} {p.verse.chapter}:{p.verse.verse}</a> : p.heading || p.work.title}</h3>
            <p>{p.text.length > 260 ? p.text.slice(0, 260) + "…" : p.text}</p>
            <small>{p.work.corpus.name} {p.popularity > 0 ? ` · ${p.popularity} просмотров` : ""}</small>
          </article>
        ))}
      </section>

      <section className="path">
        <p className="eyebrow">ПУТЬ ИСТИНЫ</p>
        <h2>Проверяйте утверждение по источникам</h2>
        <p>Карты толкований и разногласий появятся после проверки редакцией. Для каждого утверждения будут указаны конкретный автор и точный первоисточник.</p>
      </section>
    </main>
  );
}

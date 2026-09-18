import { getHomeHighlights } from "../lib/home";

export const dynamic = "force-dynamic";

export default async function Home() {
  const highlights = await getHomeHighlights();

  return (
    <main>
      <header><b>Симфония</b><span>Писание · Толкования · Вопросы · Первоисточники</span></header>

      <section className="hero">
        <p className="eyebrow">ЕДИНЫЙ ПОИСК ПО КОРПУСУ</p>
        <h1>Спросите так, как думаете.</h1>
        <p>Ссылка на стих, приблизительная цитата, вопрос или «мне сказали, что…»</p>
        <form action="/search">
          <input name="q" autoFocus placeholder="Например: где сказано про ветры учения?" />
          <button>Найти</button>
        </form>
        <small>Текстовый и голосовой вход используют один и тот же корпус и граф связей.</small>
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
        <p className="eyebrow">САМЫЕ ЧИТАЕМЫЕ МЕСТА</p>
        <h2>К чему люди возвращаются</h2>
        {highlights.passages.length === 0 && <p>Статистика чтения начнёт собираться после публикации корпуса.</p>}
        {highlights.passages.map((p) => (
          <article className="evidence" key={p.id}>
            <h3>{p.verse ? <a href={"/verse/" + p.verse.osis}>{p.verse.book} {p.verse.chapter}:{p.verse.verse}</a> : p.heading || p.work.title}</h3>
            <p>{p.text.length > 260 ? p.text.slice(0, 260) + "…" : p.text}</p>
            <small>{p.work.corpus.name} · {p.popularity} просмотров</small>
          </article>
        ))}
      </section>

      <section className="path">
        <p className="eyebrow">ПУТЬ ИСТИНЫ</p>
        <h2>Проверяйте утверждение по источникам</h2>
        <p>Вопрос связывается с местами Писания, толкованиями, позициями конкретных традиций и авторов, аргументами, возражениями, ответами и точными первоисточниками.</p>
      </section>
    </main>
  );
}

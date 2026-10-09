"use client";
import { FormEvent, useRef, useState } from "react";

export function QuestionBox({ osis }: { osis: string }) {
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle"|"saving"|"saved"|"error">("idle");
  const pending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current || !consent || text.trim().length < 3) return;
    pending.current = true;
    setState("saving");
    try {
      const response = await fetch("/api/questions", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, osis, consent }),
      });
      if (!response.ok) throw new Error();
      setText(""); setConsent(false); setState("saved");
    } catch { setState("error"); }
    finally { pending.current = false; }
  }
  return (
    <form onSubmit={submit} className="ask">
      <input value={text} onChange={e => { setText(e.target.value); setState("idle"); }}
        minLength={3} maxLength={2000} required disabled={state === "saving"}
        placeholder="Спросить об этом месте…" aria-label="Вопрос об этом месте Писания" />
      <button disabled={state === "saving" || !consent || text.trim().length < 3}>
        {state === "saving" ? "Отправляю…" : "Передать редакции"}
      </button>
      <label className="consent"><input type="checkbox" checked={consent} required
        disabled={state === "saving"} onChange={e => setConsent(e.target.checked)} />
        Разрешаю редакции обработать вопрос и подготовить обезличенную формулировку для публикации. Не указываю имена, контакты или личные обстоятельства.
      </label>
      <small>Исходный текст не публикуется автоматически. Подробнее: <a href="/privacy">обработка вопросов</a>.</small>
      <small role="status" aria-live="polite">
        {state === "saved" && "Вопрос принят для редакционной проверки."}
        {state === "error" && "Не удалось принять вопрос. Текст сохранён в поле; попробуйте позже."}
      </small>
    </form>
  );
}

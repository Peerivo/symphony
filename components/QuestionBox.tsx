"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function QuestionBox({ osis }: { osis: string }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle"|"saving"|"saved"|"error">("idle");
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (text.trim().length < 3) return;
    setState("saving");
    const response = await fetch("/api/questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, osis }),
    });
    if (!response.ok) {
      setState("error");
      return;
    }
    setText("");
    setState("saved");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="ask">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Спросить об этом месте или проверить утверждение…"
        aria-label="Вопрос об этом месте Писания"
      />
      <button disabled={state === "saving"}>{state === "saving" ? "Сохраняю…" : "Спросить"}</button>
      {state === "saved" && <small>Вопрос добавлен в Симфонию.</small>}
      {state === "error" && <small>Не удалось сохранить вопрос.</small>}
    </form>
  );
}

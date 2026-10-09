"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main><h1>Корпус временно недоступен</h1><p>Не удалось загрузить проверенные источники. Попробуйте ещё раз позже.</p><button onClick={reset}>Повторить</button></main>;
}

"use client";

import { useEffect } from "react";

export function ViewTracker({ osis }: { osis: string }) {
  useEffect(() => {
    void fetch("/api/views", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ osis }),
      keepalive: true,
    }).catch(() => { /* Anonymous statistics never block reading. */ });
  }, [osis]);

  return null;
}

"use client";

import { useEffect } from "react";

export function ViewTracker({ osis }: { osis: string }) {
  useEffect(() => {
    void fetch("/api/views", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ osis }),
      keepalive: true,
    });
  }, [osis]);

  return null;
}

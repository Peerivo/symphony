import test from "node:test";
import assert from "node:assert/strict";
import { adjacentPublishedVerses, contextBounds } from "../lib/reading-context";

test("reading context is bounded to two neighboring verse numbers without crossing chapter start", () => {
  assert.deepEqual(contextBounds(1), { gte: 1, lte: 3 });
  assert.deepEqual(contextBounds(16), { gte: 14, lte: 18 });
});

test("navigation never bridges missing or unpublished verses", () => {
  const available = [{ verse: 13 }, { verse: 14 }, { verse: 16 }, { verse: 17 }];
  assert.deepEqual(adjacentPublishedVerses(available, 16), {
    previous: null,
    next: available[3],
  });
  assert.deepEqual(adjacentPublishedVerses(available, 14), {
    previous: available[0],
    next: null,
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import { externalCommentaryForVerse } from "../lib/external-commentary";

test("Azbyka link-only adapter maps the five evidenced M1 pilot books without fetching text", () => {
  const examples = [
    ["Gen.1.1", "Gen.1:1"],
    ["Ps.22.1", "Ps.22:1"],
    ["John.1.1", "Jn.1:1"],
    ["John.3.16", "Jn.3:16"],
    ["Eph.4.14", "Eph.4:14"],
    ["1Cor.13.4", "1Cor.13:4"],
  ];
  for (const [osis, reference] of examples) {
    const actual = externalCommentaryForVerse(osis);
    assert.deepEqual(actual, {
      provider: "azbyka", mode: "LINK_ONLY", sourceLabel: "Азбука веры",
      url: "https://azbyka.ru/biblia/in/?" + reference + "=",
    });
  }
});

test("unknown, malformed and potentially injectable identifiers fail closed", () => {
  for (const bad of [
    "", "NotABook.1.1", "John.0.1", "John.1.0", "John.1.-1",
    "John.1.1?x=y", "John.1.1#x", "John.1.1/", "Jn.1.1",
    "John.01.01", "John.9999.1", "John.1.1%0d",
  ]) {
    assert.equal(externalCommentaryForVerse(bad), null, bad);
  }
});

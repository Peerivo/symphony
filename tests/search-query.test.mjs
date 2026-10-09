import test from "node:test";
import assert from "node:assert/strict";
import { parseReference, prepareSearchQuery, normalizeSearchText, orderByIds, MAX_QUERY_LENGTH, MAX_QUERY_TERMS } from "../lib/search-query.ts";

const references = [
  ["Быт. 1:1", "Gen.1.1"], ["Исх 20,13", "Exod.20.13"], ["Числа 6:24", "Num.6.24"],
  ["Псалом 22:1", "Ps.22.1"], ["Пс 23:1", "Ps.23.1"], ["Исаии 53:5", "Isa.53.5"],
  ["Еф 4:14", "Eph.4.14"], ["Ин. 3:16", "John.3.16"], ["John.3.16", "John.3.16"],
  ["  JOHN 03 : 016  ", "John.3.16"], ["Евангелие от Иоанна 3:16", "John.3.16"],
  ["1 Кор. 13:4", "1Cor.13.4"], ["1Cor.13.4", "1Cor.13.4"], ["II Тим 3:16", "2Tim.3.16"],
  ["1 Иоанна 4:8", "1John.4.8"], ["2 Peter 1:5", "2Pet.1.5"], ["Откр 21:4", "Rev.21.4"],
  ["3 Царств 3:9", "1Kgs.3.9"], ["4 Цар 2:11", "2Kgs.2.11"], ["1 Kings 3:9", "1Kgs.3.9"],
  ["Первое послание к Коринфянам 13:4", "1Cor.13.4"],
  ["Первое послание Иоанна 4:8", "1John.4.8"], ["Книга пророка Исаии 53:5", "Isa.53.5"],
  ["Третья книга Царств 3:9", "1Kgs.3.9"], ["First John 4:8", "1John.4.8"],
  ["Флм 1:3", "Phlm.1.3"], ["Песнь песней 2:1", "Song.2.1"], ["1\u00a0Кор 13:4", "1Cor.13.4"],
];
for (const [input, expected] of references) test(`normalizes ${input}`, () => assert.equal(parseReference(input)?.osis, expected));

test("canonical OSIS works for every supported 66-book address", () => {
  const books = "Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev".split(" ");
  assert.equal(books.length, 66);
  for (const book of books) assert.equal(parseReference(`${book}.1.1`)?.osis, `${book}.1.1`);
});

test("same-chapter range is explicit and bounded", () => {
  assert.deepEqual(parseReference("Ин 3:16–18"), { book: "John", chapter: 3, verse: 16, endVerse: 18, osis: "John.3.16" });
  for (const value of ["Ин 3:18-16", "Ин 3:1-51", "Ин 3:16-4:2"]) assert.equal(parseReference(value), null);
});

test("rejects unsupported and invalid references instead of guessing", () => {
  for (const value of ["Quran 1:1", "И 3:16", "Ин 0:16", "Ин 3:0", "Пс 151:1", "Ин 3:999", "Ин -3:1", "Ин 3:16 лишнее", "Ин 3:16; DROP TABLE Verse"])
    assert.equal(parseReference(value), null, value);
});

test("normalizes punctuation, case, whitespace and ё without inventing words", () => {
  assert.equal(normalizeSearchText(" «ЕЩЁ,  СЛОВО!»\n"), "еще слово");
  assert.deepEqual(prepareSearchQuery("где сказано про ветры учения?")?.terms, ["ветры", "учения"]);
  assert.deepEqual(prepareSearchQuery("мне сказали, что любовь не завидует")?.terms, ["любовь", "завидует"]);
  assert.equal(prepareSearchQuery("love is patient")?.configuration, "english");
  assert.equal(prepareSearchQuery("Любовь долготерпит")?.configuration, "russian");
});

test("bounds work and never forwards wildcard/query syntax as operators", () => {
  for (const input of ["", "а", "что где и", "the and is", "% _ !!!", "a".repeat(MAX_QUERY_LENGTH + 1)])
    assert.equal(prepareSearchQuery(input), null, input);
  const plan = prepareSearchQuery("любовь%' | ! & :* (нежность)");
  assert.deepEqual(plan?.terms, ["любовь", "нежность"]);
  assert.equal(prepareSearchQuery(Array.from({ length: 30 }, (_, i) => `word${i}`).join(" "))?.terms.length, MAX_QUERY_TERMS);
  assert.deepEqual(prepareSearchQuery("Ин 3:16")?.terms, []);
});

test("SQL ranking survives unordered hydration and missing rows", () => {
  assert.deepEqual(orderByIds([{ id: "b" }, { id: "a" }], ["a", "gone", "b"]), [{ id: "a" }, { id: "b" }]);
});

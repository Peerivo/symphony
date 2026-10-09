import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateManifest } from "../scripts/ingestion-contract.mjs";

const seed = JSON.parse(await fs.readFile(new URL("../fixtures/ingestion/legal-seed-russyn.json", import.meta.url), "utf8"));
const rawSnapshot = await fs.readFile(new URL("../fixtures/ingestion/legal-seed-snapshots.json", import.meta.url));
const snapshot = JSON.parse(rawSnapshot);
const hash = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const decodeEntities = (text) => text.replace(/&#(x[\da-f]+|\d+);/gi, (_, code) =>
  String.fromCodePoint(code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code)))
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");

function extractVerse(html, number) {
  const markers = [...html.matchAll(/<span class="verse" id="V(\d+)">.*?<\/span>/g)];
  const index = markers.findIndex((marker) => Number(marker[1]) === number);
  assert.ok(index >= 0, `Source must contain verse ${number}`);
  const start = markers[index].index + markers[index][0].length;
  const end = markers[index + 1]?.index ?? html.indexOf("<ul class='tnav'>", start);
  assert.ok(end > start);
  return decodeEntities(html.slice(start, end).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

test("seed passes the production ingestion contract and remains bounded", () => {
  const validated = validateManifest(seed);
  assert.equal(validated.mode, "FULL_TEXT");
  assert.equal(validated.source.rightsStatus, "PUBLIC_DOMAIN");
  assert.equal(validated.works.flatMap((work) => work.passages).length, 35);
  assert.equal(validated.corpus.language, "ru");
  for (const work of validated.works) {
    assert.equal(work.language, "ru");
    assert.match(work.edition, /Синодальный.*eBible\.org.*2025-12-12/);
  }
});

test("manifest and per-response SHA-256 bind the preserved retrieval bytes", () => {
  assert.equal(seed.source.checksum, hash(rawSnapshot));
  assert.equal(seed.source.fetchedAt, snapshot.fetchedAt);
  assert.match(seed.source.parserVersion, /^symphony-ebible-html-excerpt\/1\.0\.0$/);
  assert.equal(snapshot.documents.length, 7);
  for (const document of snapshot.documents) {
    assert.equal(new URL(document.url).hostname, "ebible.org");
    assert.equal(document.checksum, hash(Buffer.from(document.bodyBase64, "base64")));
  }
});

test("primary-source rights declaration is present in the actual stored response", () => {
  const rights = snapshot.documents.find((document) => document.url === "https://ebible.org/russyn/copyright.htm");
  assert.ok(rights);
  const html = Buffer.from(rights.bodyBase64, "base64").toString("utf8");
  assert.match(html, /Public Domain/);
  assert.match(html, /Synodal Translation of the Holy Bible in Russian/);
  assert.ok(seed.source.rightsEvidence.includes(rights.url));
});

test("all verse bodies replay exactly from their original source locators", () => {
  for (const work of seed.works) for (const passage of work.passages) {
    const locator = new URL(passage.locator);
    const number = Number(locator.hash.slice(2));
    locator.hash = "";
    const document = snapshot.documents.find((document) => document.url === locator.href);
    assert.ok(document, passage.locator);
    assert.equal(number, passage.verse.verse);
    assert.equal(passage.text, extractVerse(Buffer.from(document.bodyBase64, "base64").toString("utf8"), number), passage.verse.osis);
    assert.equal(passage.language, "ru");
    assert.equal(passage.kind, "VERSE");
    assert.ok(passage.key.startsWith("ebible:russyn:seed-v1:"));
  }
});

test("numbering and source wording are preserved, with no fabricated approval", () => {
  const passages = seed.works.flatMap((work) => work.passages);
  const psalm = passages.find((passage) => passage.verse.osis === "Ps.22.1");
  assert.match(psalm.text, /Господь - Пастырь мой/);
  assert.equal(passages.some((passage) => passage.verse.osis === "Ps.23.1"), false);
  assert.match(passages.find((passage) => passage.verse.osis === "Eph.4.14").text, /ветром учения/);
  assert.equal(Object.hasOwn(seed, "questions"), false);
  for (const passage of passages) assert.equal(Object.hasOwn(passage, "reviewStatus"), false);
});

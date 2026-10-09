/** Pure, database-independent contract for the version 1 JSON adapter. */
export class IngestionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "IngestionValidationError";
  }
}

const RIGHTS = ["UNKNOWN", "PUBLIC_DOMAIN", "LICENSED", "PERMISSION_GRANTED", "LINK_ONLY", "RESTRICTED"];
const FULL_TEXT_RIGHTS = new Set(["PUBLIC_DOMAIN", "LICENSED", "PERMISSION_GRANTED"]);
const SOURCE_KINDS = ["SCRIPTURE", "PATRISTIC", "WORK", "COUNCIL", "LITURGICAL", "COMMENTARY", "CONFESSIONAL", "TAFSIR", "HADITH", "ARTICLE", "BOOK", "MEDIA", "USER_QUESTION", "OTHER"];
const CORPUS_KINDS = ["SCRIPTURE", "PATRISTIC", "COUNCIL", "LITURGICAL", "CONFESSIONAL", "COMMENTARY", "APOLOGETIC", "INTERRELIGIOUS", "MEDIA", "OTHER"];
const PASSAGE_KINDS = ["BOOK", "CHAPTER", "VERSE", "SECTION", "PARAGRAPH", "QUOTE", "MEDIA_SEGMENT", "OTHER"];

function fail(message) { throw new IngestionValidationError(message); }
function object(value, path, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${path} must be an object`);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`${path}.${key} is not supported`);
  }
  return value;
}
function string(value, path, { preserveWhitespace = false } = {}) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) fail(`${path} must be a non-empty string without NUL characters`);
  if (!preserveWhitespace && value !== value.trim()) fail(`${path} must not have surrounding whitespace`);
  return value;
}
function optionalString(value, path) { return value == null ? null : string(value, path); }
function choice(value, path, choices) {
  if (!choices.includes(value)) fail(`${path} must be one of ${choices.join(", ")}`);
  return value;
}
function integer(value, path, minimum = -2147483648) {
  if (!Number.isInteger(value) || value < minimum || value > 2147483647) fail(`${path} must be a PostgreSQL integer >= ${minimum}`);
  return value;
}
function array(value, path) {
  if (!Array.isArray(value)) fail(`${path} must be an array`);
  return value;
}
function unique(seen, value, path) {
  if (seen.has(value)) fail(`Duplicate ${path}: ${value}`);
  seen.add(value);
}
function timestamp(value, path) {
  string(value, path);
  // Require a timezone; reject dates that JavaScript would silently normalize.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) fail(`${path} must be an RFC 3339 timestamp with a timezone and at most millisecond precision`);
  const [, year, month, day, hour, minute, second, , offsetHour = "0", offsetMinute = "0"] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (m < 1 || m > 12 || d < 1 || d > days[m - 1] || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || Number(offsetHour) > 23 || Number(offsetMinute) > 59) fail(`${path} is not a valid timestamp`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) fail(`${path} is not a valid timestamp`);
  return date.toISOString();
}
function canonicalUrl(value, path) {
  string(value, path);
  if (!/^https?:\/\/[^\s\\]+$/i.test(value)) fail(`${path} must be an absolute HTTP(S) URL without whitespace or backslashes`);
  let url;
  try { url = new URL(value); } catch { fail(`${path} must be an absolute HTTP(S) URL`); }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password || url.hash) fail(`${path} must be an HTTP(S) URL without credentials or a fragment`);
  return url.href;
}
function checksum(value, path) {
  if (typeof value !== "string" || !/^sha256:[a-fA-F0-9]{64}$/.test(value)) fail(`${path} must be sha256:<64 hexadecimal digits> for the raw snapshot`);
  return value.toLowerCase();
}
function person(value, path) {
  object(value, path, ["slug", "name"]);
  return { slug: string(value.slug, `${path}.slug`), name: string(value.name, `${path}.name`) };
}

/** Order a work's passages parent-first. Missing/cross-work parents and cycles fail. */
export function orderPassages(passages) {
  const byKey = new Map();
  for (const passage of passages) {
    if (byKey.has(passage.key)) fail(`Duplicate passage.key: ${passage.key}`);
    byKey.set(passage.key, passage);
  }
  const children = new Map();
  const queue = [];
  for (const passage of passages) {
    if (passage.parentKey == null) queue.push(passage);
    else {
      if (!byKey.has(passage.parentKey)) fail(`Unknown or cross-work parentKey=${passage.parentKey} for passage ${passage.key}`);
      const siblings = children.get(passage.parentKey) ?? [];
      siblings.push(passage);
      children.set(passage.parentKey, siblings);
    }
  }
  for (let index = 0; index < queue.length; index++) {
    for (const child of children.get(queue[index].key) ?? []) queue.push(child);
  }
  if (queue.length !== passages.length) fail("Passage parentKey cycle detected");
  return queue;
}

/** Return a detached normalized manifest. Validation completes before any DB call. */
export function validateManifest(input) {
  object(input, "manifest", ["manifestVersion", "mode", "source", "corpus", "works"]);
  if (input.manifestVersion !== 1) fail("manifest.manifestVersion must be 1");
  const mode = choice(input.mode, "manifest.mode", ["METADATA_ONLY", "FULL_TEXT"]);
  const src = object(input.source, "source", ["name", "kind", "canonicalUrl", "rightsStatus", "rightsEvidence", "license", "fetchedAt", "checksum", "parserVersion"]);
  const rightsStatus = choice(src.rightsStatus, "source.rightsStatus", RIGHTS);
  if (mode === "FULL_TEXT" && !FULL_TEXT_RIGHTS.has(rightsStatus)) fail(`FULL_TEXT denied for rightsStatus=${rightsStatus}`);
  const source = {
    name: string(src.name, "source.name"),
    kind: choice(src.kind, "source.kind", SOURCE_KINDS),
    canonicalUrl: canonicalUrl(src.canonicalUrl, "source.canonicalUrl"),
    rightsStatus,
    rightsEvidence: string(src.rightsEvidence, "source.rightsEvidence"),
    license: optionalString(src.license, "source.license"),
    fetchedAt: timestamp(src.fetchedAt, "source.fetchedAt"),
    checksum: checksum(src.checksum, "source.checksum"),
    parserVersion: string(src.parserVersion, "source.parserVersion"),
  };
  if (rightsStatus === "LICENSED" && !source.license) fail("source.license is required for LICENSED sources");
  const c = object(input.corpus, "corpus", ["slug", "name", "kind", "language", "tradition"]);
  const corpus = {
    slug: string(c.slug, "corpus.slug"), name: string(c.name, "corpus.name"),
    kind: choice(c.kind, "corpus.kind", CORPUS_KINDS),
    language: optionalString(c.language, "corpus.language"),
    tradition: c.tradition == null ? null : person(c.tradition, "corpus.tradition"),
  };
  const workKeys = new Set(), passageKeys = new Set(), osisKeys = new Set(), authors = new Map();
  const works = array(input.works, "works").map((w, workIndex) => {
    const path = `works[${workIndex}]`;
    object(w, path, ["key", "title", "author", "language", "edition", "publishedYear", "passages"]);
    const key = string(w.key, `${path}.key`);
    unique(workKeys, key, "work.key");
    const author = w.author == null ? null : person(w.author, `${path}.author`);
    if (author) {
      if (authors.has(author.slug) && authors.get(author.slug) !== author.name) fail(`Conflicting author identity for slug=${author.slug}`);
      authors.set(author.slug, author.name);
    }
    const work = {
      key, title: string(w.title, `${path}.title`), author,
      language: optionalString(w.language, `${path}.language`) ?? corpus.language,
      edition: optionalString(w.edition, `${path}.edition`),
      publishedYear: w.publishedYear == null ? null : integer(w.publishedYear, `${path}.publishedYear`),
    };
    const passages = w.passages === undefined ? [] : array(w.passages, `${path}.passages`);
    if (mode === "METADATA_ONLY" && passages.length) fail("METADATA_ONLY manifest cannot contain passages or passage text");
    work.passages = passages.map((p, passageIndex) => {
      const pp = `${path}.passages[${passageIndex}]`;
      object(p, pp, ["key", "parentKey", "ordinal", "kind", "heading", "text", "locator", "language", "verse"]);
      const passageKey = string(p.key, `${pp}.key`);
      unique(passageKeys, passageKey, "passage.key");
      const passage = {
        key: passageKey, parentKey: optionalString(p.parentKey, `${pp}.parentKey`),
        ordinal: integer(p.ordinal, `${pp}.ordinal`, 0),
        kind: choice(p.kind ?? "PARAGRAPH", `${pp}.kind`, PASSAGE_KINDS),
        heading: optionalString(p.heading, `${pp}.heading`),
        text: string(p.text, `${pp}.text`, { preserveWhitespace: true }),
        locator: string(p.locator, `${pp}.locator`),
        language: optionalString(p.language, `${pp}.language`) ?? work.language,
        verse: null,
      };
      if (p.verse != null) {
        const v = object(p.verse, `${pp}.verse`, ["osis", "book", "chapter", "verse"]);
        passage.verse = {
          osis: string(v.osis, `${pp}.verse.osis`), book: string(v.book, `${pp}.verse.book`),
          chapter: integer(v.chapter, `${pp}.verse.chapter`, 1), verse: integer(v.verse, `${pp}.verse.verse`, 1),
        };
        unique(osisKeys, passage.verse.osis, "passage.verse.osis");
        if (passage.kind !== "VERSE") fail(`${pp}.kind must be VERSE when a verse index is supplied`);
        if (passage.verse.osis !== `${passage.verse.book}.${passage.verse.chapter}.${passage.verse.verse}`) fail(`${pp}.verse.osis must match book.chapter.verse`);
      }
      return passage;
    });
    orderPassages(work.passages);
    return work;
  });
  return { manifestVersion: 1, mode, source, corpus, works };
}

import fs from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FULL_TEXT_RIGHTS = new Set(["PUBLIC_DOMAIN","LICENSED","PERMISSION_GRANTED"]);

function fail(message) { throw new Error(message); }
function required(value, name) { if (!value) fail("Missing "+name); return value; }

async function main() {
  const file = process.argv[2];
  required(file, "manifest path");
  const manifest = JSON.parse(await fs.readFile(file, "utf8"));

  const mode = required(manifest.mode, "mode");
  const src = required(manifest.source, "source");
  const canonicalUrl = required(src.canonicalUrl, "source.canonicalUrl");
  const rightsStatus = required(src.rightsStatus, "source.rightsStatus");

  if (mode === "FULL_TEXT" && !FULL_TEXT_RIGHTS.has(rightsStatus)) {
    fail("FULL_TEXT denied for rightsStatus="+rightsStatus);
  }
  if (!["FULL_TEXT","METADATA_ONLY"].includes(mode)) fail("Unsupported mode");
  if (mode === "METADATA_ONLY" && manifest.works?.some(w => w.passages?.length)) {
    fail("METADATA_ONLY manifest cannot contain passage text");
  }

  const source = await prisma.source.upsert({
    where: { canonicalUrl },
    update: {
      name: src.name,
      kind: src.kind,
      rightsStatus,
      rightsEvidence: src.rightsEvidence ?? null,
      license: src.license ?? null,
      checksum: src.checksum ?? null,
      parserVersion: src.parserVersion ?? null,
      fetchedAt: src.fetchedAt ? new Date(src.fetchedAt) : null,
    },
    create: {
      name: required(src.name, "source.name"),
      kind: required(src.kind, "source.kind"),
      canonicalUrl,
      rightsStatus,
      rightsEvidence: src.rightsEvidence ?? null,
      license: src.license ?? null,
      checksum: src.checksum ?? null,
      parserVersion: src.parserVersion ?? null,
      fetchedAt: src.fetchedAt ? new Date(src.fetchedAt) : null,
    },
  });

  let tradition = null;
  if (manifest.corpus?.tradition) {
    const t = manifest.corpus.tradition;
    tradition = await prisma.tradition.upsert({
      where: { slug: required(t.slug, "corpus.tradition.slug") },
      update: { name: required(t.name, "corpus.tradition.name") },
      create: { slug: t.slug, name: t.name },
    });
  }

  const corpusDef = required(manifest.corpus, "corpus");
  const corpus = await prisma.corpus.upsert({
    where: { slug: required(corpusDef.slug, "corpus.slug") },
    update: {
      name: corpusDef.name,
      kind: corpusDef.kind,
      language: corpusDef.language ?? null,
      sourceId: source.id,
      traditionId: tradition?.id ?? null,
    },
    create: {
      slug: corpusDef.slug,
      name: required(corpusDef.name, "corpus.name"),
      kind: required(corpusDef.kind, "corpus.kind"),
      language: corpusDef.language ?? null,
      sourceId: source.id,
      traditionId: tradition?.id ?? null,
    },
  });

  for (const workDef of manifest.works ?? []) {
    const importKey = required(workDef.key, "work.key");
    let author = null;
    if (workDef.author) {
      const a = workDef.author;
      const slug = required(a.slug, "work.author.slug");
      author = await prisma.person.upsert({
        where: { slug },
        update: { name: a.name, traditionId: tradition?.id ?? null },
        create: { slug, name: required(a.name, "work.author.name"), traditionId: tradition?.id ?? null },
      });
    }

    const work = await prisma.work.upsert({
      where: { importKey },
      update: {
        corpusId: corpus.id,
        title: workDef.title,
        authorId: author?.id ?? null,
        sourceId: source.id,
        language: workDef.language ?? corpusDef.language ?? null,
        edition: workDef.edition ?? null,
        publishedYear: workDef.publishedYear ?? null,
      },
      create: {
        importKey,
        corpusId: corpus.id,
        title: required(workDef.title, "work.title"),
        authorId: author?.id ?? null,
        sourceId: source.id,
        language: workDef.language ?? corpusDef.language ?? null,
        edition: workDef.edition ?? null,
        publishedYear: workDef.publishedYear ?? null,
      },
    });

    if (mode !== "FULL_TEXT") continue;

    const byKey = new Map();
    for (const p of workDef.passages ?? []) {
      const key = required(p.key, "passage.key");
      const passage = await prisma.passage.upsert({
        where: { importKey: key },
        update: {
          workId: work.id,
          sourceId: source.id,
          ordinal: p.ordinal,
          kind: p.kind ?? "PARAGRAPH",
          heading: p.heading ?? null,
          text: required(p.text, "passage.text"),
          locator: p.locator ?? null,
          language: p.language ?? workDef.language ?? corpusDef.language ?? null,
        },
        create: {
          importKey: key,
          workId: work.id,
          sourceId: source.id,
          ordinal: required(p.ordinal, "passage.ordinal"),
          kind: p.kind ?? "PARAGRAPH",
          heading: p.heading ?? null,
          text: required(p.text, "passage.text"),
          locator: p.locator ?? null,
          language: p.language ?? workDef.language ?? corpusDef.language ?? null,
        },
      });
      byKey.set(key, passage.id);

      if (p.verse) {
        await prisma.verse.upsert({
          where: { osis: required(p.verse.osis, "passage.verse.osis") },
          update: {
            passageId: passage.id,
            book: p.verse.book,
            chapter: p.verse.chapter,
            verse: p.verse.verse,
          },
          create: {
            passageId: passage.id,
            osis: p.verse.osis,
            book: required(p.verse.book, "passage.verse.book"),
            chapter: required(p.verse.chapter, "passage.verse.chapter"),
            verse: required(p.verse.verse, "passage.verse.verse"),
          },
        });
      }
    }

    for (const p of workDef.passages ?? []) {
      if (!p.parentKey) continue;
      const id = byKey.get(p.key);
      const parentId = byKey.get(p.parentKey);
      if (!id || !parentId) fail("Unknown parentKey="+p.parentKey);
      await prisma.passage.update({ where: { id }, data: { parentId } });
    }
  }

  console.log(JSON.stringify({ sourceId: source.id, corpusId: corpus.id, mode }, null, 2));
}

main().finally(() => prisma.$disconnect());

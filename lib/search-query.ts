/** Pure, bounded query normalization. Verse numbers retain the chosen edition's numbering. */
export const MAX_QUERY_LENGTH = 300;
export const MAX_QUERY_TERMS = 12;
export const SEARCH_RESULT_LIMIT = 12;
export const MAX_REFERENCE_RANGE = 50;

const BOOK_NAMES: Record<string, string[]> = {
  Gen: ["быт", "бытие", "genesis"], Exod: ["исх", "исход", "exodus"],
  Lev: ["лев", "левит", "leviticus"], Num: ["чис", "числ", "числа", "numbers"],
  Deut: ["втор", "второзаконие", "deuteronomy"], Josh: ["нав", "иснав", "иисусанавина", "joshua"],
  Judg: ["суд", "судьи", "судей", "judges"], Ruth: ["руф", "руфь"],
  "1Sam": ["1цар", "1царств", "1samuel"], "2Sam": ["2цар", "2царств", "2samuel"],
  "1Kgs": ["3цар", "3царств", "1kings"], "2Kgs": ["4цар", "4царств", "2kings"],
  "1Chr": ["1пар", "1паралипоменон", "1chronicles"], "2Chr": ["2пар", "2паралипоменон", "2chronicles"],
  Ezra: ["езд", "ездр", "ездра", "ездры"], Neh: ["неем", "неемия"],
  Esth: ["есф", "есфирь", "esther"], Job: ["иов", "иова"],
  Ps: ["пс", "псалом", "псалмы", "псалтирь", "псалтырь", "psalm", "psalms"],
  Prov: ["прит", "притч", "притчи", "притчисоломона", "proverbs"],
  Eccl: ["еккл", "екклесиаст", "екклесиаста", "ecclesiastes"],
  Song: ["песн", "песнь", "песнипесней", "песньпесней", "songofsolomon", "songofsongs"],
  Isa: ["ис", "исаия", "исаии", "isaiah"], Jer: ["иер", "иеремия", "иеремии", "jeremiah"],
  Lam: ["плач", "плачииеремии", "плачиеремии", "lamentations"],
  Ezek: ["иез", "иезекииль", "иезекииля", "ezekiel"], Dan: ["дан", "даниил", "даниила", "daniel"],
  Hos: ["ос", "осия", "осии", "hosea"], Joel: ["иоил", "иоиль", "иоиля"],
  Amos: ["ам", "амос", "амоса"], Obad: ["авд", "авдий", "авдия", "obadiah"],
  Jonah: ["ион", "иона", "ионы"], Mic: ["мих", "михей", "михея", "micah"],
  Nah: ["наум", "наума", "nahum"], Hab: ["авв", "аввакум", "аввакума", "habakkuk"],
  Zeph: ["соф", "софония", "софонии", "zephaniah"], Hag: ["агг", "аггей", "аггея", "haggai"],
  Zech: ["зах", "захария", "захарии", "zechariah"], Mal: ["мал", "малахия", "малахии", "malachi"],
  Matt: ["мф", "мат", "матф", "матфей", "матфея", "matthew", "mt"],
  Mark: ["мк", "мр", "марк", "марка", "mk"], Luke: ["лк", "лук", "лука", "луки", "lk"],
  John: ["ин", "иоан", "иоанн", "иоанна", "jn"], Acts: ["деян", "деяния"],
  Rom: ["рим", "римлянам", "romans"], "1Cor": ["1кор", "1коринфянам", "1corinthians"],
  "2Cor": ["2кор", "2коринфянам", "2corinthians"], Gal: ["гал", "галатам", "galatians"],
  Eph: ["еф", "ефес", "ефесянам", "ephesians"], Phil: ["флп", "фил", "филиппийцам", "philippians"],
  Col: ["кол", "колоссянам", "colossians"],
  "1Thess": ["1фес", "1сол", "1фессалоникийцам", "1солунянам", "1thessalonians"],
  "2Thess": ["2фес", "2сол", "2фессалоникийцам", "2солунянам", "2thessalonians"],
  "1Tim": ["1тим", "1тимофею", "1timothy"], "2Tim": ["2тим", "2тимофею", "2timothy"],
  Titus: ["тит", "титу"], Phlm: ["флм", "филим", "филимону", "philemon"],
  Heb: ["евр", "евреям", "hebrews"], Jas: ["иак", "иаков", "иакова", "james"],
  "1Pet": ["1пет", "1петр", "1петра", "1peter"], "2Pet": ["2пет", "2петр", "2петра", "2peter"],
  "1John": ["1ин", "1иоан", "1иоанна", "1jn"], "2John": ["2ин", "2иоан", "2иоанна", "2jn"],
  "3John": ["3ин", "3иоан", "3иоанна", "3jn"], Jude: ["иуд", "иуда", "иуды"],
  Rev: ["откр", "откровение", "апок", "апокалипсис", "revelation"],
};

function normalizeBook(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е")
    .replace(/^(?:первая|первое|first|1st)\s+/u, "1 ")
    .replace(/^(?:вторая|второе|second|2nd)\s+/u, "2 ")
    .replace(/^(?:третья|третье|third|3rd)\s+/u, "3 ")
    .replace(/^(?:четвертая|четвертое|fourth|4th)\s+/u, "4 ")
    .replace(/^евангелие\s+от\s+/u, "")
    .replace(/^([1-4]\s*)?(?:послание(?:\s+к)?|книга(?:\s+пророка)?)\s+/u, "$1")
    .replace(/^iii(?=\s|[а-яa-z])/u, "3").replace(/^ii(?=\s|[а-яa-z])/u, "2")
    .replace(/^iv(?=\s|[а-яa-z])/u, "4").replace(/^i(?=\s|[а-я])/u, "1")
    .replace(/[.\s]/gu, "");
}
const BOOK_ALIASES = new Map(Object.entries(BOOK_NAMES).flatMap(([osis, aliases]) =>
  [osis, ...aliases].map((alias) => [normalizeBook(alias), osis] as const)));

export interface ScriptureReference {
  book: string;
  chapter: number;
  verse: number;
  endVerse: number;
  osis: string;
}

/** Single verses and bounded same-chapter ranges; no guessed Psalm renumbering. */
export function parseReference(raw: string): ScriptureReference | null {
  if (raw.length > MAX_QUERY_LENGTH) return null;
  const query = raw.normalize("NFKC").trim();
  const match = query.match(/^(.+?)\s*[.]?\s*(\d{1,3})\s*[:.,]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?$/u);
  if (!match) return null;
  const book = BOOK_ALIASES.get(normalizeBook(match[1]));
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  const endVerse = match[4] ? Number(match[4]) : verse;
  if (!book || chapter < 1 || chapter > 150 || verse < 1 || verse > 176 ||
      endVerse < verse || endVerse > 176 || endVerse - verse >= MAX_REFERENCE_RANGE) return null;
  return { book, chapter, verse, endVerse, osis: `${book}.${chapter}.${verse}` };
}

// Conversational wrappers should not outrank the remembered words of a quotation.
const STOP_WORDS = new Set(("а без бы был была были было быть в вам вас весь во вот все где да для до его ее если есть еще же за зачем и из или им их как какая какие какой когда кто ли мне мной мы на над нам нас не него нет ни но ну о об он она они от по под при про с сам себе со так там те тем то того тоже ты у уже что чтобы это я сказано сказали библии писании " +
  "a an and are as at be been bible but by can did do does for from had has have how i in is it me my of on or our says said say scripture she so than that the their them then there these they this those to us was we were what when where which who why will with you your").split(" "));

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/gu, " ");
}

export function prepareSearchQuery(raw: string) {
  // Reject oversized input rather than silently searching an unrelated prefix.
  if (typeof raw !== "string" || raw.length > MAX_QUERY_LENGTH) return null;
  const reference = parseReference(raw);
  const phrase = normalizeSearchText(raw);
  const terms = [...new Set(phrase.split(" ").filter((term) =>
    term.length >= 2 && term.length <= 48 && !STOP_WORDS.has(term)))].slice(0, MAX_QUERY_TERMS);
  if (!reference && (phrase.length < 2 || terms.length === 0)) return null;
  return {
    reference, phrase, terms: reference ? [] : terms,
    configuration: /[а-яё]/iu.test(raw) ? "russian" as const : "english" as const,
  };
}

export type SearchQuery = NonNullable<ReturnType<typeof prepareSearchQuery>>;

/** Restore SQL relevance order after Prisma's unordered IN hydration. */
export function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => { const row = byId.get(id); return row ? [row] : []; });
}

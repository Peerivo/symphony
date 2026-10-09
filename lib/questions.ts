export function normalizeQuestion(input: string) {
  return input
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/[«»„“”"'’]/g, "")
    .replace(/[!?.,:;()[\]{}—–-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function utcDayBucket(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

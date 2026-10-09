export function rightsLabel(status: string) {
  const labels: Record<string,string> = { PUBLIC_DOMAIN: 'общественное достояние', LICENSED: 'по лицензии', PERMISSION_GRANTED: 'разрешение правообладателя', LINK_ONLY: 'только ссылки', RESTRICTED: 'ограничены', UNKNOWN: 'не подтверждены' };
  return labels[status] || status;
}
export function sourceHref(locator: string | null | undefined, canonical: string | null | undefined) {
  for (const candidate of [locator, canonical]) {
    try { const url = new URL(candidate || ''); if (['https:','http:'].includes(url.protocol) && !url.username && !url.password) return url.href; } catch { /* Text locators remain labels, never executable URLs. */ }
  }
  return undefined;
}

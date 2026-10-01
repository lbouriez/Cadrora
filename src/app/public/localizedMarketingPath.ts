/** Keep indexable marketing navigation on an explicit FR or EN URL. */
export function localizedMarketingPath(path: string, language: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const match = /^(?<pathname>[^?#]*)(?<suffix>[?#].*)?$/u.exec(path);
  const pathname = match?.groups?.pathname ?? path;
  if (/^\/(?:fr|en)(?:\/|$)/u.test(pathname)
    || !/^\/(?:services|portfolio(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?|about|contact|privacy)?\/?$/u.test(pathname)) return path;
  return `/${language.startsWith('en') ? 'en' : 'fr'}${pathname === '/' ? '' : pathname}${match?.groups?.suffix ?? ''}`;
}

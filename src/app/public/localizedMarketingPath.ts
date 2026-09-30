/** Keep indexable marketing navigation on an explicit FR or EN URL. */
export function localizedMarketingPath(path: string, language: string): string {
  if (!/^\/(?:services|portfolio(?:\/[^/?#]+)?|about|contact|privacy)?\/?$/u.test(path)) return path;
  return `/${language.startsWith('en') ? 'en' : 'fr'}${path === '/' ? '' : path}`;
}

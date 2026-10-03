/** Only these dynamic client routes need an HTML shell; unknown URLs stay 404. */
export function clientDocumentPath(pathname: string): string | null {
  if (/^\/admin\/?$/u.test(pathname) || /^\/e\/[^/]+(?:\/find|\/photo\/[^/]+)?\/?$/u.test(pathname)) return '/';
  if (/^\/admin\/(?:login|galleries|settings|portfolio|about|diagnostics)\/?$/u.test(pathname)
    || /^\/admin\/galleries\/[^/]+(?:\/import|\/selections)?\/?$/u.test(pathname)
    || /^\/admin\/portfolio\/[^/]+\/?$/u.test(pathname)) return '/';
  return null;
}

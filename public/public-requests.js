// Start optional metadata independently of the application bundle. Never request images here.
(() => {
  if (window.cadroraPublicRequestsConsumed) return;
  const pathname = window.location.pathname.replace(/^\/(?:fr|en)(?=\/|$)/u, '').replace(/\/$/u, '') || '/';
  if (!/^\/(?:about|services|portfolio(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?|galleries|contact|privacy)?$/u.test(pathname)) return;
  const requests = new Map();
  window.cadroraInitialPublicRequests = requests;
  const urls = ['/api/v1/site'];
  if (pathname === '/' || pathname === '/services') urls.push('/api/v1/services');
  for (const url of urls) requests.set(url, fetch(url).catch(() => Response.error()));
})();

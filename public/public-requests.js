// Start optional metadata independently of the application bundle. Never request images here.
(() => {
  if (window.cadroraPublicRequestsConsumed) return;
  if (!/^\/(?:about|services|portfolio(?:\/[^/]+)?|galleries|contact|privacy)?$/u.test(window.location.pathname)) return;
  const requests = new Map();
  window.cadroraInitialPublicRequests = requests;
  const urls = ['/api/v1/site'];
  if (window.location.pathname === '/' || window.location.pathname === '/services') urls.push('/api/v1/services');
  for (const url of urls) requests.set(url, fetch(url).catch(() => Response.error()));
})();

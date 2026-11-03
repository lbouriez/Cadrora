declare global {
  interface Window {
    cadroraInitialPublicRequests?: Map<string, Promise<Response>>;
    cadroraPublicRequestsConsumed?: boolean;
  }
}

/** Consume the optional early GET once; api.ts remains the validation boundary. */
export function takeInitialPublicRequest(url: string) {
  if (typeof window !== 'undefined') window.cadroraPublicRequestsConsumed = true;
  const snapshot = url === '/api/v1/site' && typeof document !== 'undefined'
    ? document.getElementById('cadrora-initial-site') : null;
  if (snapshot) {
    snapshot.remove();
    return Promise.resolve(new Response(snapshot.textContent, { headers: { 'Content-Type': 'application/json' } }));
  }
  const requests = typeof window === 'undefined' ? undefined : window.cadroraInitialPublicRequests;
  const response = requests?.get(url);
  requests?.delete(url);
  return response;
}

/** Verify account and active zone before Wrangler creates any remote resource. */
export async function verifyAccountZone({ accountId, hostname, token, fetcher = fetch }) {
  if (!/^[a-f0-9]{32}$/u.test(accountId)) throw new Error('CLOUDFLARE_ACCOUNT_ID must be a 32-character Cloudflare account ID.');
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is required for an isolated instance deployment.');

  const parts = hostname.split('.');
  for (let offset = 0; offset < parts.length - 1; offset += 1) {
    const zoneName = parts.slice(offset).join('.');
    const url = new URL('https://api.cloudflare.com/client/v4/zones');
    url.searchParams.set('account.id', accountId);
    url.searchParams.set('name', zoneName);
    url.searchParams.set('match', 'all');
    const response = await fetcher(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Cloudflare zone preflight failed (HTTP ${response.status}). Check Zone Read on the account-scoped token.`);
    const body = await response.json();
    if (body.success !== true || !Array.isArray(body.result)) {
      throw new Error('Cloudflare zone preflight returned an invalid response. No resources were created.');
    }
    const zone = body.result.find((candidate) => candidate.name === zoneName && candidate.account?.id === accountId);
    if (zone) {
      if (zone.status !== 'active') throw new Error(`Cloudflare zone ${zoneName} is not active. No resources were created.`);
      return { zoneId: zone.id, zoneName };
    }
  }
  throw new Error(`No active Cloudflare zone for ${hostname} belongs to the selected account. No resources were created.`);
}

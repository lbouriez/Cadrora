import { describe, expect, it } from 'vitest';

import { verifyCloudflareAccessJwt } from '../../../src/server/auth';

function base64Url(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function encodeJson(value: object): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function signedAssertion(claims: object) {
  const keyPair = await crypto.subtle.generateKey(
    { hash: 'SHA-256', modulusLength: 2048, name: 'RSASSA-PKCS1-v1_5', publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ['sign', 'verify'],
  );
  if (!('privateKey' in keyPair) || !('publicKey' in keyPair)) throw new Error('Expected an RSA key pair');
  const header = encodeJson({ alg: 'RS256', kid: 'test-key', typ: 'JWT' });
  const payload = encodeJson(claims);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  return { assertion: `${header}.${payload}.${base64Url(new Uint8Array(signature))}`, publicKey };
}

describe('Cloudflare Access JWT validation', () => {
  const issuer = 'https://team.cloudflareaccess.com';
  const audience = 'cadrora-admin-audience';
  const now = 1_900_000_000_000;

  it('requires a valid RS256 signature, issuer, audience, and future expiry', async () => {
    const { assertion, publicKey } = await signedAssertion({
      aud: [audience],
      email: 'owner@example.test',
      exp: Math.floor(now / 1_000) + 300,
      iss: issuer,
      sub: 'access-subject',
    });
    const fetcher: typeof fetch = () => Promise.resolve(new Response(JSON.stringify({ keys: [{ ...publicKey, kid: 'test-key' }] }), { status: 200 }));

    await expect(verifyCloudflareAccessJwt(assertion, issuer, audience, { fetcher, now: () => now })).resolves.toMatchObject({
      authMode: 'cloudflare-access',
      subject: 'owner@example.test',
    });
    await expect(verifyCloudflareAccessJwt(assertion, issuer, 'other-audience', { fetcher, now: () => now })).resolves.toBeNull();
    await expect(verifyCloudflareAccessJwt(`${assertion}x`, issuer, audience, { fetcher, now: () => now })).resolves.toBeNull();
  });

  it('rejects bad issuer and expiry even with a valid signature', async () => {
    const { assertion, publicKey } = await signedAssertion({
      aud: audience,
      exp: Math.floor(now / 1_000) - 1,
      iss: 'https://other.cloudflareaccess.com',
      sub: 'access-subject',
    });
    const fetcher: typeof fetch = () => Promise.resolve(new Response(JSON.stringify({ keys: [{ ...publicKey, kid: 'test-key' }] }), { status: 200 }));

    await expect(verifyCloudflareAccessJwt(assertion, issuer, audience, { fetcher, now: () => now })).resolves.toBeNull();
  });
});

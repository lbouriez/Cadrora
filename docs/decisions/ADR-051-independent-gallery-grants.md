# ADR-051: Independent gallery access cookies

Status: accepted, 2026-10-25, following the maintainer's request to fix concurrent private-gallery access.

## Decision

Issue each protected gallery grant in its own `__Host-cadrora-event-grant-<encoded-id>` cookie. The suffix is the base64url encoding of the canonical gallery ID, not a slug. Cookies retain `Path=/`, `HttpOnly`, `Secure`, `SameSite=Strict`, and the existing bounded expiry. The signed grant payload remains `eventId`, `accessVersion`, and its existing expiry claim; no visitor identity or additional privilege is introduced.

Resolve the requested grant after D1 maps a public slug or ID to the canonical gallery. Media routes resolve by their validated gallery ID. Only the requested scoped token is verified, keeping work independent of the number of other galleries the browser has unlocked. Existing authentication middleware may also verify the one legacy cookie during migration. All availability, current access-version, same-origin mutation, and private-cache checks remain mandatory.

Read the original `__Host-cadrora-event-grant` cookie as a fallback when the requested scoped cookie is absent. New unlocks do not overwrite it, so opening another gallery does not discard existing access during migration. A present scoped cookie takes precedence even when malformed, expired, forged, or stale; it cannot fall back to an older legacy grant. Signed IDs must match the requested canonical gallery. Legacy cookies expire naturally under their existing lifetime.

## Consequences

Different tabs can use different galleries concurrently, including simultaneous unlock responses, without a shared-cookie last-write race. Password rotation still revokes only grants with the old gallery access version. Browser cookie retention limits still apply, but signature verification does not scan every gallery token. No new dependency or data migration is needed.

Validation covers two galleries through slug-based API and media routes, independent rotation, legacy coexistence, secure cookie attributes, expiry, forgery, wrong-gallery tokens, and unchanged private cache headers.

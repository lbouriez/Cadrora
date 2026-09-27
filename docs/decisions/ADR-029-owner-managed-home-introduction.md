# ADR-029: Owner-managed Home introduction

Status: accepted by the owner's 2026-09-27 implementation request. This extends ADR-008, ADR-013, ADR-027, and ADR-028.

The fixed two-button portion below is superseded by [ADR-030](ADR-030-configurable-home-actions.md).

## Context

The Home introduction text, buttons, photo, and photo tag were compiled into the site profile. The owner needs to edit them without a deployment while keeping the sample content as a resettable fallback. The first Home photo is also the likely largest contentful paint element, so its URL must be known before the settings request finishes.

## Decision

- Store one optional, schema-validated FR/EN `home_hero_copy` document in D1 with label, title, lead, photo alt text, optional tag, two button labels, two safe internal destinations, and a switch for the second button. The existing `/api/v1/site` response carries this document; Home adds no JSON request.
- Keep the compiled site profile as fallback and as the reset target. Admin presents the editor inside a collapsed Home section. Saving the introduction is independent from saving the other site settings. Reset clears the copy override and photo selection together.
- Reuse the service image encoder, verified upload, private R2 storage, variant rows, quota accounting, and retryable cleanup. A reserved `home-hero` media owner is excluded from the service catalog. All four 320/640/960/1280 px variants must be present before publication, and source images must be at least 1280 px wide.
- The static Home client requests stable `/home-hero-image/*` variant paths on its first render. The Worker checks D1 for a published override and streams its versioned R2 object through the existing marketing media cache. If no override or D1 is unavailable, it serves the compiled profile image from static assets. The selected profile's default photo URL is mirrored into a Worker variable at build/deploy time. The browser alias has a 60-second cache lifetime, matching public settings; the inner versioned object may stay cached at the edge. Admin preview adds the image revision to the alias URL so an edit appears immediately there.
- Keep the Home HTML route a static asset. The photo is an independent image request. Admin changes to text can appear after the public settings cache expires; a newly uploaded photo is available on the next image request.

## Consequences

Home retains usable compiled text and imagery during a D1 outage. A photo alias needs one small Worker/D1 lookup even for the compiled default, so Lighthouse performance must be checked against the previous live page before release. Site profiles must keep `site.ts` and `profile.json` hero image URLs aligned.

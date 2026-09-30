# ADR-045: Localized marketing URLs and optional gallery translations

Status: accepted, 2026-09-30.

## Context

FR and EN previously rendered at the same marketing URL. Static HTML had one generic title and description, so social crawlers could not see the selected language or a page-specific preview. The seeded gallery titles and descriptions were French-only even when the interface was in English. Atelier Giulia's photo-led Home needs a small amount of meaningful readable copy and a direct way to choose a session panel without changing its full-screen design.

## Decision

- Build static HTML at `/fr/` and `/en/` for Home, Sessions, Portfolio, About, Contact, and Privacy. Each file has a localized title, description, canonical, reciprocal `hreflang`, Open Graph/Twitter preview, and readable fallback content. Keep the legacy unprefixed marketing routes; their canonical points to the selected localized version after the client starts. Marketing traffic remains on static assets and does not acquire Worker-first routing.
- The build-time profile owns its canonical origin and bilingual page metadata. Core code validates those values and generates both language files. Search terms belong in useful headings, titles and descriptions; there is no `meta keywords` tag because Google does not use it.
- The shared public shell reads the owner-entered service area (or contact address) from Admin → Contact. Once public settings load, it adds that value to page descriptions and `Organization.areaServed`. The static fallback makes no location claim when D1 is unavailable. Do not invent a location or infer one from request headers.
- Marketing previews use the public `/home-hero-image/large` route. It serves the owner's published hero photo when available and falls back to the compiled profile photo when D1 is unavailable. The route does not expose private gallery media.
- Optional `events.localized_copy` is a validated FR/EN JSON object. The migration backfills the three existing example galleries, and the demo seed fills them on fresh installs. Legacy owner galleries keep their original title and description until they have translations. Public API responses include the optional copy; cards and gallery headings select the current language. The existing `title` and `description` columns remain compatible with clients and admin flows.
- Atelier's shared vertical slider gains optional, keyboard-accessible slide dots with 44 px hit areas. Its first panel includes the existing bilingual introduction copy. Other slider uses keep their current behavior.

## Consequences

Search crawlers and link previews can read distinct FR/EN static metadata without executing JavaScript. Google can also render owner-managed content after the initial HTML. An owner change to Contact updates the client-rendered SEO description and structured data; static social previews still use build-time copy because marketing HTML remains static. Customer gallery URLs remain unlisted and `noindex,nofollow`.

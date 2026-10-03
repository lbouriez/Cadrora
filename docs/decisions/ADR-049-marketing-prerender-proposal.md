# ADR-049: Marketing HTML rendering proposal

Status: Proposed; requires human validation. No runtime or routing contract is changed by this document.

## Context and evidence

The October 2026 target is Lighthouse 100 for Cadrora, with a complete, styled first screen and high-quality photography. Atelier inherits common improvements after Cadrora is validated. Current marketing HTML contains a branded startup document; React and validated optional metadata precede the actual page.

Local experiments at revision `7229793` used Lighthouse 13.5.0 and Chrome 154, simulated mobile throttling, identical local static serving and cached public API fixtures. Single baseline Home and Sessions runs scored 92; inlining the entry CSS scored 87/92, and an early validated bootstrap scored 83/90. Those experiments were discarded. They do not establish production regressions or statistical significance.

A deliberately incomplete, noninteractive rendering of the existing components into HTML scored 100/100. It removed application scripts and mostly retained small previews. This is an exploratory upper bound, **not evidence that an equivalent interactive site already reaches 100**, and cannot be deployed. A complete equivalent prototype is a required acceptance gate below.

The retained, separately validated first-frame correction preserves the identity until the real hero is ready and removes priority downloads for gallery covers below the fold. It does not claim to solve the architectural rendering delay or achieve 100.

## Proposed direction

Start with Cadrora Home and Sessions in a preview. Render the shared public React components using a validated, current public data snapshot in the existing Worker. Hydrate the same component tree and query snapshot in the browser instead of replacing the page. Keep the existing compiled, styled fallback when optional data or rendering is unavailable. This introduces no framework or additional service.

This would explicitly replace the current `no SSR` constraint and narrowly extend Worker-first marketing routing. Home and Contact must still remain useful during D1 failure through their existing static assets; private gallery and admin routing, authorization and cache exclusions remain unchanged. Contact need not move into the initial prototype. Do not use a global Worker-first wildcard.

The first screen retains the branded identity while its required styles, display photo and critical controls prepare. Reveal it once, using the existing shared fade and reduced-motion behavior. Preserve image DOM nodes through hydration and keep native navigation usable. All photos continue through `ProgressivePhoto` / `BrandPhoto`; an already-complete image must be detected during hydration because its load event may have occurred earlier. Initial visibility, locale, theme and component identifiers must agree between HTML and hydration.

## Publication and cache contract to implement

- Read only public DTOs, validated with the existing shared schemas. Never serialize admin settings, secrets, private galleries, user-specific grants or biometric data.
- Add a monotonic public presentation revision in D1. Relevant owner text, visibility, ordering and image publication mutations advance it transactionally. Existing D1 photo revision and media access checks remain authoritative.
- Resolve the current revision and a consistent snapshot before choosing cached HTML. Cache keys include instance/hostname, renderer deployment version, language, route and presentation revision. Recheck the revision before publishing a newly rendered cache entry; retry or fall back if it changed while reading.
- Never reuse an old cached revision merely because its TTL has not expired. HTML/media for unpublished content must not remain available through this path. Sessions' existing disabled-page behavior remains a 404, including when data cannot safely establish availability.
- A cache miss renders from the current snapshot; failures return the safe existing static fallback where allowed. Measure D1 reads, Worker CPU, TTFB and cache behavior before acceptance. Cloudflare Cache API entries are local to a data center, so cache warming is an optimization, not a correctness requirement.
- Serialize hydration data with safe JSON escaping and the existing CSP. Do not introduce inline executable scripts or relax security headers to make the prototype work.

## Alternatives considered

Build-only prerendering fits the static architecture, but a build snapshot becomes stale after an admin edit. Rendering it immediately could request an old photo before the browser learns about the replacement. Waiting for browser validation avoids that error but preserves part of the current critical path. It remains a candidate for measurement, not an assumed equivalent solution.

A separate HTML publication pipeline introduces another durable artifact and repair workflow. It would need revision fencing and deletion semantics comparable to the existing media pipeline. It is a larger change than a bounded rendering/cache path in the existing Worker.

More aggressive image compression cannot remove JavaScript/metadata/rendering dependencies. The upload presets remain available without reducing gallery download quality.

## Acceptance before adopting or deploying

1. Compare five cold runs per route/device against the same baseline, Lighthouse/Chrome version and content. Report median, range, FCP, LCP, TBT and CLS. Target median 100; do not accept a higher score obtained by removing controls, changing consent, lowering display resolution or shrinking content.
2. Verify FR/EN Home and Sessions at mobile/desktop widths, with identical published image revision and rendered quality. Exercise navigation, language, theme, consent and session dialogs; measure responsive interactions as well as initial load.
3. Delay JS, CSS, metadata, fonts and the first display image independently. The viewport must show the styled identity, then one complete first frame. No raw text, stale/default photo request, duplicated image node or hydration replacement is allowed. Exercise cached images, failed sources, reduced motion, back/forward and direct links.
4. Edit text, replace a photo, reorder/disable a session, and race a publish against cache generation. Verify the new revision immediately, including across separately populated cache locations. Simulate D1/render/cache failure and preserve safe fallbacks and disabled-page behavior.
5. Check public/private cache separation, preview hostnames, CSP, accessibility and metadata. Run `npm run check`, `npm run test`, both profile builds and the relevant browser suites. Keep Atelier's existing first-frame tests green before considering a rollout there.
6. Obtain exact-commit preview evidence. Only then update the frozen contracts and deployment strategy, subject to the human validation required by `docs/technical/README.md`.

## References

- [React hydration contract](https://react.dev/reference/react-dom/client/hydrateRoot): initial server/client output must match; early replacement defeats hydration.
- [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/): data-center-local caching and supported response behavior.
- Existing rules: `docs/technical/README.md`, `docs/technical/contracts.md`, `docs/architecture.md`, ADR-048.

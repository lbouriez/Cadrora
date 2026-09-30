# ADR-043: Vertical Home sessions use Swiper

Status: accepted by the owner's 2026-09-30 reference request. Updates the Home interaction in ADR-039.

## Context

The Atelier Giulia Home previously animated `window.scrollY` between full-height panels with custom wheel, touch, and keyboard handlers. Momentum and changing viewport or session data made that animation less smooth than the requested [Swiper reference](https://swiperjs-slider-homepage.webflow.io/).

## Decision

- Add a pinned, bundled `swiper` dependency behind a reusable `VerticalStorySlider` component. The profile-selected Home supplies its own slide content and styles. The public page remains a static React asset and makes no runtime request to the reference site or a CDN.
- Use Swiper's vertical transform, 1200 ms transition, photo and text parallax, wheel input, touch input, and keyboard navigation. Prevent another slide change during the transition. Respect reduced motion with an immediate transition and no parallax.
- Keep owner-managed Home session ordering, bilingual copy, published photos, the shared header and booking link, and the existing footer. Release wheel and touch input at the first and last slide so the document can scroll to the footer. Keep inactive slides out of sequential focus and assistive technology navigation.
- Remove the custom document-scroll gesture hook. The shared Cadrora card Home remains unchanged.

## Consequences

The Swiper module is bundled only for the Home presentation that imports it. Slide movement no longer depends on measured document scroll positions, so owner updates can replace or reorder sessions without recalculating snap points. The dependency adds client bundle weight; local build and browser checks must cover performance, wheel and touch edges, keyboard use, reduced motion, and desktop/mobile layout.

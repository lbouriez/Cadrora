# ADR-038: Larger owner-managed marketing photos

Status: accepted, 2026-09-29. This updates the prepared marketing image recipe in ADR-028 and ADR-029.

## Context

Atelier Giulia will present its owner-managed Sessions as full-screen Home slides. The shared Services, Home introduction, and Portfolio photo pipeline currently stops at 1280 px, which is too small for a large display. Already published images must continue to resolve without a bulk re-upload or D1 migration.

## Decision

- Keep the four marketing variant names, routes, D1 rows, and required publication checks. Encode new `preview`, `small`, `medium`, and `large` variants at maximum widths of 320, 640, 1280, and 2560 px respectively. The browser continues to normalize orientation, remove metadata, and verify the encoded WebP/JPEG upload. No original or download variant is stored for marketing images.
- Do not upscale Service or Portfolio source photos. Their public image source arrays use the actual width recorded in D1, so existing 960/1280 px variants and new 1280/2560 px variants can coexist.
- Require a source at least 2560 px wide for new Home introduction uploads. Add nullable published medium and large widths to the existing public site settings response so its stable image aliases receive accurate browser `srcset` descriptors. The static profile fallback keeps its existing 960/1280 px responsive assets. Existing Home overrides report their recorded widths.
- Keep gallery photo preparation and optional original delivery separate. The four marketing variants remain subject to the existing verified upload, quota, R2 presence, current-revision, and delayed cleanup checks.
- Permit encoded marketing image heights up to 8000 px so a 2560 px wide portrait can pass the upload header contract. Keep the 4000 px header width cap and 8 MB encoded-byte cap.

## Consequences

New large marketing variants use more browser encoding time, storage, and desktop transfer bytes. Responsive source selection still avoids downloading the large copy on small screens. Existing photos are not enlarged retroactively; the owner can replace a photo to obtain a 2560 px variant. No migration or new dependency is required.

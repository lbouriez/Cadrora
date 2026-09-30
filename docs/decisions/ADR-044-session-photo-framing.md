# ADR-044: Owner-managed session photo framing

Status: accepted by the owner's 2026-09-30 implementation request. Extends ADR-028.

## Decision

Each session stores `photo_alignment` (`left`, `center`, or `right`, default `center`) and nullable `mobile_photo_alignment` in D1. Null inherits the default. Migration 041 preserves existing centered framing. The public and admin service schemas expose `photoAlignment` and `mobilePhotoAlignment`; PATCH accepts optional fields, retaining stored values when omitted and clearing a phone override only on explicit null. Only manage-authorized owners may write them.

The session editor offers localized selectors, a default crop preview, and a phone Home preview sharing the public slide content. The phone override applies at the shared mobile navigation breakpoint (54rem) on Home and Sessions; larger screens use the default. Both progressive image layers use the same alignment. The image files, revisions, and variant publication pipeline remain unchanged, and framing can be edited without another upload. Restoring a built-in example resets its framing to center with no phone override. Compiled fallback cards retain centered framing.

## Consequences and validation

This is presentation metadata, not destructive image cropping. A focal point cannot guarantee every subject fits every aspect ratio; previews help owners choose. No dependencies or routing changes are required. Apply migration 041 before deploying the Worker. Validate API persistence, omitted-field compatibility, explicit override removal, example reset, FR/EN editor save/reload, preview and optimized image alignment, desktop/phone crops, local D1 migration, check, tests, and both profile builds.

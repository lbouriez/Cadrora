# ADR-042: Photo-proportioned gallery viewer

Status: accepted on 2026-09-30 following the owner's request to adapt the modal to the photo.

## Decision

The shared gallery and portfolio viewer sizes its frame from the selected photo's width and height, bounded by the viewport. Portrait, landscape, and panoramic photos retain their full composition without coloured side panels. Selecting another photo or resizing the viewport recalculates the frame.

Desktop frames retain rounded corners and the blurred page backdrop. Smaller screens use the available viewport in the limiting dimension and square corners. The photo preview and optimized image use `contain`; the preview is not enlarged. The extra photo-derived ambient layer is removed. Keyboard, swipe, thumbnail navigation, focus trapping, and gallery access rules remain unchanged.

## Validation

Browser coverage checks frame proportions for landscape and portrait photos on desktop and phone, navigation between those proportions, actual image fit, transparent image frames, and Escape close. Both site profiles must build successfully.

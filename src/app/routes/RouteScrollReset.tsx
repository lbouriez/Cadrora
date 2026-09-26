import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

function isSameGalleryViewerTransition(previousPath: string, nextPath: string): boolean {
  const galleryPath = /^\/e\/([^/]+)(?:\/photo\/[^/]+)?$/;
  const previous = galleryPath.exec(previousPath);
  const next = galleryPath.exec(nextPath);
  return previous !== null && next !== null && previous[1] === next[1]
    && (previousPath.includes('/photo/') || nextPath.includes('/photo/'));
}

/** Start new pages at the top while preserving in-page anchors and photo viewer position. */
export function RouteScrollReset() {
  const location = useLocation();
  const previousLocation = useRef(location);

  useLayoutEffect(() => {
    const from = previousLocation.current;
    previousLocation.current = location;
    if (from.key === location.key || location.hash
      || (from.pathname === location.pathname && from.search !== location.search)
      || isSameGalleryViewerTransition(from.pathname, location.pathname)) return;
    window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
  }, [location]);

  return null;
}

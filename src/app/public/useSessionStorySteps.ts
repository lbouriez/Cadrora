import { useEffect, useRef } from 'react';

const WHEEL_THRESHOLD = 45;
const WHEEL_GESTURE_IDLE_MS = 500;
const WHEEL_NEW_TICK_GAP_MS = 180;
const WHEEL_DISTINCT_TICK = 80;
const TOUCH_THRESHOLD = 55;
const TRANSITION_MS = 650;

/** Advance one full-height session per wheel or touch gesture, regardless of its momentum. */
export function useSessionStorySteps(panelCount: number) {
  const storyRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const story = storyRef.current;
    if (!story || panelCount < 2) return;
    let frame = 0;
    let transitioning = false;
    let wheelLastAt = 0;
    let wheelDistance = 0;
    let wheelConsumed = false;
    let wheelPeak = 0;
    let touchStart: { x: number; y: number; scrollY: number; index: number } | null = null;

    const snapPoints = () => {
      // Owner data can replace fallback panels without changing their count.
      const panels = story.querySelectorAll<HTMLElement>('.session-story__panel');
      const storyTop = story.getBoundingClientRect().top + window.scrollY;
      const maximum = document.documentElement.scrollHeight - window.innerHeight;
      let position = storyTop;
      const points = [...panels].map((panel) => {
        const point = Math.min(position, maximum);
        position += panel.offsetHeight;
        return point;
      });
      return [...points, Math.min(position, maximum)];
    };
    const nearestIndex = (points: number[]) => points.reduce((best, point, index) =>
      Math.abs(point - window.scrollY) < Math.abs((points[best] ?? 0) - window.scrollY) ? index : best, 0);
    const moveTo = (toIndex: number) => {
      if (transitioning) return;
      const points = snapPoints();
      if (points.length < 3) return;
      const destination = points[Math.max(0, Math.min(points.length - 1, toIndex))] ?? window.scrollY;
      const start = window.scrollY;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion || Math.abs(destination - start) < 1) {
        window.scrollTo({ top: destination, behavior: 'instant' });
        return;
      }
      transitioning = true;
      const duration = Math.max(180, TRANSITION_MS * Math.min(1, Math.abs(destination - start) / window.innerHeight));
      let startedAt: number | null = null;
      const animate = (now: number) => {
        startedAt ??= now;
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - (1 - progress) ** 3;
        window.scrollTo(0, start + (destination - start) * eased);
        if (progress < 1) frame = window.requestAnimationFrame(animate);
        else transitioning = false;
      };
      frame = window.requestAnimationFrame(animate);
    };
    const move = (direction: -1 | 1) => {
      const points = snapPoints();
      if (points.length < 3) return;
      moveTo(nearestIndex(points) + direction);
    };
    const canStep = (direction: -1 | 1) => {
      if (document.querySelector('.public-shell--menu-open')) return false;
      const points = snapPoints();
      if (points.length < 3) return false;
      const index = nearestIndex(points);
      return direction > 0 ? index < points.length - 1 : index > 0;
    };
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (event.target instanceof Element && event.target.closest('.privacy-consent, [role="dialog"]')) return;
      const direction = event.deltaY > 0 ? 1 : -1;
      if (!canStep(direction)) return;
      event.preventDefault();
      const now = performance.now();
      const distance = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1);
      const gap = now - wheelLastAt;
      if (gap > WHEEL_GESTURE_IDLE_MS
        || (wheelConsumed && !transitioning && gap > WHEEL_NEW_TICK_GAP_MS
          && Math.abs(distance) >= WHEEL_DISTINCT_TICK && Math.abs(distance) >= wheelPeak)) {
        wheelDistance = 0;
        wheelConsumed = false;
        wheelPeak = 0;
      }
      wheelLastAt = now;
      wheelPeak = Math.max(wheelPeak, Math.abs(distance));
      if (wheelConsumed) return;
      wheelDistance += distance;
      if (Math.abs(wheelDistance) < WHEEL_THRESHOLD) return;
      wheelConsumed = true;
      move(wheelDistance > 0 ? 1 : -1);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) { touchStart = null; return; }
      if (transitioning || document.querySelector('.public-shell--menu-open')) return;
      const target = event.target;
      if (!(target instanceof Node) || !story.contains(target)) return;
      const touch = event.touches[0];
      const points = snapPoints();
      if (touch && points.length >= 3) {
        touchStart = { x: touch.clientX, y: touch.clientY, scrollY: window.scrollY, index: nearestIndex(points) };
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) { touchStart = null; return; }
      const touch = event.touches[0];
      if (!touchStart || !touch) return;
      const distanceY = touchStart.y - touch.clientY;
      if (Math.abs(distanceY) > 8 && Math.abs(distanceY) > Math.abs(touchStart.x - touch.clientX)) {
        event.preventDefault();
        const points = snapPoints();
        const previous = points[Math.max(0, touchStart.index - 1)] ?? touchStart.scrollY;
        const next = points[Math.min(points.length - 1, touchStart.index + 1)] ?? touchStart.scrollY;
        window.scrollTo(0, Math.max(previous, Math.min(next, touchStart.scrollY + distanceY)));
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      const start = touchStart;
      touchStart = null;
      const touch = event.changedTouches[0];
      if (!start || !touch) return;
      const distanceY = start.y - touch.clientY;
      if (Math.abs(distanceY) >= TOUCH_THRESHOLD && Math.abs(distanceY) > Math.abs(start.x - touch.clientX)) {
        const direction = distanceY > 0 ? 1 : -1;
        moveTo(start.index + direction);
      } else if (Math.abs(window.scrollY - start.scrollY) > 1) {
        moveTo(start.index);
      }
    };
    const onTouchCancel = () => {
      const start = touchStart;
      touchStart = null;
      if (start) moveTo(start.index);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable
        || target.closest('a, button, input, textarea, select, [role="slider"]'))) return;
      const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight'
        || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)
        ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey) ? -1 : 0;
      if (!direction || !canStep(direction)) return;
      event.preventDefault();
      if (!event.repeat) move(direction);
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchCancel);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [panelCount]);

  return storyRef;
}

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Mousewheel, Parallax } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import type SwiperInstance from 'swiper';
import 'swiper/css';

export interface VerticalStorySlide {
  id: string;
  content: ReactNode;
  label?: string;
}

export interface VerticalStorySliderProps {
  label: string;
  slides: readonly VerticalStorySlide[];
  className?: string;
  slideClassName?: string;
  motionPreference?: 'system' | 'always';
  allowDocumentScrollAtEdges?: boolean;
  onActiveIndexChange?: (index: number) => void;
  showPagination?: boolean;
  interactionDisabled?: boolean;
  onReady?: () => void;
}

function releaseWheelAtSettledEdge(swiper: SwiperInstance, settled: boolean, allowDocumentScrollAtEdges: boolean) {
  const mousewheel = swiper.params.mousewheel;
  if (typeof mousewheel === 'object' && mousewheel) {
    mousewheel.releaseOnEdges = allowDocumentScrollAtEdges && settled && (swiper.isBeginning || swiper.isEnd);
  }
}

const EDGE_SCROLL_MS = 700;

/** Full-viewport vertical slides with parallax, accessible focus, and optional document scroll at the edges. */
export function VerticalStorySlider({ label, slides, className, slideClassName,
  motionPreference = 'system', allowDocumentScrollAtEdges = true, onActiveIndexChange, showPagination = false,
  interactionDisabled = false, onReady }: VerticalStorySliderProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const swiperRef = useRef<SwiperInstance | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const animate = motionPreference === 'always' || !reducedMotion;

  useEffect(() => {
    const swiper = swiperRef.current;
    if (!swiper || swiper.destroyed) return;
    if (interactionDisabled) swiper.disable();
    else swiper.enable();
  }, [interactionDisabled]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !animate || !allowDocumentScrollAtEdges || interactionDisabled) return;
    let frame = 0;
    let exiting = false;
    const onWheel = (event: WheelEvent) => {
      const swiper = swiperRef.current;
      if (!swiper || swiper.destroyed || swiper.el.closest('[inert]')) return;
      if (exiting) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.ctrlKey || event.deltaY <= 0 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)
        || !swiper.isEnd || swiper.animating) return;
      const maximum = document.documentElement.scrollHeight - window.innerHeight;
      const sectionEnd = section.getBoundingClientRect().bottom + window.scrollY;
      const destination = Math.min(sectionEnd, maximum);
      const start = window.scrollY;
      if (destination - start < 1) return;
      event.preventDefault();
      event.stopPropagation();
      exiting = true;
      let startedAt: number | null = null;
      const step = (now: number) => {
        startedAt ??= now;
        const progress = Math.min((now - startedAt) / EDGE_SCROLL_MS, 1);
        const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
        window.scrollTo(0, start + (destination - start) * eased);
        if (progress < 1) frame = window.requestAnimationFrame(step);
        else exiting = false;
      };
      frame = window.requestAnimationFrame(step);
    };
    section.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => {
      window.cancelAnimationFrame(frame);
      section.removeEventListener('wheel', onWheel, true);
    };
  }, [allowDocumentScrollAtEdges, animate, interactionDisabled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (interactionDisabled) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable
        || target.closest('a, button, input, textarea, select, [role="dialog"]'))) return;
      const swiper = swiperRef.current;
      if (!swiper || swiper.destroyed || swiper.animating || swiper.el.closest('[inert]')) return;
      const bounds = swiper.el.getBoundingClientRect();
      if (bounds.top > window.innerHeight / 2 || bounds.bottom < window.innerHeight / 2) return;
      const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight'
        || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)
        ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey) ? -1 : 0;
      if (!direction) return;
      if ((direction > 0 && swiper.isEnd) || (direction < 0 && swiper.isBeginning)) {
        if (!allowDocumentScrollAtEdges) event.preventDefault();
        return;
      }
      event.preventDefault();
      if (!event.repeat) {
        window.scrollTo({ top: Math.max(0, swiper.el.getBoundingClientRect().top + window.scrollY), behavior: 'instant' });
        if (direction > 0) swiper.slideNext();
        else swiper.slidePrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [allowDocumentScrollAtEdges, interactionDisabled]);

  const currentIndex = Math.min(activeIndex, Math.max(0, slides.length - 1));
  return <section aria-label={label} className={className} inert={interactionDisabled} ref={sectionRef}>
    <Swiper
      aria-label={label}
      className="vertical-story-slider"
      direction="vertical"
      enabled={!interactionDisabled}
      followFinger={false}
      longSwipes={false}
      modules={[Mousewheel, Parallax]}
      mousewheel={{ forceToAxis: true, releaseOnEdges: false }}
      observeParents
      observer
      onSlideChange={(swiper) => {
        setActiveIndex(swiper.activeIndex);
        onActiveIndexChange?.(swiper.activeIndex);
        releaseWheelAtSettledEdge(swiper, false, allowDocumentScrollAtEdges);
        const top = swiper.el.getBoundingClientRect().top + window.scrollY;
        if (Math.abs(window.scrollY - top) > 1) window.scrollTo({ top, behavior: 'smooth' });
      }}
      onSlideChangeTransitionEnd={(swiper) => releaseWheelAtSettledEdge(swiper, true, allowDocumentScrollAtEdges)}
      onSwiper={(swiper) => {
        swiperRef.current = swiper;
        if (interactionDisabled) swiper.disable();
        releaseWheelAtSettledEdge(swiper, true, allowDocumentScrollAtEdges);
        onReady?.();
      }}
      parallax={animate}
      preventInteractionOnTransition
      speed={animate ? 1200 : 0}
      tabIndex={0}
      touchReleaseOnEdges={allowDocumentScrollAtEdges}
    >
      {slides.map((slide, index) => <SwiperSlide className={slideClassName} inert={index !== currentIndex}
        key={slide.id} tag="article">{slide.content}</SwiperSlide>)}
    </Swiper>
    {showPagination && slides.length > 1 ? <nav aria-label={label} className="vertical-story-slider__pagination">
      {slides.map((slide, index) => <button aria-current={index === currentIndex ? 'step' : undefined}
        aria-label={slide.label ?? `${label} ${index + 1}`} className="vertical-story-slider__page"
        key={slide.id} onClick={() => swiperRef.current?.slideTo(index)} type="button">
        <span aria-hidden="true" />
      </button>)}
    </nav> : null}
  </section>;
}

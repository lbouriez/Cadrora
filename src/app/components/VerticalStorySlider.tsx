import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Mousewheel, Parallax } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import type SwiperInstance from 'swiper';
import 'swiper/css';

export interface VerticalStorySlide {
  id: string;
  content: ReactNode;
}

export interface VerticalStorySliderProps {
  label: string;
  slides: readonly VerticalStorySlide[];
  className?: string;
  slideClassName?: string;
}

function releaseWheelAtSettledEdge(swiper: SwiperInstance, settled: boolean) {
  const mousewheel = swiper.params.mousewheel;
  if (typeof mousewheel === 'object' && mousewheel) {
    mousewheel.releaseOnEdges = settled && (swiper.isBeginning || swiper.isEnd);
  }
}

/** Full-viewport vertical slides with parallax, accessible focus, and document scroll at the edges. */
export function VerticalStorySlider({ label, slides, className, slideClassName }: VerticalStorySliderProps) {
  const swiperRef = useRef<SwiperInstance | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
      if (!direction || (direction > 0 && swiper.isEnd) || (direction < 0 && swiper.isBeginning)) return;
      event.preventDefault();
      if (!event.repeat) {
        window.scrollTo({ top: Math.max(0, swiper.el.getBoundingClientRect().top + window.scrollY), behavior: 'instant' });
        if (direction > 0) swiper.slideNext();
        else swiper.slidePrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const currentIndex = Math.min(activeIndex, Math.max(0, slides.length - 1));
  return <section aria-label={label} className={className}>
    <Swiper
      aria-label={label}
      className="vertical-story-slider"
      direction="vertical"
      followFinger={false}
      longSwipes={false}
      modules={[Mousewheel, Parallax]}
      mousewheel={{ forceToAxis: true, releaseOnEdges: false }}
      onSlideChange={(swiper) => {
        setActiveIndex(swiper.activeIndex);
        releaseWheelAtSettledEdge(swiper, false);
      }}
      onSlideChangeTransitionEnd={(swiper) => releaseWheelAtSettledEdge(swiper, true)}
      onSwiper={(swiper) => { swiperRef.current = swiper; }}
      parallax={!reducedMotion}
      preventInteractionOnTransition
      speed={reducedMotion ? 0 : 1200}
      tabIndex={0}
      touchReleaseOnEdges
    >
      {slides.map((slide, index) => <SwiperSlide className={slideClassName} inert={index !== currentIndex}
        key={slide.id} tag="article">{slide.content}</SwiperSlide>)}
    </Swiper>
  </section>;
}

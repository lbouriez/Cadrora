import useEmblaCarousel from 'embla-carousel-react';
import { Children, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { IconButton } from './IconButton';

/**
 * Token-driven horizontal carousel with keyboard-accessible controls.
 * Example: <Carousel label="Results" previousLabel="Previous" nextLabel="Next">…</Carousel>.
 */
export interface CarouselProps {
  children: ReactNode;
  className?: string;
  label: string;
  nextLabel: string;
  previousLabel: string;
}

export function Carousel({ children, className = '', label, nextLabel, previousLabel }: CarouselProps) {
  const [viewportRef, api] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps' });
  const [canScrollPrevious, setCanScrollPrevious] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const items = Children.toArray(children);
  const updateControls = useCallback(() => {
    setCanScrollPrevious(api?.canScrollPrev() ?? false);
    setCanScrollNext(api?.canScrollNext() ?? false);
  }, [api]);

  useEffect(() => {
    if (!api) return undefined;
    const frame = window.requestAnimationFrame(updateControls);
    api.on('select', updateControls);
    api.on('reInit', updateControls);
    return () => {
      window.cancelAnimationFrame(frame);
      api.off('select', updateControls);
      api.off('reInit', updateControls);
    };
  }, [api, updateControls]);

  return (
    <section aria-label={label} aria-roledescription="carousel" className={`carousel ${className}`.trim()}>
      <IconButton aria-label={previousLabel} className="carousel__arrow carousel__arrow--previous" disabled={!canScrollPrevious} onClick={() => api?.scrollPrev()}>
        <ChevronLeftIcon />
      </IconButton>
      <div className="carousel__viewport" ref={viewportRef}>
        <div className="carousel__container">
          {items.map((item, index) => (
            <div aria-label={`${String(index + 1)} / ${String(items.length)}`} aria-roledescription="slide" className="carousel__slide" key={index} role="group">
              {item}
            </div>
          ))}
        </div>
      </div>
      <IconButton aria-label={nextLabel} className="carousel__arrow carousel__arrow--next" disabled={!canScrollNext} onClick={() => api?.scrollNext()}>
        <ChevronRightIcon />
      </IconButton>
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface MotionRevealProps {
  as?: 'article' | 'div' | 'header' | 'section';
  children: ReactNode;
  className?: string;
  delay?: 0 | 1 | 2;
  id?: string;
  labelledBy?: string;
}

/** Reveal a reusable content block once it enters view; reduced-motion and no-IO browsers show it immediately. */
export function MotionReveal({ as = 'div', children, className, delay = 0, id, labelledBy }: MotionRevealProps) {
  const element = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(() => typeof window === 'undefined'
    || !('IntersectionObserver' in window)
    || Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));

  useEffect(() => {
    if (visible || !element.current || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '0px 0px -32px 0px', threshold: 0.08 });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [visible]);

  const Element = as;
  return <Element
    aria-labelledby={labelledBy}
    className={['motion-reveal', `motion-reveal--delay-${delay}`, visible ? 'motion-reveal--visible' : 'motion-reveal--pending', className].filter(Boolean).join(' ')}
    id={id}
    ref={(node) => { element.current = node; }}
  >{children}</Element>;
}

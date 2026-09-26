import { useEffect, useRef, useState } from 'react';

interface PhotoSource {
  url: string;
  width: number;
}

export interface ProgressivePhotoProps {
  alt: string;
  className?: string;
  enabled?: boolean;
  height: number;
  immediate?: boolean;
  maxQuality?: 'preview' | 'medium' | 'full';
  priority?: boolean;
  sizes: string;
  sources: readonly PhotoSource[];
  width: number;
}

/** Show a small blurred preview, then let the browser select one display-sized source. */
export function ProgressivePhoto({ alt, className, enabled = true, height, immediate = false, maxQuality = 'full', priority = false, sizes, sources, width }: ProgressivePhotoProps) {
  const frame = useRef<HTMLSpanElement>(null);
  const [nearby, setNearby] = useState(() => typeof window !== 'undefined' && !('IntersectionObserver' in window));
  const [previewReady, setPreviewReady] = useState(false);
  const [optimizedReady, setOptimizedReady] = useState(false);
  const ordered = [...sources].sort((left, right) => left.width - right.width);
  const preview = ordered[0];
  const candidates = maxQuality === 'preview' ? ordered.slice(0, 1)
    : maxQuality === 'medium' ? ordered.filter((source) => source.width <= 1600) : ordered;
  const responsiveSources = candidates.length > 0 ? candidates : ordered.slice(0, 1);

  useEffect(() => {
    const target = frame.current;
    if (!target) return;
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNearby(true);
        observer.disconnect();
      }
    }, { rootMargin: '500px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const revealOptimized = enabled && (nearby || immediate) && previewReady && responsiveSources.length > 1;
  const ready = optimizedReady || (previewReady && responsiveSources.length <= 1);

  return <span className={`progressive-photo${ready ? ' progressive-photo--ready' : ''}${className ? ` ${className}` : ''}`} ref={frame} style={{ aspectRatio: `${width} / ${height}` }}>
    {enabled && preview ? <img alt={alt} className="progressive-photo__preview" decoding="async" fetchPriority={priority ? 'high' : undefined} loading={immediate ? 'eager' : 'lazy'} onError={() => setPreviewReady(true)} onLoad={() => setPreviewReady(true)} src={preview.url} /> : null}
    {revealOptimized ? <img
      alt=""
      aria-hidden="true"
      className="progressive-photo__optimized"
      decoding="async"
      loading="eager"
      onError={() => setOptimizedReady(true)}
      onLoad={() => setOptimizedReady(true)}
      sizes={sizes}
      src={responsiveSources.at(-1)?.url}
      srcSet={responsiveSources.map((source) => `${source.url} ${source.width}w`).join(', ')}
    /> : null}
  </span>;
}

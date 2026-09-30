import { useEffect, useRef, useState } from 'react';

interface PhotoSource {
  url: string;
  width: number;
}

interface CommonPhotoProps {
  alt: string;
  className?: string;
  /** Keep the reserved frame without requesting images until their owner-managed sources resolve. */
  enabled?: boolean;
  fit?: 'cover' | 'contain';
  immediate?: boolean;
  lazyPreview?: boolean;
  maxQuality?: 'preview' | 'medium' | 'full';
  priority?: boolean;
  sizes: string;
}

export type ProgressivePhotoProps = CommonPhotoProps & (
  | { sources: readonly PhotoSource[]; src?: never; width: number; height: number }
  | { src: string; sources?: never; width?: number; height?: number }
);

/** Select a display-sized source after the preview, or render one unblurred local/static source. */
export function ProgressivePhoto({ alt, className, enabled = true, fit = 'cover', height, immediate = false, lazyPreview = false, maxQuality = 'full', priority = false, sizes, sources, src, width }: ProgressivePhotoProps) {
  const frame = useRef<HTMLSpanElement>(null);
  const [nearby, setNearby] = useState(() => typeof window !== 'undefined' && !('IntersectionObserver' in window));
  const [previewReady, setPreviewReady] = useState(false);
  const [optimizedReady, setOptimizedReady] = useState(false);
  const ordered = [...(sources ?? [])].sort((left, right) => left.width - right.width);
  const previewUrl = src ?? ordered[0]?.url;
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

  return <span className={`progressive-photo${src !== undefined ? ' progressive-photo--single' : ''}${fit === 'contain' ? ' progressive-photo--contain' : ''}${ready ? ' progressive-photo--ready' : ''}${className ? ` ${className}` : ''}`} ref={frame} style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}>
    {enabled && previewUrl && (!lazyPreview || nearby || immediate || priority) ? <img alt={alt} className="progressive-photo__preview" decoding="async" fetchPriority={priority ? 'high' : undefined} height={height} loading={immediate ? 'eager' : 'lazy'} onError={() => setPreviewReady(true)} onLoad={() => setPreviewReady(true)} src={previewUrl} width={width} /> : null}
    {revealOptimized ? <img
      alt=""
      aria-hidden="true"
      className="progressive-photo__optimized"
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      loading="eager"
      onError={() => setOptimizedReady(true)}
      onLoad={() => setOptimizedReady(true)}
      sizes={sizes}
      src={responsiveSources.at(-1)?.url}
      srcSet={responsiveSources.map((source) => `${source.url} ${source.width}w`).join(', ')}
    /> : null}
  </span>;
}

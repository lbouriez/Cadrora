import { useEffect, useLayoutEffect, useRef, useState } from 'react';

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
  const [displayWidth, setDisplayWidth] = useState<number | null>(null);
  const [pixelRatio, setPixelRatio] = useState(() => typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  const ordered = [...(sources ?? [])].sort((left, right) => left.width - right.width);
  const previewUrl = src ?? ordered[0]?.url;
  const candidates = maxQuality === 'preview' ? ordered.slice(0, 1)
    : maxQuality === 'medium' ? ordered.filter((source) => source.width <= 1600) : ordered;
  const responsiveSources = candidates.length > 0 ? candidates : ordered.slice(0, 1);
  // Published widths can be far apart. Accept at most 5% fewer physical pixels rather
  // than downloading the next variant at almost twice the required width.
  const targetWidth = (displayWidth ?? 0) * pixelRatio;
  const displaySource = responsiveSources.find((source) => source.width >= targetWidth * 0.95) ?? responsiveSources.at(-1);
  const displaySources = displayWidth ? responsiveSources.filter((source) => source.width <= (displaySource?.width ?? 0)) : responsiveSources;

  useLayoutEffect(() => {
    const target = frame.current;
    if (!target) return;
    const measure = () => {
      // Let the browser account for DPR; sizes describes CSS pixels, not physical pixels.
      setDisplayWidth(Math.ceil(target.clientWidth));
      setPixelRatio(window.devicePixelRatio || 1);
    };
    measure();
    window.addEventListener('resize', measure);
    if (typeof ResizeObserver !== 'function') {
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

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

  // Priority photos start both layers together, after owner-managed sources and frame sizing resolve.
  const revealOptimized = enabled && displayWidth !== null && (nearby || immediate || priority)
    && (previewReady || priority) && responsiveSources.length > 1;
  const ready = optimizedReady || (previewReady && responsiveSources.length <= 1);

  return <span className={`progressive-photo${src !== undefined ? ' progressive-photo--single' : ''}${priority ? ' progressive-photo--priority' : ''}${fit === 'contain' ? ' progressive-photo--contain' : ''}${ready ? ' progressive-photo--ready' : ''}${className ? ` ${className}` : ''}`} ref={frame} style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}>
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
      sizes={displayWidth ? `${displayWidth}px` : sizes}
      src={displaySources.at(-1)?.url}
      srcSet={displaySources.map((source) => `${source.url} ${source.width}w`).join(', ')}
    /> : null}
  </span>;
}

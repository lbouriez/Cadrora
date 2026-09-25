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
  sizes: string;
  sources: readonly PhotoSource[];
  width: number;
}

/** Show the smallest prepared photo first, then reveal medium and responsive full copies as they load. */
export function ProgressivePhoto({ alt, className, enabled = true, height, immediate = false, maxQuality = 'full', sizes, sources, width }: ProgressivePhotoProps) {
  const frame = useRef<HTMLSpanElement>(null);
  const [nearby, setNearby] = useState(() => typeof window !== 'undefined' && !('IntersectionObserver' in window));
  const [previewReady, setPreviewReady] = useState(false);
  const [mediumReady, setMediumReady] = useState(false);
  const [fullReady, setFullReady] = useState(false);
  const ordered = [...sources].sort((left, right) => left.width - right.width);
  const preview = ordered[0];
  const medium = ordered.find((source) => source.width >= 960 && source.width > (preview?.width ?? 0)) ?? ordered[1];
  const larger = ordered.filter((source) => source.width > (medium?.width ?? preview?.width ?? 0));

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

  const revealMedium = enabled && (nearby || immediate) && previewReady && maxQuality !== 'preview' && medium;
  const revealFull = enabled && (nearby || immediate) && previewReady && (!medium || mediumReady) && maxQuality === 'full' && larger.length > 0;
  const ready = fullReady || (mediumReady && (larger.length === 0 || maxQuality !== 'full')) || (previewReady && (maxQuality === 'preview' || (!medium && larger.length === 0)));

  return <span className={`progressive-photo${mediumReady ? ' progressive-photo--medium-ready' : ''}${ready ? ' progressive-photo--ready' : ''}${className ? ` ${className}` : ''}`} ref={frame} style={{ aspectRatio: `${width} / ${height}` }}>
    {enabled && preview ? <img alt={alt} className="progressive-photo__preview" decoding="async" loading={immediate ? 'eager' : 'lazy'} onError={() => setPreviewReady(true)} onLoad={() => setPreviewReady(true)} src={preview.url} /> : null}
    {revealMedium ? <img alt="" aria-hidden="true" className="progressive-photo__medium" decoding="async" loading="eager" onError={() => setMediumReady(true)} onLoad={() => setMediumReady(true)} src={medium.url} /> : null}
    {revealFull ? <img
      alt=""
      aria-hidden="true"
      className="progressive-photo__full"
      decoding="async"
      loading="eager"
      onLoad={() => setFullReady(true)}
      sizes={sizes}
      src={larger[0]?.url}
      srcSet={[...(medium ? [medium] : []), ...larger].map((source) => `${source.url} ${source.width}w`).join(', ')}
    /> : null}
  </span>;
}

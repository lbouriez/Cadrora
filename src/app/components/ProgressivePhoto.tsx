import { useEffect, useRef, useState } from 'react';

interface PhotoSource {
  url: string;
  width: number;
}

export interface ProgressivePhotoProps {
  alt: string;
  height: number;
  sizes: string;
  sources: readonly PhotoSource[];
  width: number;
}

/** Reserve the final layout, then crossfade a lazy small preview into a responsive image near the viewport. */
export function ProgressivePhoto({ alt, height, sizes, sources, width }: ProgressivePhotoProps) {
  const frame = useRef<HTMLSpanElement>(null);
  const [nearby, setNearby] = useState(() => typeof window !== 'undefined' && !('IntersectionObserver' in window));
  const [previewReady, setPreviewReady] = useState(false);
  const [fullReady, setFullReady] = useState(false);
  const ordered = [...sources].sort((left, right) => left.width - right.width);
  const preview = ordered[0];
  const larger = ordered.filter((source) => source.width > (preview?.width ?? 0));

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

  return <span className={`progressive-photo${fullReady || (previewReady && larger.length === 0) ? ' progressive-photo--ready' : ''}`} ref={frame} style={{ aspectRatio: `${width} / ${height}` }}>
    {preview ? <img alt={alt} className="progressive-photo__preview" decoding="async" loading="lazy" onError={() => setPreviewReady(true)} onLoad={() => setPreviewReady(true)} src={preview.url} /> : null}
    {nearby && previewReady && larger.length > 0 ? <img
      alt=""
      aria-hidden="true"
      className="progressive-photo__full"
      decoding="async"
      loading="lazy"
      onLoad={() => setFullReady(true)}
      sizes={sizes}
      src={larger[0]?.url}
      srcSet={larger.map((source) => `${source.url} ${source.width}w`).join(', ')}
    /> : null}
  </span>;
}

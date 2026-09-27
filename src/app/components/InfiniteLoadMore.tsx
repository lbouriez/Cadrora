import { useEffect, useRef } from 'react';

import { Button } from './Button';
import { Spinner } from './Spinner';

export interface InfiniteLoadMoreProps {
  error?: boolean;
  errorLabel?: string;
  hasMore: boolean;
  loadLabel: string;
  loading: boolean;
  loadingLabel: string;
  onLoadMore: () => void;
}

/** Load a cursor page near the viewport and retain a manual, keyboard accessible fallback. */
export function InfiniteLoadMore({ error = false, errorLabel, hasMore, loadLabel, loading, loadingLabel, onLoadMore }: InfiniteLoadMoreProps) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = sentinel.current;
    if (!hasMore || loading || error || !target || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        onLoadMore();
      }
    }, { rootMargin: '700px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [error, hasMore, loading, onLoadMore]);

  if (!hasMore) return null;
  return <>
    <div aria-hidden="true" className="gallery-load-sentinel" ref={sentinel} />
    {error && errorLabel ? <p role="alert">{errorLabel}</p> : null}
    {loading ? <Spinner label={loadingLabel} /> : <Button onClick={onLoadMore} type="button">{loadLabel}</Button>}
  </>;
}

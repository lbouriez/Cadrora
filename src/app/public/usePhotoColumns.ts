import { useEffect, useMemo, useRef, useState } from 'react';

/** Shared balanced mosaic layout for customer galleries and portfolio collections. */
export function usePhotoColumns<Photo extends { width: number; height: number }>(photos: Photo[]) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(() => countColumns(typeof window === 'undefined' ? 0 : window.innerWidth - 32));
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const observer = new ResizeObserver(([entry]) => setColumnCount(countColumns(entry?.contentRect.width ?? 0)));
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);
  const activeCount = Math.min(columnCount, Math.max(photos.length, 1));
  const columnWidths = useMemo(() => activeCount === 3 ? [1.18, 1, 1] : activeCount === 2 ? [1.1, 1] : [1], [activeCount]);
  const columns = useMemo(() => {
    const result = Array.from({ length: activeCount }, () => [] as Photo[]);
    const heights = Array.from({ length: activeCount }, () => 0);
    for (const photo of photos) {
      const shortest = heights.indexOf(Math.min(...heights));
      result[shortest]?.push(photo);
      heights[shortest] = (heights[shortest] ?? 0) + (photo.height / photo.width) * (columnWidths[shortest] ?? 1);
    }
    return result;
  }, [activeCount, columnWidths, photos]);
  return { columns, columnWidths, gridRef };
}

function countColumns(width: number): number {
  return width >= 1320 ? 3 : width >= 720 ? 2 : 1;
}

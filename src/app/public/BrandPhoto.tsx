import dimensions from '../../shared/brand-photo-dimensions.json';
import { ProgressivePhoto } from '../components';

interface BrandPhotoProps {
  alt: string;
  className?: string;
  immediate?: boolean;
  lazyPreview?: boolean;
  fit?: 'cover' | 'contain';
  width?: number;
  height?: number;
  onVisualReady?: (() => void) | undefined;
  visualReadyAt?: 'preview' | 'display';
  priority?: boolean;
  sizes: string;
  src: string;
}

/** Build-time brand photos use the same preview and responsive display path as gallery media. */
export function BrandPhoto({ alt, className, fit = 'cover', height, immediate = false, lazyPreview = false, onVisualReady, visualReadyAt = 'preview', priority = false, sizes, src, width }: BrandPhotoProps) {
  const photo = dimensions[src as keyof typeof dimensions];
  const frame = className === undefined ? {} : { className };
  if (!photo) return <ProgressivePhoto alt={alt} {...frame} fit={fit}
    {...(height === undefined ? {} : { height })} {...(width === undefined ? {} : { width })}
    immediate={immediate} lazyPreview={lazyPreview} onVisualReady={onVisualReady} visualReadyAt={visualReadyAt} priority={priority} sizes={sizes} src={src} />;
  const basename = src.slice(src.startsWith('/brand/') ? '/brand/'.length : 1).replace(/\.(?:webp|png)$/u, '').replaceAll('/', '-');
  const widths = src.endsWith('-logo.png') ? [32, 64, 128] : src.startsWith('/demo/') ? [64, 128, 320, 640, 960, 1280] : [320, 640, 960, 1280];
  const sources = widths.filter((width) => width < photo.width).map((width) => ({
    url: `/brand/responsive/${basename}-${width}.webp`, width,
  }));
  sources.push({ url: src, width: photo.width });
  return <ProgressivePhoto alt={alt} {...frame} fit={fit} height={photo.height} immediate={immediate} lazyPreview={lazyPreview} onVisualReady={onVisualReady} visualReadyAt={visualReadyAt} priority={priority} sizes={sizes} sources={sources} width={photo.width} />;
}

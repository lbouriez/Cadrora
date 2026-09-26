import dimensions from '../../shared/brand-photo-dimensions.json';
import { ProgressivePhoto } from '../components';

interface BrandPhotoProps {
  alt: string;
  className?: string;
  immediate?: boolean;
  priority?: boolean;
  sizes: string;
  src: string;
}

/** Build-time brand photos use the same preview and responsive display path as gallery media. */
export function BrandPhoto({ alt, className, immediate = false, priority = false, sizes, src }: BrandPhotoProps) {
  const photo = dimensions[src as keyof typeof dimensions];
  if (!photo) return <img alt={alt} className={className} fetchPriority={priority ? 'high' : undefined} loading={immediate ? 'eager' : 'lazy'} src={src} />;
  const basename = src.slice('/brand/'.length, -'.webp'.length);
  const sources = [320, 640, 960, 1280].filter((width) => width < photo.width).map((width) => ({
    url: `/brand/responsive/${basename}-${width}.webp`, width,
  }));
  sources.push({ url: src, width: photo.width });
  return <ProgressivePhoto alt={alt} {...(className ? { className } : {})} height={photo.height} immediate={immediate} priority={priority} sizes={sizes} sources={sources} width={photo.width} />;
}

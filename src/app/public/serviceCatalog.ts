import type { ServiceKey } from '../../shared/schemas/site';

/** Local demo visuals; operators can replace these repository assets for their own studio. */
export const serviceVisuals = [
  { key: 'wedding', src: '/brand/demo-hero.webp' },
  { key: 'family', src: '/brand/demo-services-triptych.png' },
  { key: 'brand', src: '/brand/service-brand.webp' },
  { key: 'corporate', src: '/brand/service-corporate.webp' },
  { key: 'children', src: '/brand/service-children.webp' },
] as const satisfies readonly { key: ServiceKey; src: string }[];

import type { ComponentType } from 'react';

import type { ServiceKey } from '../../shared/schemas/site';

export type MarketingPage = 'home' | 'services' | 'galleries' | 'contact' | 'privacy';
export type NavigationItem = 'home' | 'portfolio' | 'services' | 'galleries' | 'about' | 'contact';
export type HomeSection = 'demo' | 'stack' | 'services' | 'approach' | 'galleries' | 'featuredSites' | 'contact';

export interface FeaturedSite {
  name: string;
  href: string;
  descriptionKey: string;
  logoUrl?: string;
}

export interface SiteAction {
  href: string;
  labelKey: string;
  shortLabelKey: string;
}

/** A site changes content and composition first; replacing a page is an explicit escape hatch. */
export interface SiteDefinition {
  id: string;
  name: string;
  description: Readonly<Record<'fr' | 'en', string>>;
  logoUrl: string | null;
  heroImageUrl: string;
  heroAccentImageUrl: string | null;
  mapPreviewUrl: string;
  privateGalleryCoverUrl: string;
  serviceImages: Readonly<Record<ServiceKey, string>>;
  navigation?: readonly NavigationItem[];
  home: {
    presentation?: 'standard' | 'session-slides';
    primaryAction: SiteAction;
    secondaryAction: SiteAction;
    sections: readonly HomeSection[];
    showProof: boolean;
    featuredSites?: readonly FeaturedSite[];
  };
  demo: {
    adminPassword: string;
    adminUsername: string;
    privateGalleryPassword: string;
    privateGallerySlug: string;
    publicGallerySlug: string;
  } | null;
  /** FR and EN overrides of the shared visitor resources; keys must match in both languages. */
  copy: { en: Record<string, unknown>; fr: Record<string, unknown> };
  /** Marketing-page overrides retain the shared shell, security, and gallery/admin routes. */
  pages?: Partial<Record<MarketingPage, ComponentType>>;
}

export interface PublicGalleryConfiguration {
  getTurnstileToken: () => Promise<string>;
}

let configuration: PublicGalleryConfiguration = {
  // PA replaces this fail-closed provider when wiring the Turnstile widget.
  getTurnstileToken: () => Promise.resolve(''),
};

export function configurePublicGallery(next: PublicGalleryConfiguration): void {
  configuration = next;
}

export function getPublicGalleryConfiguration(): PublicGalleryConfiguration {
  return configuration;
}

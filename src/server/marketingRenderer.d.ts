declare module 'virtual:cadrora-marketing-renderer' {
  // A top-level import would make this an augmentation instead of declaring the virtual module.
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  export function renderMarketing(snapshot: import('../shared/schemas/marketingSnapshot').MarketingSnapshot): Promise<string>;
}

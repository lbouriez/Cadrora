import { describe, expect, it } from 'vitest';

import { atelierGiuliaSite } from '../../../sites/atelier-giulia/site';
import { cadroraSite } from '../../../sites/cadrora/site';

function leafKeys(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return entry !== null && typeof entry === 'object' && !Array.isArray(entry)
      ? leafKeys(entry as Record<string, unknown>, path)
      : [path];
  }).sort();
}

describe('site profiles', () => {
  it('keeps Atelier Giulia on shared page sections without publishing showcase access', () => {
    expect(atelierGiuliaSite.demo).toBeNull();
    expect(atelierGiuliaSite.home.sections).not.toContain('demo');
    expect(atelierGiuliaSite.home.sections).not.toContain('stack');
    expect(atelierGiuliaSite.home.primaryAction.href).toBe('/contact');
    expect(cadroraSite.home.sections).toContain('demo');
    expect(cadroraSite.demo?.privateGallerySlug).toBe('instants-en-famille');
  });

  it('provides the same visitor-copy keys in French and English', () => {
    expect(leafKeys(atelierGiuliaSite.copy.fr)).toEqual(leafKeys(atelierGiuliaSite.copy.en));
  });
});

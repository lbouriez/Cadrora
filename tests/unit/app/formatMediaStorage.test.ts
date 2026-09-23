import { describe, expect, it } from 'vitest';

import { formatMediaStorage } from '../../../src/app/admin/formatMediaStorage';

describe('admin media storage display', () => {
  it('shows actual nonzero media usage without rounding it to zero GB', () => {
    expect(formatMediaStorage(3_827_888, 'en')).toEqual({ amount: '3.8', unit: 'megabytes' });
    expect(formatMediaStorage(3_827_888, 'fr')).toEqual({ amount: '3,8', unit: 'megabytes' });
  });

  it('keeps decimal units across the size range', () => {
    expect(formatMediaStorage(0, 'en')).toEqual({ amount: '0', unit: 'bytes' });
    expect(formatMediaStorage(12_345, 'en')).toEqual({ amount: '12.3', unit: 'kilobytes' });
    expect(formatMediaStorage(750_000_000, 'en')).toEqual({ amount: '750', unit: 'megabytes' });
    expect(formatMediaStorage(1_250_000_000, 'en')).toEqual({ amount: '1.3', unit: 'gigabytes' });
  });
});

import { describe, expect, it, vi } from 'vitest';

import { buildPortfolioSeed, seedPortfolioDemo } from '../../../scripts/demo/portfolioSeed.mjs';

describe('Cadrora portfolio seed', () => {
  it('has two photos per collection with four tracked variants and matching metadata records', async () => {
    const generated = await buildPortfolioSeed();
    expect(generated.uploads).toHaveLength(40);
    expect(new Set(generated.uploads.map(({ key }) => key)).size).toBe(40);
    expect(generated.sql.match(/INSERT INTO portfolio_collections/gmu)).toHaveLength(5);
    expect(generated.sql.match(/INSERT INTO portfolio_photos/gmu)).toHaveLength(10);
    expect(generated.sql.match(/INSERT INTO portfolio_variants/gmu)).toHaveLength(40);
    for (const { key } of generated.uploads) expect(generated.sql).toContain(key);
  });

  it('uploads every tracked variant before applying its D1 publication records', async () => {
    const order = [];
    const upload = vi.fn(async (args) => { order.push('upload'); expect(args).toContain('--remote'); });
    const execute = vi.fn(() => { order.push('database'); });
    await seedPortfolioDemo({ bucketName: 'demo-media', configPath: 'wrangler.jsonc', environment: {},
      target: { migrationArgs: [] }, upload, execute });
    expect(upload).toHaveBeenCalledTimes(40);
    expect(execute).toHaveBeenCalledWith(expect.arrayContaining(['d1', 'execute', 'DB', '--remote']), {});
    expect(order.at(-1)).toBe('database');
  });
});

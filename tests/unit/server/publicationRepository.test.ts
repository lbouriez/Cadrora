import { describe, expect, it, vi } from 'vitest';

import { D1PublicationRepository } from '../../../src/server/repositories/publicationRepository';

describe('publication repository deletion fence', () => {
  it('does not queue deletion when a live face-indexing lease wins the conditional update', async () => {
    const statements: string[] = [];
    const database = {
      batch: vi.fn().mockResolvedValue([
        { meta: { changes: 0 } },
        { meta: { changes: 0 } },
      ]),
      prepare: vi.fn((sql: string) => {
        statements.push(sql);
        const statement = {
          bind: vi.fn(() => statement),
          first: vi.fn().mockResolvedValue({ event_id: 'event-1', id: 'photo-1' }),
        };
        return statement;
      }),
    } as unknown as D1Database;

    await expect(new D1PublicationRepository(database).deletePhoto(
      'photo-1',
      '2030-01-01T00:00:00.000Z',
    )).resolves.toBe(false);
    expect(statements.some((sql) => sql.includes("face_state <> 'indexing' OR updated_at <= ?3"))).toBe(true);
    expect(statements.some((sql) => sql.includes("state = 'deleting' AND updated_at = ?4"))).toBe(true);
  });
});

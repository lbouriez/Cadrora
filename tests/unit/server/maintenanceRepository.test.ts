import { describe, expect, it, vi } from 'vitest';

import {
  D1MaintenanceRepository,
  MAINTENANCE_LEASE_MS,
} from '../../../src/server/repositories/maintenanceRepository';

describe('maintenance repository leases', () => {
  it('reclaims a running job only after its bounded lease is stale', async () => {
    const select = {
      bind: vi.fn(),
      first: vi.fn().mockResolvedValue({
        attempts: 2,
        id: 'job-1',
        kind: 'delete_photo_media',
        payload_json: '{"eventId":"event-1","photoId":"photo-1"}',
      }),
    };
    select.bind.mockReturnValue(select);
    const update = {
      bind: vi.fn(),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    };
    update.bind.mockReturnValue(update);
    const database = {
      prepare: vi.fn()
        .mockReturnValueOnce(select)
        .mockReturnValueOnce(update),
    } as unknown as D1Database;
    const repository = new D1MaintenanceRepository(database);
    const now = '2030-01-01T12:00:00.000Z';
    const staleBefore = new Date(Date.parse(now) - MAINTENANCE_LEASE_MS).toISOString();

    await expect(repository.claimNext(now)).resolves.toEqual({
      attempts: 3,
      id: 'job-1',
      kind: 'delete_photo_media',
      payload: { eventId: 'event-1', photoId: 'photo-1' },
    });
    expect(select.bind).toHaveBeenCalledWith(now, staleBefore);
    expect(update.bind).toHaveBeenCalledWith('job-1', now, staleBefore);
  });
});

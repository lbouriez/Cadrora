import { describe, expect, it } from 'vitest';
import { maintenanceResources } from '../../../src/app/admin/maintenance/resources';
import { mediaResources } from '../../../src/app/admin/maintenance/mediaResources';
import { MaintenanceKindSchema } from '../../../src/shared/schemas/maintenance';

function keys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, item]: [string, unknown]) => item !== null && typeof item === 'object'
    ? keys(item, `${prefix}${key}.`) : [`${prefix}${key}`]).sort();
}
describe('maintenance translations', () => {
  it('keeps every visible label and background operation available in French and English', () => {
    expect(keys(maintenanceResources.fr)).toEqual(keys(maintenanceResources.en));
    expect(keys(mediaResources.fr)).toEqual(keys(mediaResources.en));
    expect(Object.keys(maintenanceResources.en.admin.maintenance.operations).sort()).toEqual([...MaintenanceKindSchema.options].sort());
  });
});

import { describe, expect, it } from 'vitest';
import {
  getResourceCategory,
  getResourceTypeLabel,
  getVisibleUnitFields,
  parseOptionalInteger,
  parseOptionalNumber,
} from './resource-helpers';

describe('resource helpers', () => {
  it('keeps tanker as a vehicle with vehicle fields', () => {
    const fields = getVisibleUnitFields('tanker');

    expect(getResourceTypeLabel('tanker')).toBe('Camion cisterna');
    expect(getResourceCategory('tanker')).toBe('vehicle');
    expect(fields.licensePlate).toBe(true);
    expect(fields.capacityLiters).toBe(true);
  });

  it('hides vehicle-only fields for machinery', () => {
    const fields = getVisibleUnitFields('machinery');

    expect(getResourceCategory('machinery')).toBe('machinery');
    expect(fields.licensePlate).toBe(false);
    expect(fields.capacityLiters).toBe(false);
    expect(fields.crewCapacity).toBe(false);
    expect(fields.serialNumber).toBe(true);
    expect(fields.engineHours).toBe(true);
  });

  it('treats water tanks as non-vehicle assets', () => {
    expect(getResourceCategory('water_tank')).toBe('water_asset');
    expect(getResourceTypeLabel('water_tank')).toBe('Cisterna / tanque');
  });

  it('does not coerce blank optional numbers to zero', () => {
    expect(parseOptionalNumber('')).toBeUndefined();
    expect(parseOptionalNumber('  ')).toBeUndefined();
    expect(parseOptionalInteger('')).toBeUndefined();
    expect(parseOptionalInteger('  ')).toBeUndefined();
    expect(parseOptionalNumber('-28,46')).toBe(-28.46);
    expect(parseOptionalInteger('0')).toBe(0);
  });
});

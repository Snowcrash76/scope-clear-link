import { describe, expect, test } from 'bun:test';
import { formatAUD } from '../src/components/ui/money';
import { formatFullDate, formatShortDate } from '../src/lib/dateFormat';

describe('shared UI formatting', () => {
  test('AUD formatting keeps cents, grouping and negative values', () => {
    expect(formatAUD(29810)).toBe('$29,810.00');
    expect(formatAUD(758.97)).toBe('$758.97');
    expect(formatAUD(0)).toBe('$0.00');
    expect(formatAUD(-1490.5)).toBe('-$1,490.50');
  });

  test('missing or non-finite amounts are unavailable, never fabricated zeroes', () => {
    for (const value of [null, undefined, NaN, Infinity, -Infinity]) {
      expect(formatAUD(value)).toBe('—');
    }
  });

  test('date-only inputs remain calendar dates with consistent labels', () => {
    expect(formatShortDate('2024-10-14')).toBe('Mon 14 Oct');
    expect(formatFullDate('2026-11-27')).toBe('27 Nov 2026');
    expect(formatFullDate('not a date')).toBe('—');
    expect(formatShortDate(new Date(NaN))).toBe('—');
  });
});

import { describe, expect, it } from 'vitest';

import { daysUntil, formatExpiryDate, formatRemainingDays, remainingDays } from './expiry';

/**
 * The number people act on.
 *
 * "31 days remaining" is what tells someone to renew a certificate, and it was
 * wrong in production in the quietest possible way: the API stores the count as
 * it stood when the check ran, the dashboard printed that, and while the
 * monitoring worker was down the same number was shown for eighteen hours.
 * Nothing looked broken — the figure was simply older than it appeared.
 */

const NOW = new Date('2026-09-07T12:00:00Z');

describe('daysUntil', () => {
  it('counts from now, not from when anything was recorded', () => {
    expect(daysUntil('2026-09-17T12:00:00Z', NOW)).toBe(10);
  });

  it('floors, so part of a day never reads as a whole one', () => {
    // 23 hours left has to be 0 days, not 1: rounding up would let a
    // certificate expiring this evening report a day in hand.
    expect(daysUntil('2026-09-08T11:00:00Z', NOW)).toBe(0);
  });

  it('goes negative once the date has passed', () => {
    expect(daysUntil('2026-09-01T12:00:00Z', NOW)).toBe(-6);
  });

  it('returns null for something that is not a date', () => {
    expect(daysUntil('not a date', NOW)).toBeNull();
  });
});

describe('remainingDays', () => {
  it('prefers the expiry date over the stored count', () => {
    // The exact production drift: recorded as 68 yesterday, actually 67 today.
    const result = remainingDays('2026-11-13T19:23:07Z', 68, NOW);

    expect(result).toEqual({ days: 67, live: true });
  });

  it('falls back to the stored count when there is no date', () => {
    expect(remainingDays(null, 12, NOW)).toEqual({ days: 12, live: false });
  });

  it('reports nothing rather than zero when neither is available', () => {
    // Zero would read as "expires today", which is a fabricated fact about a
    // domain nobody managed to look up.
    expect(remainingDays(null, null, NOW)).toBeNull();
  });

  it('falls back when the date is unparseable rather than discarding both', () => {
    expect(remainingDays('nonsense', 5, NOW)).toEqual({ days: 5, live: false });
  });
});

describe('formatRemainingDays', () => {
  it('names the unknown case explicitly', () => {
    expect(formatRemainingDays(null)).toBe('Unknown');
  });

  it('says how long ago something lapsed', () => {
    expect(formatRemainingDays({ days: -3, live: true })).toBe('Expired 3 days ago');
    expect(formatRemainingDays({ days: -1, live: true })).toBe('Expired 1 day ago');
  });

  it('agrees with itself about singulars', () => {
    expect(formatRemainingDays({ days: 1, live: true })).toBe('1 day');
    expect(formatRemainingDays({ days: 0, live: true })).toBe('0 days');
  });
});

describe('formatExpiryDate', () => {
  it('says Unavailable rather than leaving a date-shaped blank', () => {
    expect(formatExpiryDate(null)).toBe('Unavailable');
    expect(formatExpiryDate('nonsense')).toBe('Unavailable');
  });

  it('renders a real date', () => {
    expect(formatExpiryDate('2026-11-13T19:23:07Z')).toMatch(/2026/);
  });
});

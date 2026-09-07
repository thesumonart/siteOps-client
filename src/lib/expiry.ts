/**
 * How long is left, counted from now rather than from when the check ran.
 *
 * A certificate and a domain registration both expire on a fixed date, and the
 * monitor that reads that date runs at most once a day. The API stores the day
 * count as it stood at check time, which is correct for the historical record
 * and wrong for a dashboard: a certificate checked yesterday and recorded as
 * "68 days remaining" still said 68 today, and would have gone on saying it
 * for as long as the check did not run — which, while the worker was dead, was
 * eighteen hours and counting.
 *
 * So the number on screen is derived from the expiry date, which does not
 * drift, and the stored count is only a fallback for a record that has a count
 * but no date.
 */

/** Milliseconds in a day. Certificate and registration windows are day-grained. */
const DAY_MS = 86_400_000;

export interface RemainingDays {
  readonly days: number;
  /** True when the count came from the date rather than from the stored value. */
  readonly live: boolean;
}

/**
 * Days until `iso`, floored.
 *
 * Floored, never rounded: "expires in 23 hours" has to read as 0 days left, not
 * 1. Rounding up would let a certificate that expires this afternoon report a
 * day in hand, which is the one direction this must never err in.
 */
export function daysUntil(iso: string, now: Date = new Date()): number | null {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  return Math.floor((target.getTime() - now.getTime()) / DAY_MS);
}

/**
 * The count to show, preferring the date over the stored snapshot.
 *
 * Returns null when neither is available, which the caller renders as
 * "Unknown" — never as zero, and never as a guess.
 */
export function remainingDays(
  expiresAtIso: string | null,
  storedDays: number | null,
  now: Date = new Date(),
): RemainingDays | null {
  if (expiresAtIso !== null) {
    const days = daysUntil(expiresAtIso, now);
    if (days !== null) return { days, live: true };
  }
  return storedDays === null ? null : { days: storedDays, live: false };
}

/** `null` → "Unknown", a past date → how long ago it lapsed. */
export function formatRemainingDays(remaining: RemainingDays | null): string {
  if (remaining === null) return 'Unknown';
  if (remaining.days < 0) {
    const ago = Math.abs(remaining.days);
    return `Expired ${String(ago)} ${ago === 1 ? 'day' : 'days'} ago`;
  }
  return `${String(remaining.days)} ${remaining.days === 1 ? 'day' : 'days'}`;
}

/**
 * A date for reading, or an explicit "Unavailable".
 *
 * The wording matters: a missing expiry date is a fact about the lookup, not a
 * fact about the domain, and it must never be rendered as a blank cell that
 * reads like a date nobody noticed.
 */
export function formatExpiryDate(iso: string | null): string {
  if (iso === null) return 'Unavailable';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

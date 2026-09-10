'use client';

import { formatDistanceStrict } from 'date-fns';

import { useNow } from '@/hooks/use-now';

/**
 * Seconds are deliberate. Checks of one website land seconds apart when a
 * monitor retries around a failure, and a column of identical "14:03" rows
 * cannot be put in order by eye — which is the whole reason to read the raw
 * check list rather than the summary above it.
 */
const ABSOLUTE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
};

export interface AbsoluteTimeProps {
  /** UTC ISO 8601 timestamp, as every API date is. */
  readonly iso: string;
  readonly className?: string;
}

/**
 * A timestamp rendered as the exact date and time it happened, in the reader's
 * own timezone — "9 Sep 2026, 14:03:22".
 *
 * The counterpart to `RelativeTime`, and the right choice wherever a reader is
 * correlating rows with something outside the dashboard: a deploy, a log line,
 * a customer complaint that names a time. "3 days ago" cannot be matched
 * against any of those without arithmetic, and it goes silently stale on a tab
 * left open. The relative phrasing survives in the tooltip, where it still
 * answers "is this recent?" at a glance.
 *
 * The reader's timezone and locale are not the server's, so both formats are
 * derived from `useNow`, which is null until mount. Until then the same instant
 * is shown in UTC — unambiguous, and identical on both sides of hydration.
 */
export function AbsoluteTime({ iso, className }: AbsoluteTimeProps): React.ReactElement {
  const now = useNow();
  const date = new Date(iso);
  const valid = !Number.isNaN(date.getTime());

  const absolute = !valid
    ? 'Unknown'
    : now === null
      ? formatUtc(date)
      : date.toLocaleString(undefined, ABSOLUTE_FORMAT);

  // Recomputed on every tick of the clock, so a tooltip read an hour after the
  // page loaded is not an hour out.
  const relative =
    valid && now !== null ? `${formatDistanceStrict(date, new Date(now))} ago` : undefined;

  return (
    <time dateTime={iso} title={relative} className={className}>
      {absolute}
    </time>
  );
}

/**
 * The same instant in UTC, spelled out rather than guessed at.
 *
 * Labelled "UTC" on purpose: an unlabelled timestamp in a timezone that is not
 * the reader's is worse than no timestamp, because it looks correct.
 */
function formatUtc(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

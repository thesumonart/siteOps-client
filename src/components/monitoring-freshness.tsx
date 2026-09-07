'use client';

import type * as React from 'react';

import { RelativeTime } from '@/components/relative-time';
import { Alert } from '@/components/ui/alert';
import { useNow } from '@/hooks/use-now';

/**
 * Says so when the monitoring figures on screen have stopped moving.
 *
 * This exists because of the failure that is hardest to notice: the monitoring
 * worker stopped, and nothing anywhere said so. The API stayed healthy, every
 * probe stayed green, and the dashboard went on reporting "100% uptime, 2
 * operational" from checks that had stopped eighteen hours earlier. Each number
 * was accurate about the past and presented as the present, which is worse than
 * an error — an error is visible.
 *
 * It is not an infrastructure status panel and deliberately names nothing about
 * one: no host, no process, no queue depth. It compares two facts the tenant
 * already owns — when their sites were last checked, and how often they asked
 * for them to be — and reports the gap. Operators get the real diagnostics
 * behind `/api/internal/monitoring/health`.
 */

/**
 * How many intervals may pass before a gap is worth surfacing.
 *
 * A check is claimed within one poll of becoming due, so a site on a five
 * minute interval is normally checked every five minutes and a little. Three
 * intervals absorbs a slow sweep, a restart and a deploy without crying wolf;
 * anything beyond it means checks are genuinely not happening.
 */
const STALE_AFTER_INTERVALS = 3;

/**
 * The floor on that threshold.
 *
 * Without it a one-minute interval would raise a banner after three minutes,
 * and a single slow sweep during a deploy would look like an outage. Ten
 * minutes is longer than any legitimate gap and far shorter than a gap anyone
 * would otherwise notice on their own.
 */
const MINIMUM_STALE_MS = 10 * 60 * 1000;

export interface MonitoringFreshnessProps {
  readonly lastCheckAt: string | null;
  readonly shortestIntervalSeconds: number | null;
  /** Suppresses the notice when nothing is being monitored yet. */
  readonly monitoredWebsites: number;
}

export function MonitoringFreshness({
  lastCheckAt,
  shortestIntervalSeconds,
  monitoredWebsites,
}: MonitoringFreshnessProps): React.ReactElement | null {
  /*
   * Subscribed to rather than read during render. The server and the browser
   * disagree about the current time, so a banner decided by `Date.now()` at
   * render time renders on one and not the other — a hydration mismatch — and
   * makes this component impure into the bargain. It also re-evaluates on its
   * own, so a tab left open crosses the threshold rather than sitting on a
   * verdict from when it was loaded.
   */
  const now = useNow();

  if (monitoredWebsites === 0) return null;

  /*
   * Websites exist and none has ever been checked. On a working deployment this
   * lasts one poll interval, so seeing it at all means the queue is not being
   * drained — which is exactly the state a new install lands in when the
   * monitoring runtime was never started.
   */
  if (lastCheckAt === null) {
    return (
      <Alert variant="error" title="No checks have run yet">
        These websites are queued for monitoring but nothing has checked them. If this persists, the
        monitoring worker is not running.
      </Alert>
    );
  }

  // No clock on the server, and none for the first client frame. Nothing is
  // claimed either way until there is one.
  if (now === null) return null;

  const intervalMs = (shortestIntervalSeconds ?? 300) * 1000;
  const threshold = Math.max(intervalMs * STALE_AFTER_INTERVALS, MINIMUM_STALE_MS);
  const ageMs = now - new Date(lastCheckAt).getTime();

  if (Number.isNaN(ageMs) || ageMs <= threshold) return null;

  return (
    <Alert variant="error" title="Monitoring has stopped">
      The last check ran <RelativeTime iso={lastCheckAt} />, well past the configured interval. The
      uptime, response time and status figures below are from that check and are not current.
    </Alert>
  );
}

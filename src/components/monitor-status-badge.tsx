import { MONITOR_STATUS_LABELS, type MonitorStatus } from '@/contracts';
import { CircleAlert, CircleCheck, CircleHelp, CircleMinus, TriangleAlert } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The outcome of a monitor, as a badge.
 *
 * Colour is never the only signal: each status carries its own glyph and its
 * own text, so the badge is still readable in monochrome, to a screen reader,
 * and to the roughly one in twelve men who cannot reliably separate the red
 * from the green.
 *
 * `error` is visually distinct from `failing` on purpose. "We could not check"
 * and "we checked and it is broken" are different facts, and collapsing them
 * teaches people to distrust the red ones.
 */
const PRESENTATION: Record<
  MonitorStatus,
  { readonly icon: React.ComponentType<{ className?: string }>; readonly className: string }
> = {
  passing: {
    icon: CircleCheck,
    className: 'bg-status-operational-subtle text-status-operational',
  },
  warning: { icon: TriangleAlert, className: 'bg-status-degraded-subtle text-status-degraded' },
  failing: { icon: CircleAlert, className: 'bg-status-down-subtle text-status-down' },
  error: { icon: CircleMinus, className: 'bg-muted text-muted-foreground' },
  unknown: { icon: CircleHelp, className: 'bg-muted text-muted-foreground' },
};

export interface MonitorStatusBadgeProps {
  readonly status: MonitorStatus;
  readonly className?: string;
}

export function MonitorStatusBadge({
  status,
  className,
}: MonitorStatusBadgeProps): React.ReactElement {
  const { icon: Icon, className: tone } = PRESENTATION[status];

  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tone,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {MONITOR_STATUS_LABELS[status]}
    </span>
  );
}

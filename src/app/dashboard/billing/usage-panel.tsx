'use client';

import type { EntitlementsDto, PlanLimits, PlanUsageDto } from '@/contracts';
import type * as React from 'react';

import { formatInterval } from '@/components/billing/plan-formatting';
import { cn } from '@/lib/utils';

/**
 * One countable limit, the usage against it, and where that number comes from.
 *
 * `usageKey` is the deciding field. A limit whose usage is not actually
 * measured has no row here at all — showing "0 / 5 API keys" for a feature that
 * does not exist would be a fabricated number on a billing screen, which is
 * exactly the kind of invention this product does not do. Add a row when the
 * counter behind it starts returning a real count.
 */
interface CountedLimit {
  readonly limitKey: keyof PlanLimits;
  readonly usageKey: keyof PlanUsageDto;
  readonly label: string;
  readonly singular: string;
}

const COUNTED: readonly CountedLimit[] = [
  { limitKey: 'maxWebsites', usageKey: 'websites', label: 'Websites', singular: 'website' },
  { limitKey: 'maxMembers', usageKey: 'members', label: 'Team members', singular: 'member' },
  { limitKey: 'maxClients', usageKey: 'clients', label: 'Clients', singular: 'client' },
  {
    limitKey: 'maxReportSchedules',
    usageKey: 'reportSchedules',
    label: 'Scheduled reports',
    singular: 'schedule',
  },
];

/** Limits that are a setting rather than a tally, so there is nothing to fill up. */
const ALLOWANCES: readonly {
  readonly key: keyof PlanLimits;
  readonly label: string;
  readonly render: (limits: PlanLimits) => string;
}[] = [
  {
    key: 'minMonitoringIntervalSeconds',
    label: 'Fastest uptime check',
    render: (limits) => formatInterval(limits.minMonitoringIntervalSeconds),
  },
  {
    key: 'minMonitorIntervalSeconds',
    label: 'Fastest SSL, SEO and crawl check',
    render: (limits) => formatInterval(limits.minMonitorIntervalSeconds),
  },
  {
    key: 'checkRetentionDays',
    label: 'Check history retained',
    render: (limits) => `${String(limits.checkRetentionDays)} days`,
  },
  {
    key: 'maxCrawlPages',
    label: 'Pages per broken-link crawl',
    render: (limits) =>
      limits.maxCrawlPages > 0 ? limits.maxCrawlPages.toLocaleString('en-US') : 'Not included',
  },
];

export interface UsagePanelProps {
  readonly entitlements: EntitlementsDto;
}

/**
 * What the organization is using against what its plan allows.
 *
 * Every number comes from `GET /api/organizations/:id/entitlements`, counted
 * server-side at the moment of the request. Nothing here is estimated, cached
 * from a previous screen, or derived from a list the browser happens to hold.
 */
export function UsagePanel({ entitlements }: UsagePanelProps): React.ReactElement {
  const { limits, usage } = entitlements;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium">Usage</h3>
        <ul className="mt-3 space-y-4">
          {COUNTED.map((row) => (
            <UsageRow
              key={row.limitKey}
              label={row.label}
              singular={row.singular}
              used={usage[row.usageKey]}
              allowed={limits[row.limitKey]}
            />
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-medium">Allowances</h3>
        <dl className="mt-3 divide-y rounded-lg border">
          {ALLOWANCES.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="text-sm font-medium tabular-nums">{row.render(limits)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

interface UsageRowProps {
  readonly label: string;
  readonly singular: string;
  readonly used: number;
  readonly allowed: number;
}

function UsageRow({ label, singular, used, allowed }: UsageRowProps): React.ReactElement {
  const included = allowed > 0;
  // Clamped, because a limit lowered by a downgrade can leave usage above it
  // and a bar wider than its track reads as a rendering bug rather than as the
  // over-limit state it is.
  const percentage = included ? Math.min(100, Math.round((used / allowed) * 100)) : 0;
  const atLimit = included && used >= allowed;

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{label}</span>
        <span
          className={cn(
            'text-sm tabular-nums',
            atLimit ? 'font-medium text-status-down' : 'text-muted-foreground',
          )}
        >
          {included ? `${String(used)} of ${String(allowed)}` : 'Not included'}
        </span>
      </div>

      {included && (
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={allowed}
          aria-label={`${label}: ${String(used)} of ${String(allowed)} ${allowed === 1 ? singular : `${singular}s`} used`}
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width]',
              atLimit ? 'bg-status-down' : 'bg-primary',
            )}
            style={{ width: `${String(percentage)}%` }}
          />
        </div>
      )}
    </li>
  );
}

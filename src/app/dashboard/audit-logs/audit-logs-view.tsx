'use client';

import {
  AUDIT_ACTION_LABELS,
  AUDIT_AREAS,
  AUDIT_AREA_LABELS,
  PLAN_LABELS,
  cheapestPlanWith,
  type AuditArea,
  type AuditLogDto,
} from '@/contracts';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState, ErrorState, FeatureLockedState, SkeletonRows } from '@/components/data-states';
import { RelativeTime } from '@/components/relative-time';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEntitlements } from '@/hooks/use-entitlements';
import { fetchAuditActors, fetchAuditLogs } from '@/lib/audit-logs';
import { queryKeys } from '@/lib/query-keys';

const PAGE_SIZE = 25;

interface Filters {
  readonly area: AuditArea | '';
  readonly actorUserId: string;
  readonly search: string;
  readonly from: string;
  readonly to: string;
}

const EMPTY_FILTERS: Filters = { area: '', actorUserId: '', search: '', from: '', to: '' };

export interface AuditLogsViewProps {
  readonly organizationId: string;
}

/**
 * The organization activity feed.
 *
 * Filters live in component state rather than the URL. The feed is a thing
 * people scan rather than link to, and keeping the query out of the address bar
 * avoids putting a searched name into browser history on a shared machine.
 *
 * Paged by cursor, like every other append-only feed here: entries arrive while
 * someone is reading, and an offset would shift every row down as they do.
 */
export function AuditLogsView({ organizationId }: AuditLogsViewProps): React.ReactElement {
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  // Applied separately from the draft so typing in the search box does not fire
  // a request per keystroke; the form's submit is the commit point.
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  const entitlements = useEntitlements(organizationId);
  const allowed = entitlements.data?.features.includes('audit_logs') ?? false;

  const queryFilters = useMemo(
    () => ({
      ...(applied.area ? { area: applied.area } : {}),
      ...(applied.actorUserId ? { actorUserId: applied.actorUserId } : {}),
      ...(applied.search ? { search: applied.search } : {}),
      // A date input yields a bare calendar day; the API takes an instant, so
      // the bounds are widened to cover the whole day in the viewer's zone.
      ...(applied.from ? { from: new Date(`${applied.from}T00:00:00`).toISOString() } : {}),
      ...(applied.to ? { to: new Date(`${applied.to}T23:59:59.999`).toISOString() } : {}),
    }),
    [applied],
  );

  const logs = useInfiniteQuery({
    queryKey: queryKeys.auditLogs(organizationId, queryFilters),
    queryFn: ({ pageParam }) =>
      fetchAuditLogs({
        pageSize: PAGE_SIZE,
        ...queryFilters,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor ?? undefined,
    enabled: allowed,
  });

  const actors = useQuery({
    queryKey: queryKeys.auditActors(organizationId),
    queryFn: () => fetchAuditActors(),
    staleTime: 5 * 60_000,
    enabled: allowed,
  });

  if (entitlements.isPending) {
    return <SkeletonRows label="Loading activity…" rows={6} />;
  }

  if (!allowed) {
    const required = cheapestPlanWith('audit_logs');
    return (
      <FeatureLockedState
        feature="Audit logs"
        requiredPlan={required ? PLAN_LABELS[required] : 'a paid plan'}
      />
    );
  }

  const entries = logs.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = applied !== EMPTY_FILTERS;

  return (
    <div className="grid gap-4">
      <form
        className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(draft);
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="audit-area">Area</Label>
          <select
            id="audit-area"
            value={draft.area}
            onChange={(event) => {
              setDraft((current) => ({ ...current, area: event.target.value as AuditArea | '' }));
            }}
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">All areas</option>
            {AUDIT_AREAS.map((area) => (
              <option key={area} value={area}>
                {AUDIT_AREA_LABELS[area]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="audit-actor">Person</Label>
          <select
            id="audit-actor"
            value={draft.actorUserId}
            onChange={(event) => {
              setDraft((current) => ({ ...current, actorUserId: event.target.value }));
            }}
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">Anyone</option>
            {(actors.data ?? [])
              .filter((actor) => actor.id !== null)
              .map((actor) => (
                <option key={actor.id} value={actor.id ?? ''}>
                  {actor.name}
                </option>
              ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="audit-from">From</Label>
          <Input
            id="audit-from"
            type="date"
            value={draft.from}
            max={draft.to || undefined}
            onChange={(event) => {
              setDraft((current) => ({ ...current, from: event.target.value }));
            }}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="audit-to">To</Label>
          <Input
            id="audit-to"
            type="date"
            value={draft.to}
            min={draft.from || undefined}
            onChange={(event) => {
              setDraft((current) => ({ ...current, to: event.target.value }));
            }}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="audit-search">Search</Label>
          <Input
            id="audit-search"
            type="search"
            placeholder="Person or target"
            value={draft.search}
            onChange={(event) => {
              setDraft((current) => ({ ...current, search: event.target.value }));
            }}
          />
        </div>

        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit" size="sm">
            Apply filters
          </Button>
          {filtered ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(EMPTY_FILTERS);
                setApplied(EMPTY_FILTERS);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </form>

      {logs.isPending ? (
        <SkeletonRows label="Loading activity…" rows={6} />
      ) : logs.isError ? (
        <ErrorState
          title="Could not load the activity feed"
          onRetry={() => {
            void logs.refetch();
          }}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          title={filtered ? 'No activity matches those filters' : 'No activity recorded yet'}
          description={
            filtered
              ? 'Try widening the date range or clearing the filters.'
              : 'Changes to websites, members, integrations and billing are recorded here as they happen.'
          }
        />
      ) : (
        <>
          <ul className="divide-y rounded-xl border">
            {entries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </ul>

          {logs.hasNextPage ? (
            <div>
              <Button
                variant="outline"
                size="sm"
                disabled={logs.isFetchingNextPage}
                onClick={() => {
                  void logs.fetchNextPage();
                }}
              >
                {logs.isFetchingNextPage ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Loading…
                  </>
                ) : (
                  'Load older activity'
                )}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function AuditRow({ entry }: { readonly entry: AuditLogDto }): React.ReactElement {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3.5">
      <p className="min-w-0 text-sm">
        <span className="font-medium">{entry.actorName}</span>{' '}
        <span className="text-muted-foreground">{AUDIT_ACTION_LABELS[entry.action]}</span>
        {entry.targetLabel ? <span className="font-medium"> {entry.targetLabel}</span> : null}
      </p>
      <p className="text-xs whitespace-nowrap text-muted-foreground">
        <RelativeTime iso={entry.createdAt} />
      </p>
    </li>
  );
}

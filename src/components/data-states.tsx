'use client';

import { Loader2 } from 'lucide-react';
import type * as React from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The four states every data view in SiteOps has to render.
 *
 * They existed already, written out by hand on the incidents screen. Extracting
 * them is not deduplication for its own sake: as more screens arrived, each new
 * one re-decided whether a spinner announces itself, whether an empty list
 * explains *why* it is empty, and whether a failure offers a retry. Those are
 * accessibility and product decisions, and they should be made once.
 *
 * Nothing here is a skeleton of the eventual layout. A skeleton is worth it
 * where the shape is known and stable (a table with a fixed column set), and
 * {@link SkeletonRows} covers that case; elsewhere an announced spinner is
 * honest about the fact that we do not yet know how much there will be.
 */

export interface LoadingStateProps {
  /** Announced to a screen reader, so it must describe what is loading. */
  readonly label: string;
  readonly className?: string;
}

export function LoadingState({ label, className }: LoadingStateProps): React.ReactElement {
  return (
    <div
      className={cn('flex items-center gap-2 py-8', className)}
      aria-busy="true"
      aria-live="polite"
    >
      <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export interface SkeletonRowsProps {
  readonly rows?: number;
  readonly label: string;
  readonly className?: string;
}

/**
 * Placeholder rows for a list whose shape is already known.
 *
 * Hidden from the accessibility tree entirely — a screen reader gains nothing
 * from six empty rows — with the announcement carried by the live region
 * instead.
 */
export function SkeletonRows({
  rows = 5,
  label,
  className,
}: SkeletonRowsProps): React.ReactElement {
  return (
    <div className={cn('rounded-xl border', className)} aria-busy="true">
      <span className="sr-only" aria-live="polite">
        {label}
      </span>
      <div className="divide-y" aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 px-5 py-4">
            <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export interface ErrorStateProps {
  readonly title: string;
  readonly description?: string;
  readonly onRetry?: () => void;
  readonly className?: string;
}

/**
 * A failed read.
 *
 * Always offers a retry when the caller can supply one: most failures here are
 * a dropped connection or an expired session, and both are fixed by trying
 * again. The description says what could not be loaded, never what the server
 * said — an error message from the API is written for the person who caused it,
 * not for a reader of a list.
 */
export function ErrorState({
  title,
  description,
  onRetry,
  className,
}: ErrorStateProps): React.ReactElement {
  return (
    <Alert variant="error" title={title} className={className}>
      {description ?? 'Something went wrong reading this data.'}
      {onRetry ? (
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </Alert>
  );
}

export interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  readonly action?: React.ReactNode;
  readonly className?: string;
}

/**
 * Nothing to show.
 *
 * The description is required rather than optional because an empty list with
 * no explanation is indistinguishable from a broken one — and in a monitoring
 * product, "no incidents" and "we are not checking" look identical on screen
 * while meaning opposite things.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps): React.ReactElement {
  return (
    <div className={cn('rounded-xl border px-5 py-10 text-center', className)}>
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-prose text-sm text-pretty text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export interface FeatureLockedStateProps {
  readonly feature: string;
  readonly requiredPlan: string;
  readonly className?: string;
}

/**
 * A feature the current plan does not include.
 *
 * Deliberately not a hidden screen. Someone who follows a link, a bookmark or a
 * teammate's URL to a feature they cannot use should be told which plan has it,
 * not shown an empty page or a 404. The API refuses the request regardless of
 * what this component renders.
 */
export function FeatureLockedState({
  feature,
  requiredPlan,
  className,
}: FeatureLockedStateProps): React.ReactElement {
  return (
    <EmptyState
      className={className}
      title={`${feature} is not included in your plan`}
      description={`Upgrade to ${requiredPlan} to turn it on. Nothing is lost in the meantime — monitoring continues exactly as it is.`}
    />
  );
}

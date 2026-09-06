'use client';

import {
  FINDING_SEVERITY_LABELS,
  type DomainCheckData,
  type MonitorFinding,
  type MonitorResultDto,
  type SslCheckData,
} from '@/contracts';
import type * as React from 'react';

import { RelativeTime } from '@/components/relative-time';
import { cn } from '@/lib/utils';

/**
 * What the most recent run of a monitor actually found.
 *
 * Renders the shared parts — findings, timing, the reason a run failed — for
 * every monitor type, and adds a small type-specific facts table where there is
 * something concrete worth naming. A certificate's issuer and expiry are the
 * two things anyone actually wants; burying them in a generic key/value dump of
 * the payload would be less useful, not more.
 */

const SEVERITY_TONE: Record<MonitorFinding['severity'], string> = {
  critical: 'text-status-down',
  warning: 'text-status-degraded',
  notice: 'text-muted-foreground',
};

export interface MonitorResultDetailProps {
  readonly result: MonitorResultDto;
  readonly className?: string;
}

export function MonitorResultDetail({
  result,
  className,
}: MonitorResultDetailProps): React.ReactElement {
  return (
    <div className={cn('rounded-lg border bg-muted/30 p-3.5', className)}>
      <p className="text-xs text-muted-foreground">
        Checked <RelativeTime iso={result.checkedAt} /> · took{' '}
        {result.durationMs < 1000
          ? `${String(result.durationMs)} ms`
          : `${(result.durationMs / 1000).toFixed(1)} s`}
      </p>

      {result.errorMessage ? (
        <p className="mt-2 text-sm text-pretty">
          <span className="font-medium">The check could not complete.</span>{' '}
          <span className="text-muted-foreground">{result.errorMessage}</span>
        </p>
      ) : null}

      <Facts result={result} />

      {result.findings.length > 0 ? (
        <ul className="mt-3 grid gap-1.5">
          {result.findings.map((finding, index) => (
            <li key={`${finding.code}-${String(index)}`} className="text-sm text-pretty">
              <span className={cn('font-medium', SEVERITY_TONE[finding.severity])}>
                {FINDING_SEVERITY_LABELS[finding.severity]}
              </span>{' '}
              {finding.message}
              {finding.detail ? (
                <span className="block text-xs break-words text-muted-foreground">
                  {finding.detail}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The type-specific facts worth showing beside the findings. */
function Facts({ result }: { readonly result: MonitorResultDto }): React.ReactElement | null {
  const { data } = result;

  if (data.type === 'ssl') return <SslFacts data={data} />;
  if (data.type === 'domain') return <DomainFacts data={data} />;

  return null;
}

function FactList({
  entries,
}: {
  readonly entries: readonly (readonly [string, string])[];
}): React.ReactElement {
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
      {entries.map(([label, value]) => (
        <div key={label} className="flex min-w-0 justify-between gap-3 sm:block">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="truncate font-medium sm:mt-0.5" title={value}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatDate(iso: string | null): string {
  return iso === null ? 'Unknown' : new Date(iso).toLocaleDateString();
}

function formatDays(days: number | null): string {
  if (days === null) return 'Unknown';
  if (days < 0) return `Expired ${String(Math.abs(days))} days ago`;
  return `${String(days)} days`;
}

function SslFacts({ data }: { readonly data: SslCheckData }): React.ReactElement {
  return (
    <FactList
      entries={[
        ['Issuer', data.issuer ?? 'Unknown'],
        ['Expires', formatDate(data.validTo)],
        ['Days remaining', formatDays(data.daysRemaining)],
        ['Protocol', data.protocol ?? 'Unknown'],
        ['Key', data.keyAlgorithm ?? 'Unknown'],
        ['Covers hostname', data.hostnameMatches ? 'Yes' : 'No'],
      ]}
    />
  );
}

function DomainFacts({ data }: { readonly data: DomainCheckData }): React.ReactElement {
  return (
    <FactList
      entries={[
        ['Domain', data.domain],
        ['Registrar', data.registrar ?? 'Unknown'],
        ['Expires', formatDate(data.expiresAt)],
        ['Days remaining', formatDays(data.daysRemaining)],
        ['Registered', formatDate(data.registeredAt)],
        // Named so an operator can tell a structured RDAP answer from a parsed
        // WHOIS one when a date looks wrong.
        ['Source', data.source],
      ]}
    />
  );
}

'use client';

import {
  FINDING_SEVERITY_LABELS,
  type ContentCheckData,
  type DomainCheckData,
  type LinksCheckData,
  type MonitorFinding,
  type MonitorResultDto,
  type PerformanceCheckData,
  type SeoCheckData,
  type SslCheckData,
} from '@/contracts';
import type * as React from 'react';

import { RelativeTime } from '@/components/relative-time';
import { formatExpiryDate, formatRemainingDays, remainingDays } from '@/lib/expiry';
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
  if (data.type === 'performance') return <PerformanceFacts data={data} />;
  if (data.type === 'seo') return <SeoFacts data={data} />;
  if (data.type === 'content') return <ContentFacts data={data} />;
  if (data.type === 'links') return <LinksFacts data={data} />;

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

function SslFacts({ data }: { readonly data: SslCheckData }): React.ReactElement {
  /*
   * Recomputed from the expiry date rather than read from the record.
   *
   * `data.daysRemaining` is the count as it stood when the check ran, which is
   * right for the stored history and wrong here — it is a day out by the next
   * morning, and it stops moving entirely if the monitor stops running, which
   * is exactly when someone most needs the real figure.
   */
  const remaining = remainingDays(data.validTo, data.daysRemaining);

  const status = data.valid
    ? 'Valid'
    : data.selfSigned
      ? 'Self-signed'
      : !data.hostnameMatches
        ? 'Hostname mismatch'
        : 'Not trusted';

  // The certificate's own name first, then the extra names it covers. Truncated
  // because a shared certificate can carry a hundred and the panel is a summary.
  const names = data.subjectAlternativeNames;
  const coverage =
    names.length === 0
      ? (data.subject ?? 'Unknown')
      : names.length <= 3
        ? names.join(', ')
        : `${names.slice(0, 3).join(', ')} +${String(names.length - 3)} more`;

  return (
    <FactList
      entries={[
        ['SSL status', status],
        ['Issuer', data.issuer ?? 'Unknown'],
        ['Valid from', formatExpiryDate(data.validFrom)],
        ['Valid until', formatExpiryDate(data.validTo)],
        ['Days remaining', formatRemainingDays(remaining)],
        ['Covers hostname', data.hostnameMatches ? 'Yes' : 'No'],
        ['Certificate names', coverage],
        ['TLS', [data.protocol, data.keyAlgorithm].filter(Boolean).join(' · ') || 'Unknown'],
      ]}
    />
  );
}

function DomainFacts({ data }: { readonly data: DomainCheckData }): React.ReactElement {
  const remaining = remainingDays(data.expiresAt, data.daysRemaining);

  /*
   * The registry's EPP status codes, which are the only authoritative statement
   * about what state a registration is in. Shown verbatim rather than
   * interpreted: `clientHold` and `pendingDelete` mean specific things a
   * registrar's support desk will ask about by name.
   */
  const statuses =
    data.statuses.length === 0
      ? 'Not published'
      : data.statuses.slice(0, 3).join(', ') +
        (data.statuses.length > 3 ? ` +${String(data.statuses.length - 3)} more` : '');

  return (
    <FactList
      entries={[
        ['Domain', data.domain || 'Unknown'],
        ['Registrar', data.registrar ?? 'Unavailable'],
        ['Registered', formatExpiryDate(data.registeredAt)],
        ['Expires', formatExpiryDate(data.expiresAt)],
        ['Days remaining', formatRemainingDays(remaining)],
        ['Registry status', statuses],
        // Named so an operator can tell a structured RDAP answer from a parsed
        // WHOIS one when a date looks wrong. `none` means no registry answered,
        // which is why every field above it reads as unavailable.
        ['Source', data.source === 'none' ? 'No registry answered' : data.source],
      ]}
    />
  );
}

/** Milliseconds, or an em dash when the provider could not measure it. */
function formatMs(value: number | null): string {
  if (value === null) return '—';
  return value < 1000 ? `${String(value)} ms` : `${(value / 1000).toFixed(2)} s`;
}

function formatBytes(value: number | null): string {
  if (value === null) return '—';
  return value < 1_048_576
    ? `${String(Math.round(value / 1024))} KB`
    : `${(value / 1_048_576).toFixed(2)} MB`;
}

function formatScore(value: number | null): string {
  return value === null ? '—' : `${String(value)}/100`;
}

function PerformanceFacts({ data }: { readonly data: PerformanceCheckData }): React.ReactElement {
  return (
    <>
      <FactList
        entries={[
          ['Performance', formatScore(data.performanceScore)],
          ['Largest Contentful Paint', formatMs(data.largestContentfulPaintMs)],
          ['Time to first byte', formatMs(data.timeToFirstByteMs)],
          ['Page weight', formatBytes(data.totalBytes)],
          ['Accessibility', formatScore(data.accessibilityScore)],
          ['Best practices', formatScore(data.bestPracticesScore)],
        ]}
      />
      {/*
        Named explicitly, because a synthetic score and a Lighthouse score are
        not the same number and must not be compared with each other.
      */}
      <p className="mt-2 text-xs text-muted-foreground">
        {data.source === 'pagespeed'
          ? `Measured by Google PageSpeed Insights (${data.strategy}), using real Lighthouse.`
          : `Measured from our server (${data.strategy}). Lighthouse scores and Core Web Vitals need a real browser, so they are not reported — add a PageSpeed API key for those.`}
      </p>
    </>
  );
}

function SeoFacts({ data }: { readonly data: SeoCheckData }): React.ReactElement {
  return (
    <FactList
      entries={[
        ['Score', `${String(data.score)}/100`],
        ['Indexable', data.indexable ? 'Yes' : 'No'],
        ['Title', data.title ?? 'Missing'],
        ['Meta description', data.metaDescription ? 'Present' : 'Missing'],
        ['Images without alt', `${String(data.imagesMissingAlt)} of ${String(data.imageCount)}`],
        ['Words', String(data.wordCount)],
      ]}
    />
  );
}

function ContentFacts({ data }: { readonly data: ContentCheckData }): React.ReactElement {
  return (
    <>
      <FactList
        entries={[
          ['Changed', data.changed ? 'Yes' : 'No'],
          [
            'How much',
            data.changeRatio === null ? '—' : `${String(Math.round(data.changeRatio * 100))}%`,
          ],
          ['Lines added', String(data.addedLineCount)],
          ['Lines removed', String(data.removedLineCount)],
        ]}
      />
      {data.excerpt ? (
        <pre className="mt-3 max-h-48 overflow-auto rounded-md border bg-background p-3 text-xs whitespace-pre-wrap">
          {data.excerpt}
        </pre>
      ) : null}
    </>
  );
}

function LinksFacts({ data }: { readonly data: LinksCheckData }): React.ReactElement {
  return (
    <>
      <FactList
        entries={[
          ['Pages crawled', String(data.pagesCrawled)],
          ['Links checked', String(data.linksChecked)],
          ['Broken', String(data.brokenCount)],
          ['Coverage', data.truncated ? 'Stopped at the limit' : 'Whole site'],
        ]}
      />
      {data.brokenCount > data.brokenLinks.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing the first {String(data.brokenLinks.length)} of {String(data.brokenCount)}.
        </p>
      ) : null}
    </>
  );
}

'use client';

import type { BillingInterval, Plan, PlanCatalogDto, PlanCatalogEntryDto } from '@/contracts';
import { planRank } from '@/contracts';
import { Check, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  featuresAddedBy,
  formatPrice,
  headlineLimits,
  monthlyEquivalent,
  priceAtInterval,
  upcomingAddedBy,
} from './plan-formatting';

export interface PricingTableProps {
  readonly catalog: PlanCatalogDto;
  /**
   * The viewer's current plan, when they have one.
   *
   * Presentation only — it decides whether a card says "Current plan" or
   * "Upgrade". The API re-derives it on every billing request, so a wrong value
   * here changes a label and nothing more.
   */
  readonly currentPlan?: Plan;
  /**
   * Called when a plan is chosen.
   *
   * Absent on the public pricing page, where there is no session to check out
   * with and every CTA is a link to registration instead. Its presence is what
   * distinguishes the two modes, rather than a flag that could disagree with
   * whether a handler was actually passed.
   */
  readonly onChoose?: (plan: Plan, interval: BillingInterval) => void;
  /** Plan whose action is in flight, so only that card shows a spinner. */
  readonly busyPlan?: Plan | null;
  /** Disables every action, e.g. for a member who cannot manage billing. */
  readonly disabled?: boolean;
  readonly className?: string;
}

/**
 * The plan comparison, shared by the marketing page and the billing screen.
 *
 * One component for both so a plan cannot be described one way to a visitor and
 * another to a customer — the prices, limits and features all come from
 * `GET /api/billing/plans`, which serves the same table the API enforces.
 */
export function PricingTable({
  catalog,
  currentPlan,
  onChoose,
  busyPlan = null,
  disabled = false,
  className,
}: PricingTableProps): React.ReactElement {
  const [interval, setInterval] = useState<BillingInterval>('month');

  const plans = catalog.plans;
  const savings = plans.find((entry) => entry.yearlyMonthsFree > 0)?.yearlyMonthsFree ?? 0;

  return (
    <div className={className}>
      <IntervalToggle value={interval} onChange={setInterval} monthsFree={savings} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((entry, index) => (
          <PlanCard
            key={entry.plan}
            entry={entry}
            previous={index === 0 ? undefined : plans[index - 1]}
            featureLabels={catalog.featureLabels}
            interval={interval}
            currentPlan={currentPlan}
            billingConfigured={catalog.billingConfigured}
            onChoose={onChoose}
            busy={busyPlan === entry.plan}
            disabled={disabled}
          />
        ))}
      </div>

      {!catalog.billingConfigured && (
        <p className="mt-6 text-sm text-muted-foreground">
          Checkout is not available on this deployment yet. The plans above are the ones this
          installation enforces.
        </p>
      )}
    </div>
  );
}

interface IntervalToggleProps {
  readonly value: BillingInterval;
  readonly onChange: (value: BillingInterval) => void;
  readonly monthsFree: number;
}

/**
 * Monthly / yearly.
 *
 * A radio group rather than two buttons or a switch: it is a choice between two
 * mutually exclusive options, which is what a radio group *is*, and it gets
 * arrow-key navigation and a single tab stop for free.
 */
function IntervalToggle({ value, onChange, monthsFree }: IntervalToggleProps): React.ReactElement {
  const options: readonly { readonly id: BillingInterval; readonly label: string }[] = [
    { id: 'month', label: 'Monthly' },
    { id: 'year', label: 'Yearly' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Billing interval"
        className="inline-flex rounded-lg border bg-card p-1"
      >
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            onClick={() => {
              onChange(option.id);
            }}
            className={cn(
              'cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              value === option.id
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {monthsFree > 0 && (
        <Badge variant="secondary">
          {monthsFree === 1 ? '1 month free' : `${String(monthsFree)} months free`} on yearly
        </Badge>
      )}
    </div>
  );
}

interface PlanCardProps {
  readonly entry: PlanCatalogEntryDto;
  readonly previous: PlanCatalogEntryDto | undefined;
  readonly featureLabels: PlanCatalogDto['featureLabels'];
  readonly interval: BillingInterval;
  readonly currentPlan: Plan | undefined;
  readonly billingConfigured: boolean;
  readonly onChoose: ((plan: Plan, interval: BillingInterval) => void) | undefined;
  readonly busy: boolean;
  readonly disabled: boolean;
}

function PlanCard({
  entry,
  previous,
  featureLabels,
  interval,
  currentPlan,
  billingConfigured,
  onChoose,
  busy,
  disabled,
}: PlanCardProps): React.ReactElement {
  const isCurrent = currentPlan === entry.plan;
  const isDowngrade = currentPlan !== undefined && planRank(entry.plan) < planRank(currentPlan);
  const perMonth = monthlyEquivalent(entry, interval);
  const total = priceAtInterval(entry, interval);
  const added = featuresAddedBy(entry, previous);
  const upcoming = upcomingAddedBy(entry, previous);

  return (
    <div
      // Stable handle for the end-to-end suite, which has to pick one card out
      // of four that share every class and most of their text.
      data-testid={`plan-card-${entry.plan}`}
      className={cn(
        'flex flex-col rounded-xl border bg-card p-5 shadow-xs',
        entry.featured && !isCurrent && 'border-primary ring-1 ring-primary',
        isCurrent && 'border-primary bg-primary/5',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{entry.name}</h3>
        {isCurrent ? (
          <Badge>Current plan</Badge>
        ) : entry.featured ? (
          <Badge variant="secondary">Most popular</Badge>
        ) : null}
      </div>

      <p className="mt-1.5 min-h-10 text-sm text-pretty text-muted-foreground">{entry.tagline}</p>

      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {formatPrice(perMonth, entry.currency)}
        </span>
        <span className="text-sm text-muted-foreground">/month</span>
      </p>
      <p className="mt-1 min-h-5 text-xs text-muted-foreground">
        {entry.monthlyPrice === 0
          ? 'Free forever'
          : interval === 'year'
            ? `${formatPrice(total, entry.currency)} billed yearly`
            : 'Billed monthly'}
      </p>

      <div className="mt-5">
        <PlanCta
          entry={entry}
          interval={interval}
          isCurrent={isCurrent}
          isDowngrade={isDowngrade}
          billingConfigured={billingConfigured}
          onChoose={onChoose}
          busy={busy}
          disabled={disabled}
        />
      </div>

      <ul className="mt-5 space-y-2 border-t pt-5 text-sm">
        {headlineLimits(entry.limits).map((line) => (
          <li key={line} className="flex items-start gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {added.length > 0 && (
        <>
          <p className="mt-4 text-xs font-medium text-muted-foreground">
            {previous ? `Everything in ${previous.name}, plus` : 'Includes'}
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {added.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-pretty">{featureLabels[feature]}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/*
        Features the plan grants but the product has not shipped. Shown, because
        they are part of what the tier will include — and clearly marked, because
        selling something that does not exist yet is the one thing a pricing
        table must not do.
      */}
      {upcoming.length > 0 && (
        <>
          <p className="mt-4 text-xs font-medium text-muted-foreground">Coming soon</p>
          <ul className="mt-2 space-y-2 text-sm">
            {upcoming.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-muted-foreground">
                <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span className="text-pretty">{featureLabels[feature]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

interface PlanCtaProps {
  readonly entry: PlanCatalogEntryDto;
  readonly interval: BillingInterval;
  readonly isCurrent: boolean;
  readonly isDowngrade: boolean;
  readonly billingConfigured: boolean;
  readonly onChoose: ((plan: Plan, interval: BillingInterval) => void) | undefined;
  readonly busy: boolean;
  readonly disabled: boolean;
}

/**
 * The one control on a plan card, and the only place the CTA rules live.
 *
 * There are five outcomes and each is a different sentence, because a button
 * that says "Choose plan" and then refuses is worse than one that says what it
 * will do:
 *
 *  - the plan you are on           → a disabled "Current plan";
 *  - a cheaper plan than yours     → "Change plan", routed through the portal
 *                                    so proration and the cancellation date are
 *                                    the provider's problem, not ours;
 *  - a plan this deployment sells  → "Upgrade", or "Get started" with no session;
 *  - a plan with no configured price → "Contact us", not a dead button;
 *  - the free plan, signed out     → "Get started free".
 */
function PlanCta({
  entry,
  interval,
  isCurrent,
  isDowngrade,
  billingConfigured,
  onChoose,
  busy,
  disabled,
}: PlanCtaProps): React.ReactElement {
  if (isCurrent) {
    return (
      <Button variant="outline" className="w-full" disabled>
        Current plan
      </Button>
    );
  }

  // No handler means no session: this is the public pricing page. Every CTA
  // takes the visitor to registration, carrying the plan so the dashboard can
  // offer it again once they land.
  if (!onChoose) {
    const href =
      entry.plan === 'free' ? '/register' : `/register?plan=${encodeURIComponent(entry.plan)}`;
    return (
      <Button variant={entry.featured ? 'default' : 'outline'} className="w-full" asChild>
        <Link href={href}>{entry.plan === 'free' ? 'Get started free' : 'Get started'}</Link>
      </Button>
    );
  }

  /*
   * No payment provider at all on this deployment.
   *
   * Checked *before* `purchasable`, and that ordering is the whole point. When
   * nothing is configured every plan is unpurchasable, so the branch below used
   * to fire for all of them and turn every single upgrade button into a
   * `mailto:` link — which is what someone clicking "Upgrade" actually got: a
   * mail client, not a checkout. "Contact us" is a sales answer to "we don't
   * sell this tier here". It is the wrong answer to "billing isn't set up yet",
   * which is an operator problem and needs to read as one.
   *
   * The banner above the table explains the state; this button just stops
   * pretending there is somewhere to go.
   */
  if (!billingConfigured && entry.plan !== 'free') {
    return (
      <Button variant="outline" className="w-full" disabled>
        Checkout unavailable
      </Button>
    );
  }

  // A plan the backend defines but this deployment has no price for, on a
  // deployment that does sell other plans. Saying so is more useful than a
  // button that would fail at the provider.
  if (!entry.purchasable && entry.plan !== 'free') {
    return (
      <Button variant="outline" className="w-full" asChild>
        <a href="mailto:sales@siteops.app?subject=SiteOps%20plan%20enquiry">Contact us</a>
      </Button>
    );
  }

  if (entry.plan === 'free' || isDowngrade) {
    return (
      <Button
        variant="outline"
        className="w-full"
        disabled={disabled || busy || !billingConfigured}
        onClick={() => {
          onChoose(entry.plan, interval);
        }}
      >
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Change plan
      </Button>
    );
  }

  return (
    <Button
      variant={entry.featured ? 'default' : 'outline'}
      className="w-full"
      disabled={disabled || busy || !billingConfigured}
      onClick={() => {
        onChoose(entry.plan, interval);
      }}
    >
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      Upgrade to {entry.name}
    </Button>
  );
}

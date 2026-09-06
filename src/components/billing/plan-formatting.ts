import type { BillingInterval, PlanCatalogEntryDto, PlanFeature, PlanLimits } from '@/contracts';

/**
 * Turning plan data into the words on screen.
 *
 * Kept out of the components because the pricing page, the billing screen and
 * every upgrade prompt describe the same plan, and three components each
 * deciding how to render "50 websites" is how a marketing page ends up
 * promising something the product does not do.
 */

/**
 * Formats a price given in minor units.
 *
 * `Intl` rather than a hand-rolled `/ 100`, so a currency with a different
 * exponent is right without anyone remembering to check. Trailing zeroes are
 * dropped — "$19", not "$19.00" — because a whole-dollar price reads as noise
 * with them and the fractional case still renders correctly.
 */
export function formatPrice(minorUnits: number, currency: string): string {
  const major = minorUnits / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/**
 * What a plan costs per month at the selected interval.
 *
 * A yearly plan is shown as its monthly equivalent so the two columns compare
 * like with like — a visitor reading "$190" beside "$19" cannot tell at a
 * glance that the first is cheaper.
 */
export function monthlyEquivalent(entry: PlanCatalogEntryDto, interval: BillingInterval): number {
  return interval === 'month' ? entry.monthlyPrice : Math.round(entry.yearlyPrice / 12);
}

export function priceAtInterval(entry: PlanCatalogEntryDto, interval: BillingInterval): number {
  return interval === 'month' ? entry.monthlyPrice : entry.yearlyPrice;
}

/** A limit of zero means "not on this plan", which reads better than "0". */
function limitText(value: number, singular: string, plural: string): string {
  if (value <= 0) return `No ${plural}`;
  return `${value.toLocaleString('en-US')} ${value === 1 ? singular : plural}`;
}

/** Seconds as the interval a human would say. */
export function formatInterval(seconds: number): string {
  if (seconds >= 86_400) {
    const days = Math.round(seconds / 86_400);
    return days === 1 ? 'daily' : `every ${String(days)} days`;
  }
  if (seconds >= 3_600) {
    const hours = Math.round(seconds / 3_600);
    return hours === 1 ? 'hourly' : `every ${String(hours)} hours`;
  }
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? 'every minute' : `every ${String(minutes)} minutes`;
}

/**
 * The handful of limits worth putting on a pricing card.
 *
 * Not every limit: the card has to be scannable, and a visitor deciding between
 * tiers is choosing on volume and speed. The full table is on the billing page,
 * where someone is looking at their own usage.
 */
export function headlineLimits(limits: PlanLimits): readonly string[] {
  return [
    limitText(limits.maxWebsites, 'website', 'websites'),
    limitText(limits.maxMembers, 'team member', 'team members'),
    `Checks ${formatInterval(limits.minMonitoringIntervalSeconds)}`,
    `${String(limits.checkRetentionDays)} days of history`,
  ];
}

/**
 * Every limit, labelled, for the usage table.
 *
 * `usage` is optional because the same rows describe a plan the organization is
 * not on, where there is nothing to have used.
 */
export interface LimitRow {
  readonly key: keyof PlanLimits;
  readonly label: string;
  readonly value: number;
  /** False for limits expressed as an interval or a window rather than a count. */
  readonly countable: boolean;
}

export function limitRows(limits: PlanLimits): readonly LimitRow[] {
  return [
    { key: 'maxWebsites', label: 'Websites', value: limits.maxWebsites, countable: true },
    { key: 'maxMembers', label: 'Team members', value: limits.maxMembers, countable: true },
    { key: 'maxClients', label: 'Clients', value: limits.maxClients, countable: true },
    {
      key: 'maxReportSchedules',
      label: 'Scheduled reports',
      value: limits.maxReportSchedules,
      countable: true,
    },
    {
      key: 'minMonitoringIntervalSeconds',
      label: 'Fastest uptime check',
      value: limits.minMonitoringIntervalSeconds,
      countable: false,
    },
    {
      key: 'checkRetentionDays',
      label: 'History retained',
      value: limits.checkRetentionDays,
      countable: false,
    },
  ];
}

/**
 * What the feature list on a card should say about the tier below it.
 *
 * Listing forty features on four cards is unreadable; listing what each tier
 * *adds* is how a visitor tells them apart. The free plan has no tier below it,
 * so it lists its own.
 */
export function featuresAddedBy(
  entry: PlanCatalogEntryDto,
  previous: PlanCatalogEntryDto | undefined,
): readonly PlanFeature[] {
  return addedBy(entry.features, previous?.features);
}

/**
 * A list from the API, or an empty one.
 *
 * The contract says these arrays are always present, and in a lockstep deploy
 * they are. But a rolling deploy has a window where a new dashboard talks to an
 * older API, and the pricing table renders on the *public landing page* — an
 * absent array must degrade to a shorter feature list, not take the front door
 * down with a 500. Learned the hard way: a missing `upcomingFeatures` did
 * exactly that.
 */
function listOf(value: readonly PlanFeature[] | undefined): readonly PlanFeature[] {
  // `Array.isArray` widens a `readonly T[] | undefined` to `any[]`, so the
  // fallback is written against the value itself to keep the element type.
  return value ?? [];
}

/**
 * The same, for features the plan grants that are not built yet.
 *
 * Listed apart and labelled as upcoming. Showing them at all is a choice —
 * they are part of what a tier will include — but showing them as though they
 * were available would be a promise the product cannot keep.
 */
export function upcomingAddedBy(
  entry: PlanCatalogEntryDto,
  previous: PlanCatalogEntryDto | undefined,
): readonly PlanFeature[] {
  return addedBy(entry.upcomingFeatures, previous?.upcomingFeatures);
}

function addedBy(
  features: readonly PlanFeature[] | undefined,
  previous: readonly PlanFeature[] | undefined,
): readonly PlanFeature[] {
  const current = listOf(features);
  if (previous === undefined) return [...current];
  const already = new Set(listOf(previous));
  return current.filter((feature) => !already.has(feature));
}

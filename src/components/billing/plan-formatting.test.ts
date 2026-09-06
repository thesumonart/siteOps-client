import type { PlanCatalogEntryDto, PlanLimits } from '@/contracts';
import { PLAN_FEATURE_LABELS, limitsFor } from '@/contracts';
import { describe, expect, it } from 'vitest';

import {
  featuresAddedBy,
  formatInterval,
  formatPrice,
  headlineLimits,
  monthlyEquivalent,
  priceAtInterval,
  upcomingAddedBy,
} from './plan-formatting';

/**
 * The words a plan is described with.
 *
 * These are the sentences a visitor decides on and a customer is billed by, so
 * the cases worth pinning are the ones where a formatting slip changes the
 * meaning: a price rounded into a different number, a limit of zero rendered as
 * a quantity, an interval read as the wrong cadence.
 */

function entry(overrides: Partial<PlanCatalogEntryDto> = {}): PlanCatalogEntryDto {
  return {
    plan: 'starter',
    name: 'Professional',
    tagline: '',
    currency: 'usd',
    monthlyPrice: 1_900,
    yearlyPrice: 19_000,
    yearlyMonthsFree: 2,
    limits: limitsFor('starter'),
    features: [],
    upcomingFeatures: [],
    purchasable: true,
    featured: false,
    ...overrides,
  };
}

describe('formatPrice', () => {
  it('renders a whole-dollar price without trailing zeroes', () => {
    expect(formatPrice(1_900, 'usd')).toBe('$19');
    expect(formatPrice(0, 'usd')).toBe('$0');
  });

  it('keeps the cents when a price is not a whole unit', () => {
    expect(formatPrice(1_583, 'usd')).toBe('$15.83');
  });

  it('reads the currency from the plan rather than assuming dollars', () => {
    expect(formatPrice(1_900, 'eur')).toContain('19');
    expect(formatPrice(1_900, 'eur')).not.toContain('$');
  });
});

describe('monthlyEquivalent', () => {
  it('is the monthly price at a monthly interval', () => {
    expect(monthlyEquivalent(entry(), 'month')).toBe(1_900);
  });

  it('divides the yearly price so the columns compare like with like', () => {
    // A visitor reading "$190" beside "$19" cannot tell which is cheaper.
    expect(monthlyEquivalent(entry(), 'year')).toBe(1_583);
  });

  it('leaves the free plan at zero', () => {
    const free = entry({ monthlyPrice: 0, yearlyPrice: 0 });
    expect(monthlyEquivalent(free, 'year')).toBe(0);
  });
});

describe('priceAtInterval', () => {
  it('returns the amount actually charged for the chosen interval', () => {
    expect(priceAtInterval(entry(), 'month')).toBe(1_900);
    expect(priceAtInterval(entry(), 'year')).toBe(19_000);
  });
});

describe('formatInterval', () => {
  it('names sub-hour cadences in minutes', () => {
    expect(formatInterval(60)).toBe('every minute');
    expect(formatInterval(300)).toBe('every 5 minutes');
  });

  it('names hourly and daily cadences as such', () => {
    expect(formatInterval(3_600)).toBe('hourly');
    expect(formatInterval(21_600)).toBe('every 6 hours');
    expect(formatInterval(86_400)).toBe('daily');
  });
});

describe('headlineLimits', () => {
  it('renders a limit of zero as an exclusion, not a quantity', () => {
    const limits: PlanLimits = { ...limitsFor('free'), maxWebsites: 0 };
    expect(headlineLimits(limits)[0]).toBe('No websites');
  });

  it('singularises a limit of one', () => {
    const limits: PlanLimits = { ...limitsFor('free'), maxMembers: 1 };
    expect(headlineLimits(limits)[1]).toBe('1 team member');
  });

  it('groups thousands so a large limit stays readable', () => {
    const limits: PlanLimits = { ...limitsFor('pro'), maxWebsites: 20_000 };
    expect(headlineLimits(limits)[0]).toBe('20,000 websites');
  });

  it('describes the plan the API sent rather than a hard-coded tier', () => {
    expect(headlineLimits(limitsFor('agency'))).toContain('50 websites');
    expect(headlineLimits(limitsFor('free'))).toContain('3 websites');
  });
});

describe('featuresAddedBy', () => {
  it('lists everything for the lowest tier, which has nothing below it', () => {
    const free = entry({ features: ['ssl_monitoring', 'domain_monitoring'] });
    expect(featuresAddedBy(free, undefined)).toEqual(['ssl_monitoring', 'domain_monitoring']);
  });

  it('lists only what a tier adds over the one below', () => {
    const free = entry({ features: ['ssl_monitoring'] });
    const paid = entry({ features: ['ssl_monitoring', 'reports'] });
    expect(featuresAddedBy(paid, free)).toEqual(['reports']);
  });

  it('separates unshipped features on the same rule', () => {
    const free = entry({ upcomingFeatures: ['webhooks'] });
    const paid = entry({ upcomingFeatures: ['webhooks', 'api_access'] });
    expect(upcomingAddedBy(paid, free)).toEqual(['api_access']);
  });

  it('has a label for every feature it can be asked to render', () => {
    // A missing label renders as blank, which reads as a bug rather than as a
    // feature nobody named.
    for (const feature of Object.keys(PLAN_FEATURE_LABELS)) {
      expect(PLAN_FEATURE_LABELS[feature as keyof typeof PLAN_FEATURE_LABELS]).toBeTruthy();
    }
  });
});

describe('resilience to an older API', () => {
  it('renders a shorter list rather than throwing when a feature array is missing', () => {
    // A rolling deploy can leave a new dashboard talking to an older API. The
    // pricing table is on the public landing page, so an absent array has to
    // degrade — this exact gap took the front door down with a 500 once.
    const stale = { ...entry(), upcomingFeatures: undefined } as unknown as PlanCatalogEntryDto;

    expect(() => upcomingAddedBy(stale, undefined)).not.toThrow();
    expect(upcomingAddedBy(stale, undefined)).toEqual([]);
    expect(featuresAddedBy(entry({ features: ['reports'] }), stale)).toEqual(['reports']);
  });
});

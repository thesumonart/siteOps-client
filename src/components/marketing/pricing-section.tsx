import type { PlanCatalogDto } from '@/contracts';
import type * as React from 'react';

import { PricingTable } from '@/components/billing/pricing-table';
import { fetchPlanCatalog } from '@/lib/billing';

/**
 * The catalogue, or null if it could not be read.
 *
 * A failed fetch must not take the whole page down. The home page's job is to
 * explain the product; losing the price table is worse than losing nothing, but
 * far better than a 500 on the front door.
 */
async function loadCatalog(): Promise<PlanCatalogDto | null> {
  try {
    return await fetchPlanCatalog();
  } catch {
    return null;
  }
}

/**
 * The public pricing section.
 *
 * Fetched server-side from `GET /api/billing/plans` rather than written into
 * this file. The plans, prices, limits and features a visitor reads here are
 * the same objects `EntitlementService` enforces, so the page cannot promise a
 * limit the API does not grant — which is the failure mode that makes a pricing
 * page a support problem rather than a marketing one.
 */
export async function PricingSection({
  headingLevel = 'h2',
}: {
  readonly headingLevel?: 'h1' | 'h2';
}): Promise<React.ReactElement> {
  const catalog = await loadCatalog();

  const Heading = headingLevel;

  return (
    <section id="pricing" className="scroll-mt-16 border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <Heading className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Pricing that follows your portfolio
          </Heading>
          <p className="mt-4 text-lg text-pretty text-muted-foreground">
            Start free on three websites. Move up when you have more sites to watch, more people to
            give access to, or clients who want a portal of their own.
          </p>
        </div>

        {catalog ? (
          <PricingTable catalog={catalog} className="mt-10" />
        ) : (
          <p className="mt-10 text-sm text-muted-foreground">
            Plan details are temporarily unavailable. Please try again shortly.
          </p>
        )}
      </div>
    </section>
  );
}

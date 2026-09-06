import type { Metadata } from 'next';
import Link from 'next/link';
import type * as React from 'react';

import { PricingSection } from '@/components/marketing/pricing-section';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'SiteOps plans: free monitoring for three websites, and paid tiers for agencies with larger portfolios, client portals and white labelling.',
};

/**
 * The pricing page.
 *
 * A destination of its own as well as a section on the home page, because
 * "what does it cost" is a question people arrive at directly, link to, and
 * return to — and because the dashboard's upgrade prompts need somewhere to
 * send a signed-out visitor.
 *
 * The table itself is the same component the billing screen renders, fed by the
 * same endpoint, so a plan cannot be described one way here and another once
 * someone has signed up.
 */
export default function PricingPage(): React.ReactElement {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="pricing" />

      <main className="flex-1">
        {/* The section renders its own heading, promoted to h1 here because on
            this page the pricing *is* the page. */}
        <PricingSection headingLevel="h1" />

        <section className="border-t">
          <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>

            <dl className="mt-8 space-y-8">
              <div>
                <dt className="text-sm font-medium">What happens when I hit a limit?</dt>
                <dd className="mt-1.5 text-sm text-pretty text-muted-foreground">
                  The action is refused with a message naming the plan that would allow it. Nothing
                  you have already added stops being monitored.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium">Can I change plan later?</dt>
                <dd className="mt-1.5 text-sm text-pretty text-muted-foreground">
                  Yes, from Billing in the dashboard, at any time. Upgrades apply immediately and a
                  downgrade takes effect at the end of the period you have paid for.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium">What happens if I cancel?</dt>
                <dd className="mt-1.5 text-sm text-pretty text-muted-foreground">
                  Your organization returns to the free plan at the end of the paid period. Your
                  websites, history and incidents stay where they are — only the limits change.
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium">Do you charge per website?</dt>
                <dd className="mt-1.5 text-sm text-pretty text-muted-foreground">
                  No. Each plan includes a number of websites and team members, and the price is the
                  same whether you use one of them or all of them.
                </dd>
              </div>
            </dl>

            <div className="mt-12 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/register">Start free</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Back to overview</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

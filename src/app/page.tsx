import type { WebsiteStatus } from '@/contracts';
import {
  Activity,
  Bell,
  Briefcase,
  FileText,
  Gauge,
  Link2Off,
  Search,
  ShieldCheck,
  TriangleAlert,
  Globe,
} from 'lucide-react';
import Link from 'next/link';
import type * as React from 'react';

import { PricingSection } from '@/components/marketing/pricing-section';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';

/**
 * What SiteOps actually does today.
 *
 * Every entry here corresponds to a monitor, a screen or a job that exists in
 * the product. Features the plans grant but that are not built yet —
 * integrations, status pages, the API, AI analysis — are deliberately absent:
 * see `UNRELEASED_PLAN_FEATURES` in the contract, which is also what keeps them
 * off the pricing table.
 */
const CAPABILITIES = [
  {
    icon: Activity,
    title: 'Uptime and response time',
    body: 'Every site is checked on a schedule you control, with the response time recorded on each check.',
  },
  {
    icon: TriangleAlert,
    title: 'Confirmed incidents, not noise',
    body: 'An outage is only declared after consecutive failures, so a blip on one request never pages you.',
  },
  {
    icon: ShieldCheck,
    title: 'SSL certificates',
    body: 'Chain validity, hostname coverage and days remaining, so a certificate never expires unannounced.',
  },
  {
    icon: Globe,
    title: 'Domain expiry',
    body: 'Registration dates read from the registry itself, with WHOIS as a fallback when RDAP has nothing.',
  },
  {
    icon: Gauge,
    title: 'Performance',
    body: 'Lighthouse scores and Core Web Vitals where a key is configured, and honest server-side timings where it is not.',
  },
  {
    icon: Search,
    title: 'SEO health',
    body: 'Titles, descriptions, canonicals, headings and robots directives, checked on every crawl.',
  },
  {
    icon: Link2Off,
    title: 'Broken links',
    body: 'A bounded crawl of each site that reports what is broken and the page it was found on.',
  },
  {
    icon: Bell,
    title: 'One alert per incident',
    body: 'You are told when a site goes down and when it comes back. Never the same alert twice.',
  },
  {
    icon: FileText,
    title: 'Reports your clients read',
    body: 'Uptime and performance summaries, exported to PDF and delivered on a schedule you set.',
  },
  {
    icon: Briefcase,
    title: 'Client portals',
    body: 'Give a client a login that shows only their websites, under your name and your colours.',
  },
] as const;

interface ExampleRow {
  readonly site: string;
  readonly status: WebsiteStatus;
  readonly uptime: string;
  readonly response: string;
}

const EXAMPLE_ROWS: readonly ExampleRow[] = [
  { site: 'acme.com', status: 'operational', uptime: '99.99%', response: '213 ms' },
  { site: 'store.example', status: 'degraded', uptime: '99.62%', response: '2.4 s' },
  { site: 'startup.io', status: 'down', uptime: '98.11%', response: '—' },
];

export default function HomePage(): React.ReactElement {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="home" />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Monitor every client website from one dashboard.
            </h1>
            <p className="mt-5 text-lg text-pretty text-muted-foreground">
              SiteOps checks uptime, certificates, domains, performance and SEO around the clock,
              confirms real outages before it alerts you, and keeps the history your clients ask
              about.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/register">Start monitoring free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Three websites free, forever. No card to start.
            </p>
          </div>

          {/*
            A static illustration of the dashboard's own vocabulary. These are
            example rows, labelled as such — the product never shows invented
            monitoring data as if it were real.
          */}
          <div className="mt-16 overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className="flex items-center justify-between border-b px-5 py-3 text-xs font-medium text-muted-foreground">
              <span>Example view</span>
              <span aria-hidden="true">Uptime · 30 days</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  An example of how monitored websites appear in the SiteOps dashboard.
                </caption>
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Website
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Status
                    </th>
                    <th
                      scope="col"
                      className="hidden px-5 py-2.5 text-right font-medium sm:table-cell"
                    >
                      Uptime
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">
                      Response
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {EXAMPLE_ROWS.map((row) => (
                    <tr key={row.site}>
                      <td className="px-5 py-3 font-medium">{row.site}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="tabular-figures hidden px-5 py-3 text-right font-mono text-xs sm:table-cell">
                        {row.uptime}
                      </td>
                      <td className="tabular-figures px-5 py-3 text-right font-mono text-xs">
                        {row.response}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-16 border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Everything you check by hand, on a schedule
              </h2>
              <p className="mt-4 text-lg text-pretty text-muted-foreground">
                Ten monitors across every site you look after, each with its own cadence and its own
                alert.
              </p>
            </div>

            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-3 text-sm font-medium">{title}</h3>
                  <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <PricingSection />

        <section className="border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Start with three websites, free.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
              Add a site, pick an interval, and SiteOps starts watching it. Upgrade when your
              portfolio outgrows the free plan.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link href="/register">Create an account</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

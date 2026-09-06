import { Activity } from 'lucide-react';
import Link from 'next/link';
import type * as React from 'react';

import { Button } from '@/components/ui/button';

/**
 * Header and footer for the pages a signed-out visitor sees.
 *
 * Shared between the home page and `/pricing` so the two cannot drift into
 * looking like different products — which is exactly what happened to the
 * pricing link the first time it existed on only one of them.
 */

export interface SiteHeaderProps {
  /** Marks the current page in the nav for assistive technology. */
  readonly current?: 'home' | 'pricing';
}

export function SiteHeader({ current }: SiteHeaderProps): React.ReactElement {
  return (
    <header className="border-b">
      <nav
        className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
        aria-label="Main"
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Activity className="size-5 text-primary" aria-hidden="true" />
          SiteOps
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Pricing is a first-class destination rather than a footer link:
              it is the question a visitor evaluating the product asks second. */}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/pricing" aria-current={current === 'pricing' ? 'page' : undefined}>
              Pricing
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter(): React.ReactElement {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:px-6">
        <span>SiteOps</span>
        <div className="flex items-center gap-4">
          <Link
            href="/pricing"
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="rounded-sm outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Sign in
          </Link>
          <span>Website monitoring for agencies</span>
        </div>
      </div>
    </footer>
  );
}

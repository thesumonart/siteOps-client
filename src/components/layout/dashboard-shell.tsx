'use client';

import type { OrganizationMembershipDto, Permission, UserDto } from '@/contracts';
import {
  Activity,
  Bell,
  Globe,
  Briefcase,
  CreditCard,
  FileText,
  LayoutDashboard,
  Menu,
  ScrollText,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { AccountMenu } from '@/components/layout/account-menu';
import { OrganizationSwitcher } from '@/components/layout/organization-switcher';
import { syncActiveOrganizationCookie } from '@/lib/active-organization';
import { cn } from '@/lib/utils';

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  /** Hidden when the current role lacks this. The API enforces it regardless. */
  readonly permission?: Permission;
}

/**
 * Only routes that exist are listed — never a placeholder for something not
 * built yet.
 */
const NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/websites', label: 'Websites', icon: Globe, permission: 'website:read' },
  {
    href: '/dashboard/incidents',
    label: 'Incidents',
    icon: TriangleAlert,
    permission: 'incident:read',
  },
  { href: '/dashboard/members', label: 'Members', icon: Users, permission: 'member:read' },
  { href: '/dashboard/clients', label: 'Clients', icon: Briefcase, permission: 'client:read' },
  { href: '/dashboard/reports', label: 'Reports', icon: FileText, permission: 'report:read' },
  {
    href: '/dashboard/settings',
    label: 'Notifications',
    icon: Bell,
    permission: 'notification:read',
  },
  {
    href: '/dashboard/audit-logs',
    label: 'Audit log',
    icon: ScrollText,
    permission: 'audit_log:read',
  },
  /*
   * Billing sits at the foot of the list, after the day-to-day screens, because
   * it is visited rarely and by one role. It is *in* the list rather than only
   * in the account menu because a subscription that can be reached solely by
   * knowing a URL is a subscription nobody upgrades — which is exactly the
   * state this navigation was in before.
   */
  {
    href: '/dashboard/billing',
    label: 'Billing',
    icon: CreditCard,
    permission: 'billing:read',
  },
];

/**
 * Routes that render at full width with no sidebar at all.
 *
 * These are the screens someone opens to do one thing and then leaves: read a
 * report, compare plans, study one website's history. The navigation is
 * overhead on all three — and the sidebar costs 256px of exactly the width the
 * tables and charts on them need most.
 *
 * The sidebar is *not rendered* on these routes rather than hidden. A hidden
 * `<aside>` that keeps its track in the flex row leaves a 256px gap where the
 * navigation used to be, which is worse than leaving it there — it looks like
 * a rendering bug rather than a layout.
 *
 * Prefix matching, except for websites: `/dashboard/websites` is the list and
 * keeps its sidebar, while `/dashboard/websites/<id>` is the detail view and
 * does not. Matching by prefix there would take the sidebar off both.
 */
const STANDALONE_PREFIXES: readonly string[] = ['/dashboard/billing', '/dashboard/reports'];

const WEBSITE_DETAIL = /^\/dashboard\/websites\/[^/]+\/?$/;

export function isStandaloneRoute(pathname: string): boolean {
  if (WEBSITE_DETAIL.test(pathname)) return true;
  return STANDALONE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export interface DashboardShellProps {
  readonly user: UserDto;
  readonly memberships: readonly OrganizationMembershipDto[];
  readonly activeOrganizationId: string;
  readonly permissions: readonly Permission[];
  /**
   * True when the active membership is a client contact rather than a member of
   * the agency.
   *
   * Changes the wording, not the access — a client's navigation is already
   * empty of everything they cannot reach, because each item declares the
   * permission it needs and they hold almost none. This is what makes the
   * portal read as *theirs* rather than as a stripped-down agency dashboard.
   */
  readonly isClientPortal?: boolean;
  readonly children: React.ReactNode;
}

export function DashboardShell({
  user,
  memberships,
  activeOrganizationId,
  permissions,
  isClientPortal = false,
  children,
}: DashboardShellProps): React.ReactElement {
  const pathname = usePathname();

  /*
   * Synchronised through a lazy `useState` initializer rather than an effect
   * because it has to happen before the children mount: their queries fire on
   * mount, and an effect in this component would run after them — the first
   * render of a fresh session would fail every request, then silently work on
   * the next one.
   */
  useState(() => {
    syncActiveOrganizationCookie(activeOrganizationId);
  });

  /*
   * The drawer remembers which route it was opened on, so any navigation —
   * including the browser's back button — closes it. Adjusting state during
   * render is React's recommended alternative to a `useEffect` that only exists
   * to reset state when a prop changes.
   */
  const [nav, setNav] = useState({ open: false, openedAt: pathname });
  if (nav.open && nav.openedAt !== pathname) {
    setNav({ open: false, openedAt: pathname });
  }
  const mobileNavOpen = nav.open && nav.openedAt === pathname;

  const visibleItems = NAV_ITEMS.filter(
    (item) => item.permission === undefined || permissions.includes(item.permission),
  );

  /*
   * A client sees the agency's name, not ours. The portal is the agency's
   * product as far as their customer is concerned, and the branding settings
   * that go further are applied server-side where the plan can gate them.
   */
  const activeOrganizationName = isClientPortal
    ? memberships.find((entry) => entry.organization.id === activeOrganizationId)?.organization.name
    : null;

  const sidebar = (
    <div className="flex h-full flex-col gap-1 p-3">
      <div className="mb-1">
        <OrganizationSwitcher
          memberships={memberships}
          activeOrganizationId={activeOrganizationId}
        />
      </div>

      <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-0.5">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-accent font-medium text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t pt-3">
        <AccountMenu user={user} permissions={permissions} />
      </div>
    </div>
  );

  /*
   * The standalone layout: one column, no aside, no `lg:flex-row`.
   *
   * Navigation is not simply dropped. A page with no way back is a dead end, so
   * the top bar keeps the three things the sidebar was actually load-bearing
   * for — somewhere to go, which organization you are in, and who you are
   * signed in as — in a 56px strip instead of a 256px column. Identical at
   * every breakpoint, because there is no drawer to open.
   */
  if (isStandaloneRoute(pathname)) {
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Activity className="size-5 text-primary" aria-hidden="true" />
            <span className="hidden sm:inline">{activeOrganizationName ?? 'SiteOps'}</span>
          </Link>

          {/* `flex-1` so the navigation claims the space left over rather than
              only what its content needs — without it the account block on the
              right squeezes it to nothing on a phone. */}
          <nav
            aria-label="Dashboard"
            className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
          >
            {visibleItems.map(({ href, label, icon: Icon }) => {
              const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  title={label}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {/* Labels collapse to icons on narrow screens so the whole
                      set stays reachable without a horizontal scroll. */}
                  <span className="hidden md:inline">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden w-56 sm:block">
              <OrganizationSwitcher
                memberships={memberships}
                activeOrganizationId={activeOrganizationId}
              />
            </div>
            {/*
              Both controls were written for a 256px sidebar column and size
              themselves to their container, so they need an explicit width
              here or they take the whole bar and leave the navigation with
              none of it.
            */}
            <div className="w-36 sm:w-52">
              <AccountMenu user={user} permissions={permissions} />
            </div>
          </div>
        </header>

        {/* No `mx-auto`, no maximum: the whole viewport width, which is the
            entire reason these routes are separated out. */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Mobile bar. The sidebar is a drawer below the lg breakpoint rather
          than a squeezed column. */}
      <header className="flex h-14 items-center gap-2 border-b px-4 lg:hidden">
        <button
          type="button"
          onClick={() => {
            setNav((current) => ({ open: !current.open, openedAt: pathname }));
          }}
          aria-expanded={mobileNavOpen}
          aria-controls="dashboard-nav"
          className="-ml-2 flex size-11 cursor-pointer items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {mobileNavOpen ? (
            <X className="size-5" aria-hidden="true" />
          ) : (
            <Menu className="size-5" aria-hidden="true" />
          )}
          <span className="sr-only">{mobileNavOpen ? 'Close menu' : 'Open menu'}</span>
        </button>
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <Activity className="size-5 text-primary" aria-hidden="true" />
          {activeOrganizationName ?? 'SiteOps'}
        </span>
      </header>

      <aside id="dashboard-nav" hidden={!mobileNavOpen} className="border-b bg-sidebar lg:hidden">
        {sidebar}
      </aside>

      <aside className="hidden w-64 shrink-0 border-r bg-sidebar lg:block">
        <div className="sticky top-0 h-dvh">{sidebar}</div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

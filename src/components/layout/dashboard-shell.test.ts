import { describe, expect, it } from 'vitest';

import { isStandaloneRoute } from './dashboard-shell';

/**
 * Which routes drop the sidebar entirely.
 *
 * The distinction that matters is inside `/dashboard/websites`: the list keeps
 * its navigation, the detail view does not. A prefix match — the obvious
 * implementation — takes the sidebar off both, and the websites list is the
 * screen people navigate *from*, so losing its navigation is the one mistake
 * here that would actually be felt.
 */
describe('isStandaloneRoute', () => {
  it('takes the sidebar off a single website', () => {
    expect(isStandaloneRoute('/dashboard/websites/6a9be2eb5e97d191c32bd1da')).toBe(true);
    // A trailing slash is the same route.
    expect(isStandaloneRoute('/dashboard/websites/6a9be2eb5e97d191c32bd1da/')).toBe(true);
  });

  it('leaves the websites list alone', () => {
    expect(isStandaloneRoute('/dashboard/websites')).toBe(false);
    expect(isStandaloneRoute('/dashboard/websites/')).toBe(false);
  });

  it('covers billing and reports, including anything nested under them', () => {
    expect(isStandaloneRoute('/dashboard/billing')).toBe(true);
    expect(isStandaloneRoute('/dashboard/reports')).toBe(true);
    expect(isStandaloneRoute('/dashboard/reports/2026-08')).toBe(true);
  });

  it('does not match a route that merely starts with the same characters', () => {
    // `/dashboard/billing-history` is not `/dashboard/billing`.
    expect(isStandaloneRoute('/dashboard/billing-history')).toBe(false);
    expect(isStandaloneRoute('/dashboard/reports-archive')).toBe(false);
  });

  it('keeps the sidebar everywhere else', () => {
    for (const route of [
      '/dashboard',
      '/dashboard/incidents',
      '/dashboard/members',
      '/dashboard/clients',
      '/dashboard/settings',
      '/dashboard/audit-logs',
      '/dashboard/profile',
    ]) {
      expect(isStandaloneRoute(route)).toBe(false);
    }
  });
});

import { expect, test, type Page } from '@playwright/test';

import { newAccount, onboard } from './support/account';
import { closeDb, deleteAccount } from './support/database';

/**
 * The subscription journey, end to end.
 *
 * This suite exists because of a specific failure: billing was implemented in
 * the backend and reachable from nowhere in the product. Every case below is
 * therefore a *discoverability* assertion as much as a functional one — that a
 * visitor meets pricing without being told a URL, and that a signed-in owner
 * finds billing from the navigation they already use.
 *
 * Nothing here completes a payment. Checkout is a hosted page on the provider's
 * own domain, and driving it would be testing Stripe rather than SiteOps; the
 * plan itself is granted by a signed webhook, which the backend suite covers.
 */

const account = newAccount('billing');

/*
 * One account for the file, onboarded once. Anonymous cases still get a clean
 * context — Playwright gives every test its own — so the signed-out and
 * signed-in halves below do not interfere.
 */
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await onboard(page, account);
  await page.close();
});

test.afterAll(async () => {
  await deleteAccount(account.email);
  await closeDb();
});

async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe('a visitor can find pricing', () => {
  test('reaches pricing from the landing page without knowing a URL', async ({ page }) => {
    await page.goto('/');

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Pricing' })
      .click();

    await expect(page).toHaveURL(/\/pricing/);
    await expect(
      page.getByRole('heading', { name: /Pricing that follows your portfolio/ }),
    ).toBeVisible();
  });

  test('shows pricing on the landing page itself', async ({ page }) => {
    await page.goto('/');

    // The section is on the page a visitor already landed on, not only behind
    // a link — this is the surface that was missing entirely.
    const pricing = page.locator('#pricing');
    await expect(pricing).toBeVisible();
    await expect(pricing.getByRole('heading', { name: 'Free' })).toBeVisible();
    await expect(pricing.getByRole('heading', { name: 'Agency' })).toBeVisible();
  });

  test('renders every plan the backend defines, with a price and limits', async ({ page }) => {
    await page.goto('/pricing');

    for (const name of ['Free', 'Professional', 'Agency', 'Pro']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }

    // Limits come from the same table the API enforces, so a mismatch here is
    // a promise the product would refuse to keep.
    await expect(page.getByText('3 websites')).toBeVisible();
    await expect(page.getByText('50 websites')).toBeVisible();
  });

  test('switches between monthly and yearly pricing', async ({ page }) => {
    await page.goto('/pricing');

    await expect(page.getByText('$19', { exact: true })).toBeVisible();

    await page.getByRole('radio', { name: 'Yearly' }).click();

    // The yearly rate is shown per month so the columns compare like with like.
    await expect(page.getByText('$190 billed yearly')).toBeVisible();
  });

  test('sends a chosen plan through registration', async ({ page }) => {
    await page.goto('/pricing');

    await page.getByTestId('plan-card-agency').getByRole('link', { name: 'Get started' }).click();

    // The chosen plan travels, so the dashboard can offer it again once the
    // account exists rather than dropping the intent at the sign-up form.
    await expect(page).toHaveURL(/\/register\?plan=agency/);
  });

  test('offers no checkout to a signed-out visitor', async ({ page }) => {
    await page.goto('/pricing');

    // Without a session there is nothing to check out with, so every call to
    // action is a link into registration rather than a button that would fail.
    await expect(page.getByRole('button', { name: /Upgrade to/ })).toHaveCount(0);
  });
});

test.describe('an owner can find billing', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('reaches billing from the sidebar', async ({ page }) => {
    await page
      .getByRole('navigation', { name: 'Dashboard' })
      .getByRole('link', { name: 'Billing' })
      .click();

    await expect(page).toHaveURL(/\/dashboard\/billing/);
    await expect(page.getByRole('heading', { name: 'Billing', level: 1 })).toBeVisible();
  });

  test('reaches billing from the account menu', async ({ page }) => {
    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Billing & subscription' }).click();

    await expect(page).toHaveURL(/\/dashboard\/billing/);
  });

  test('shows the real plan, real usage and the plans available', async ({ page }) => {
    await page.goto('/dashboard/billing');

    await expect(page.getByRole('heading', { name: /Current plan for/ })).toBeVisible();
    await expect(page.getByText('Free', { exact: true }).first()).toBeVisible();

    // A brand-new organization has no websites and one member. These are
    // counted server-side, so they are the real numbers rather than a
    // placeholder — the point of the panel.
    await expect(page.getByRole('progressbar', { name: /Websites: 0 of 3/ })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: /Team members: 1 of 2/ })).toBeVisible();

    // A limit the plan does not grant is an exclusion, not a usage bar.
    await expect(page.getByText('Not included').first()).toBeVisible();
  });

  test('marks the current plan as unavailable to buy again', async ({ page }) => {
    await page.goto('/dashboard/billing');

    await expect(page.getByRole('button', { name: 'Current plan' })).toBeDisabled();
  });

  test('reaches the profile page from the account menu', async ({ page }) => {
    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('menuitem', { name: 'Profile' }).click();

    await expect(page).toHaveURL(/\/dashboard\/profile/);
    await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible();
    // The email is shown but not editable: changing it needs a re-verification
    // flow that does not exist, and a field that appeared to work would leave
    // alerts going to an unconfirmed address.
    await expect(page.getByLabel('Email')).toBeDisabled();
  });
});

test.describe('billing is protected', () => {
  test('sends an anonymous visitor to sign-in', async ({ page }) => {
    await page.goto('/dashboard/billing');

    await expect(page).toHaveURL(/\/login/);
    expect(page.url()).toContain('next=');
  });
});

test.describe('responsive', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shows pricing on a phone without sideways scrolling', async ({ page }) => {
    await page.goto('/pricing');

    await expect(page.getByRole('heading', { name: 'Agency', exact: true })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });

  test('keeps billing reachable from the mobile drawer', async ({ page }) => {
    await signIn(page);

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page
      .getByRole('navigation', { name: 'Dashboard' })
      .getByRole('link', { name: 'Billing' })
      .click();

    await expect(page).toHaveURL(/\/dashboard\/billing/);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});

import type { Plan, PlanCatalogDto, PlanCatalogEntryDto } from '@/contracts';
import { PLAN_FEATURE_LABELS, limitsFor } from '@/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PricingTable } from './pricing-table';

/**
 * The plan comparison, in both the modes it serves.
 *
 * What these protect is not layout. It is the set of promises the table makes:
 * that a price shown is the price the API sent, that a plan the deployment
 * cannot sell never offers a checkout button, that a feature the product has
 * not built is labelled as coming rather than included, and that the plan you
 * are already on cannot be bought again.
 */

function entry(plan: Plan, overrides: Partial<PlanCatalogEntryDto> = {}): PlanCatalogEntryDto {
  return {
    plan,
    name: plan === 'starter' ? 'Professional' : plan[0]!.toUpperCase() + plan.slice(1),
    tagline: `The ${plan} plan.`,
    currency: 'usd',
    monthlyPrice: plan === 'free' ? 0 : 1_900,
    yearlyPrice: plan === 'free' ? 0 : 19_000,
    yearlyMonthsFree: plan === 'free' ? 0 : 2,
    limits: limitsFor(plan),
    features: ['ssl_monitoring'],
    upcomingFeatures: [],
    purchasable: plan !== 'free',
    featured: false,
    ...overrides,
  };
}

function catalog(plans: readonly PlanCatalogEntryDto[], billingConfigured = true): PlanCatalogDto {
  return { plans, featureLabels: PLAN_FEATURE_LABELS, billingConfigured };
}

describe('PricingTable — public mode', () => {
  it('sends every plan to registration when there is no session', () => {
    render(<PricingTable catalog={catalog([entry('free'), entry('starter')])} />);

    expect(screen.getByRole('link', { name: 'Get started free' })).toHaveAttribute(
      'href',
      '/register',
    );
    // The chosen plan travels so the dashboard can offer it again after sign-up.
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute(
      'href',
      '/register?plan=starter',
    );
  });

  it('renders the price the API sent, not one of its own', () => {
    render(<PricingTable catalog={catalog([entry('agency', { monthlyPrice: 7_900 })])} />);
    expect(screen.getByText('$79')).toBeInTheDocument();
  });

  it('shows the yearly rate as a monthly equivalent so columns compare', async () => {
    const user = userEvent.setup();
    render(
      <PricingTable
        catalog={catalog([entry('starter', { monthlyPrice: 1_900, yearlyPrice: 19_000 })])}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Yearly' }));

    // 19000 / 12 = 1583.33 minor units.
    expect(screen.getByText('$15.83')).toBeInTheDocument();
    expect(screen.getByText('$190 billed yearly')).toBeInTheDocument();
  });

  it('derives the savings badge from the prices rather than asserting it', () => {
    render(<PricingTable catalog={catalog([entry('starter', { yearlyMonthsFree: 2 })])} />);
    expect(screen.getByText(/2 months free/)).toBeInTheDocument();
  });
});

describe('PricingTable — billing mode', () => {
  it('marks the current plan and offers no way to buy it again', () => {
    render(
      <PricingTable
        catalog={catalog([entry('free'), entry('starter')])}
        currentPlan="free"
        onChoose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Current plan' })).toBeDisabled();
  });

  it('offers an upgrade for a more expensive plan', async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();

    render(
      <PricingTable
        catalog={catalog([entry('free'), entry('starter')])}
        currentPlan="free"
        onChoose={onChoose}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Upgrade to Professional/ }));
    expect(onChoose).toHaveBeenCalledWith('starter', 'month');
  });

  it('passes the selected interval through to the handler', async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();

    render(
      <PricingTable
        catalog={catalog([entry('free'), entry('starter')])}
        currentPlan="free"
        onChoose={onChoose}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Yearly' }));
    await user.click(screen.getByRole('button', { name: /Upgrade to Professional/ }));

    expect(onChoose).toHaveBeenCalledWith('starter', 'year');
  });

  it('offers a plan change rather than an upgrade for a cheaper plan', async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();

    render(
      <PricingTable
        catalog={catalog([entry('free'), entry('starter'), entry('agency')])}
        currentPlan="agency"
        onChoose={onChoose}
      />,
    );

    // A downgrade is a change to an existing subscription, which the portal
    // owns — the wording must not promise an immediate switch.
    const buttons = screen.getAllByRole('button', { name: 'Change plan' });
    expect(buttons.length).toBeGreaterThan(0);

    await user.click(buttons[0]!);
    expect(onChoose).toHaveBeenCalled();
  });

  it('disables every action for someone who may not manage billing', () => {
    render(
      <PricingTable
        catalog={catalog([entry('free'), entry('starter')])}
        currentPlan="free"
        onChoose={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole('button', { name: /Upgrade to Professional/ })).toBeDisabled();
  });

  it('disables actions when no payment provider is configured', () => {
    render(
      <PricingTable
        catalog={catalog([entry('free'), entry('starter')], false)}
        currentPlan="free"
        onChoose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Upgrade to Professional/ })).toBeDisabled();
    expect(screen.getByText(/Checkout is not available on this deployment/)).toBeInTheDocument();
  });

  it('offers contact rather than a dead button for a plan with no configured price', () => {
    render(
      <PricingTable
        catalog={catalog([entry('free'), entry('pro', { purchasable: false })])}
        currentPlan="free"
        onChoose={vi.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: 'Contact us' })).toBeInTheDocument();
  });
});

describe('PricingTable — honesty about what exists', () => {
  it('separates features that are built from features that are not', () => {
    render(
      <PricingTable
        catalog={catalog([
          entry('starter', {
            features: ['ssl_monitoring'],
            upcomingFeatures: ['api_access'],
          }),
        ])}
      />,
    );

    expect(screen.getByText('SSL certificate monitoring')).toBeInTheDocument();
    // Present, so the tier is described fully — but under a heading that does
    // not claim it is available.
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByText('API access')).toBeInTheDocument();
  });

  it('lists only what a tier adds over the one below it', () => {
    render(
      <PricingTable
        catalog={catalog([
          entry('free', { features: ['ssl_monitoring'] }),
          entry('starter', { features: ['ssl_monitoring', 'reports'] }),
        ])}
      />,
    );

    expect(screen.getByText('Everything in Free, plus')).toBeInTheDocument();
    // `ssl_monitoring` is inherited, so it appears once — on the Free card.
    expect(screen.getAllByText('SSL certificate monitoring')).toHaveLength(1);
  });
});

describe('PricingTable — accessibility', () => {
  it('exposes the interval choice as a labelled radio group', () => {
    render(<PricingTable catalog={catalog([entry('free')])} />);

    const group = screen.getByRole('radiogroup', { name: 'Billing interval' });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Monthly' })).toHaveAttribute('aria-checked', 'true');
  });

  it('moves the checked state when the interval changes', async () => {
    const user = userEvent.setup();
    render(<PricingTable catalog={catalog([entry('free')])} />);

    await user.click(screen.getByRole('radio', { name: 'Yearly' }));

    expect(screen.getByRole('radio', { name: 'Yearly' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Monthly' })).toHaveAttribute('aria-checked', 'false');
  });
});

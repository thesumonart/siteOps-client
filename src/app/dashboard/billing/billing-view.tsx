'use client';

import type { BillingInterval, Plan, PurchasablePlan, SubscriptionDto } from '@/contracts';
import {
  BILLING_INTERVAL_LABELS,
  PLAN_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  isEntitledStatus,
  isPurchasablePlan,
} from '@/contracts';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { PricingTable } from '@/components/billing/pricing-table';
import { ErrorState, LoadingState } from '@/components/data-states';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEntitlements } from '@/hooks/use-entitlements';
import { usePlanCatalog, useSubscription } from '@/hooks/use-billing';
import { ApiError } from '@/lib/api-client';
import { openBillingPortal, startCheckout } from '@/lib/billing';
import { UsagePanel } from './usage-panel';

export interface BillingViewProps {
  readonly organizationId: string;
  readonly organizationName: string;
  /** False for a role that may read billing but not change it. */
  readonly canManage: boolean;
}

/**
 * Billing and subscription.
 *
 * Three reads, each answering a different question: the subscription (what this
 * organization pays and until when), entitlements (what it is using against
 * what it is allowed) and the catalogue (what else it could be on). All three
 * are server-computed; nothing on this screen is derived in the browser.
 *
 * There is no cancel button, no downgrade form and no card field. Every one of
 * those lives in the provider's hosted portal, which handles proration, tax and
 * dunning correctly — reimplementing them here would put mistakes on someone's
 * card.
 */
export function BillingView({
  organizationId,
  organizationName,
  canManage,
}: BillingViewProps): React.ReactElement {
  const searchParams = useSearchParams();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyPlan, setBusyPlan] = useState<Plan | null>(null);

  const checkoutOutcome = searchParams.get('checkout');

  /*
   * `?checkout=success` is a redirect target, never evidence of payment: the
   * plan is granted by a signed webhook, which may land a moment after the
   * browser does. So the banner says what actually happened — the checkout
   * completed — and the subscription query polls briefly for the webhook.
   */
  const subscription = useSubscription(organizationId, {
    awaitingActivation: checkoutOutcome === 'success',
  });
  const entitlements = useEntitlements(organizationId);
  const catalog = usePlanCatalog();

  const redirectToProvider = useMutation({
    mutationFn: async (
      input: { readonly plan: PurchasablePlan; readonly interval: BillingInterval } | null,
    ) =>
      input === null
        ? openBillingPortal(organizationId)
        : startCheckout(organizationId, { plan: input.plan, interval: input.interval }),
    onMutate: (input) => {
      setActionError(null);
      setBusyPlan(input?.plan ?? null);
    },
    onSuccess: ({ url }) => {
      // A full navigation, not a router push: the destination is the provider's
      // own domain and Next's client router cannot own it.
      window.location.assign(url);
    },
    onError: (error: unknown) => {
      setBusyPlan(null);
      setActionError(messageFor(error));
    },
  });

  if (subscription.isPending || entitlements.isPending || catalog.isPending) {
    return <LoadingState label="Loading your subscription…" />;
  }

  if (subscription.isError || entitlements.isError || catalog.isError) {
    return (
      <ErrorState
        title="Could not load billing"
        description="Your subscription and usage could not be read just now."
        onRetry={() => {
          void subscription.refetch();
          void entitlements.refetch();
          void catalog.refetch();
        }}
      />
    );
  }

  const current = subscription.data;

  return (
    <div className="space-y-8">
      {checkoutOutcome === 'success' && (
        <Alert variant="success" title="Checkout complete">
          Your payment went through. The plan below updates as soon as the provider confirms it —
          usually within a few seconds.
        </Alert>
      )}
      {checkoutOutcome === 'cancelled' && (
        <Alert title="Checkout cancelled">Nothing was charged and your plan is unchanged.</Alert>
      )}
      {actionError && (
        <Alert variant="error" title="That did not work">
          {actionError}
        </Alert>
      )}
      {!current.billingConfigured && (
        <Alert title="Billing is not configured on this deployment">
          Plans and limits below are the ones this installation enforces, but no payment provider is
          connected, so checkout is unavailable.
        </Alert>
      )}

      <SubscriptionSummary
        subscription={current}
        organizationName={organizationName}
        canManage={canManage}
        onManage={() => {
          redirectToProvider.mutate(null);
        }}
        managing={redirectToProvider.isPending && busyPlan === null}
      />

      <section aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="sr-only">
          Usage and limits
        </h2>
        <UsagePanel entitlements={entitlements.data} />
      </section>

      <section aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="text-lg font-semibold tracking-tight">
          Plans
        </h2>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">
          {canManage
            ? 'Upgrading takes effect immediately. Changing to a smaller plan and cancelling are both handled in the billing portal.'
            : 'Only an organization owner can change the plan.'}
        </p>

        <PricingTable
          className="mt-6"
          catalog={catalog.data}
          currentPlan={current.plan}
          busyPlan={busyPlan}
          disabled={!canManage || redirectToProvider.isPending}
          onChoose={(plan, interval) => {
            /*
             * Anything that changes an *existing* subscription goes to the
             * portal, not to checkout. Checkout creates a new subscription;
             * changing one — with the proration and the effective date that
             * implies, and the intent to end at the period boundary rather than
             * immediately — is what the portal is for. Returning to the free
             * plan is a cancellation, so it goes there too.
             */
            if (current.canManage || !isPurchasablePlan(plan)) {
              redirectToProvider.mutate(null);
              return;
            }
            redirectToProvider.mutate({ plan, interval });
          }}
        />
      </section>
    </div>
  );
}

interface SubscriptionSummaryProps {
  readonly subscription: SubscriptionDto;
  readonly organizationName: string;
  readonly canManage: boolean;
  readonly onManage: () => void;
  readonly managing: boolean;
}

function SubscriptionSummary({
  subscription,
  organizationName,
  canManage,
  onManage,
  managing,
}: SubscriptionSummaryProps): React.ReactElement {
  const paid = subscription.status !== 'none';
  const trialing = subscription.status === 'trialing' && subscription.trialEndsAt !== null;

  return (
    <section aria-labelledby="current-plan-heading" className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="current-plan-heading" className="text-sm font-medium text-muted-foreground">
            Current plan for {organizationName}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-2xl font-semibold tracking-tight">
              {PLAN_LABELS[subscription.plan]}
            </span>
            {paid && (
              <Badge variant={isEntitledStatus(subscription.status) ? 'secondary' : 'destructive'}>
                {SUBSCRIPTION_STATUS_LABELS[subscription.status]}
              </Badge>
            )}
            {subscription.cancelAtPeriodEnd && <Badge variant="destructive">Cancelling</Badge>}
          </p>

          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {subscription.interval && (
              <div>
                <dt className="text-muted-foreground">Billed</dt>
                <dd className="mt-0.5 font-medium">
                  {BILLING_INTERVAL_LABELS[subscription.interval]}
                </dd>
              </div>
            )}
            {subscription.currentPeriodEnd && (
              <div>
                <dt className="text-muted-foreground">
                  {subscription.cancelAtPeriodEnd ? 'Access until' : 'Renews'}
                </dt>
                <dd className="mt-0.5 font-medium">
                  {format(new Date(subscription.currentPeriodEnd), 'd MMMM yyyy')}
                </dd>
              </div>
            )}
            {trialing && subscription.trialEndsAt && (
              <div>
                <dt className="text-muted-foreground">Trial ends</dt>
                <dd className="mt-0.5 font-medium">
                  {format(new Date(subscription.trialEndsAt), 'd MMMM yyyy')}
                </dd>
              </div>
            )}
            {!paid && (
              <div>
                <dt className="text-muted-foreground">Cost</dt>
                <dd className="mt-0.5 font-medium">Free forever</dd>
              </div>
            )}
          </dl>
        </div>

        {/* The portal only exists once there is a customer to open it against,
            so before the first purchase the only action is choosing a plan. */}
        {subscription.canManage && canManage && (
          <Button variant="outline" onClick={onManage} disabled={managing}>
            {managing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ExternalLink className="size-4" aria-hidden="true" />
            )}
            Manage subscription
          </Button>
        )}
      </div>

      {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
        <p className="mt-4 text-sm text-muted-foreground">
          This subscription ends on {format(new Date(subscription.currentPeriodEnd), 'd MMMM yyyy')}{' '}
          and the organization returns to the Free plan. Your websites, history and incidents are
          kept — only the limits change.
        </p>
      )}
    </section>
  );
}

/**
 * A failure the user can act on.
 *
 * Branches on the machine-readable code rather than the message, because the
 * cases here need different next steps and the server's prose is written for
 * whoever caused the error. Anything unrecognised falls through to the API's
 * own message, which is still safe to show — it is the envelope's message
 * field, never an internal detail.
 */
function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';

  if (error.code === 'BILLING_NOT_CONFIGURED') {
    return 'This deployment has no payment provider connected, so checkout is unavailable.';
  }
  if (error.code === 'BILLING_PLAN_NOT_PURCHASABLE') {
    return 'That plan is not available for purchase here. Get in touch and we will sort it out.';
  }
  if (error.code === 'BILLING_NO_CUSTOMER') {
    return 'There is no billing account for this organization yet. Choose a plan to get started.';
  }
  if (error.code === 'FORBIDDEN' || error.code === 'INSUFFICIENT_ROLE') {
    return 'Only an organization owner can change the plan.';
  }
  return error.message;
}

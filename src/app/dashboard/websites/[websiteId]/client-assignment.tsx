'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useEntitlements } from '@/hooks/use-entitlements';
import { ApiError } from '@/lib/api-client';
import { fetchClients } from '@/lib/clients';
import { queryKeys } from '@/lib/query-keys';
import { updateWebsite } from '@/lib/websites';

export interface ClientAssignmentProps {
  readonly organizationId: string;
  readonly websiteId: string;
  readonly clientId: string | null;
  readonly canAssign: boolean;
}

/**
 * Which client this website belongs to.
 *
 * Renders nothing at all when the plan has no client management. There is no
 * upsell here on purpose: this panel sits among a website's monitoring
 * settings, and a locked card in that column would be noise on every website
 * page for an account that will never use the feature. The clients page itself
 * explains what the feature is and which plan has it.
 */
export function ClientAssignment({
  organizationId,
  websiteId,
  clientId,
  canAssign,
}: ClientAssignmentProps): React.ReactElement | null {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [selected, setSelected] = useState(clientId ?? '');

  const entitlements = useEntitlements(organizationId);
  const allowed = entitlements.data?.features.includes('clients') ?? false;

  const clients = useQuery({
    queryKey: queryKeys.clients(organizationId, { status: 'active' }),
    queryFn: () => fetchClients({ status: 'active' }),
    enabled: allowed && canAssign,
  });

  const assign = useMutation({
    // An empty selection means "no client", which the API models as an explicit
    // null rather than an omitted field.
    mutationFn: (value: string) =>
      updateWebsite(websiteId, { clientId: value === '' ? null : value }),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.website(organizationId, websiteId),
      });
    },
    onError: (error: Error) => {
      setActionError(error instanceof ApiError ? error.message : 'Something went wrong.');
    },
  });

  if (!allowed || !canAssign) return null;

  const unchanged = selected === (clientId ?? '');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client</CardTitle>
        <p className="text-sm text-pretty text-muted-foreground">
          Assigning this website to a client makes it visible to that client&rsquo;s portal
          contacts, and to nobody else&rsquo;s.
        </p>
      </CardHeader>

      <CardContent className="grid gap-3">
        {actionError ? <Alert variant="error">{actionError}</Alert> : null}

        <div className="grid gap-1.5 sm:max-w-sm">
          <Label htmlFor="website-client">Assigned to</Label>
          <select
            id="website-client"
            value={selected}
            disabled={clients.isPending || assign.isPending}
            onChange={(event) => {
              setSelected(event.target.value);
            }}
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
          >
            <option value="">No client</option>
            {(clients.data ?? []).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Button
            size="sm"
            disabled={unchanged || assign.isPending}
            onClick={() => {
              assign.mutate(selected);
            }}
          >
            {assign.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

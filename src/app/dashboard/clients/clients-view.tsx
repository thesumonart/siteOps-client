'use client';

import {
  CLIENT_STATUS_LABELS,
  PLAN_LABELS,
  cheapestPlanWith,
  type ClientDto,
  type Permission,
} from '@/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, Users } from 'lucide-react';
import { useState } from 'react';

import { EmptyState, ErrorState, FeatureLockedState, SkeletonRows } from '@/components/data-states';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEntitlements } from '@/hooks/use-entitlements';
import { ApiError } from '@/lib/api-client';
import { createClient, fetchClients, updateClient } from '@/lib/clients';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { ClientDetailDialog } from './client-detail-dialog';

export interface ClientsViewProps {
  readonly organizationId: string;
  readonly permissions: readonly Permission[];
}

/**
 * The agency's clients.
 *
 * Archived clients are shown alongside active ones rather than hidden, because
 * an agency that archived a client last year still wants to find their reports.
 * Archiving is the reversible act; deleting is separate and explicit.
 */
export function ClientsView({ organizationId, permissions }: ClientsViewProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<ClientDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = permissions.includes('client:manage');

  const entitlements = useEntitlements(organizationId);
  const allowed = entitlements.data?.features.includes('clients') ?? false;

  const clients = useQuery({
    queryKey: queryKeys.clients(organizationId, { search: applied }),
    queryFn: () => fetchClients(applied ? { search: applied } : {}),
    enabled: allowed,
  });

  const invalidate = async (): Promise<void> => {
    setActionError(null);
    await queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'clients'] });
  };

  const onError = (error: Error): void => {
    setActionError(error instanceof ApiError ? error.message : 'Something went wrong.');
  };

  const create = useMutation({
    mutationFn: (name: string) => createClient({ name }),
    onSuccess: async () => {
      setCreating(false);
      await invalidate();
    },
    onError,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'archived' }) =>
      updateClient(id, { status }),
    onSuccess: invalidate,
    onError,
  });

  if (entitlements.isPending) return <SkeletonRows label="Loading clients…" rows={4} />;

  if (!allowed) {
    const required = cheapestPlanWith('clients');
    return (
      <FeatureLockedState
        feature="Client management"
        requiredPlan={required ? PLAN_LABELS[required] : 'a paid plan'}
      />
    );
  }

  return (
    <div className="grid gap-4">
      {actionError ? <Alert variant="error">{actionError}</Alert> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied(search.trim());
          }}
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              placeholder="Search clients"
              aria-label="Search clients"
              className="w-56 pl-8"
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>

        {canManage ? (
          <Button
            size="sm"
            onClick={() => {
              setCreating(true);
            }}
          >
            Add client
          </Button>
        ) : null}
      </div>

      {clients.isPending ? (
        <SkeletonRows label="Loading clients…" rows={4} />
      ) : clients.isError ? (
        <ErrorState
          title="Could not load clients"
          onRetry={() => {
            void clients.refetch();
          }}
        />
      ) : (clients.data ?? []).length === 0 ? (
        <EmptyState
          title={applied ? 'No clients match that search' : 'No clients yet'}
          description={
            applied
              ? 'Try a different name, or clear the search.'
              : 'Group websites by client, then invite the client’s own contacts to a read-only portal showing only their sites.'
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(clients.data ?? []).map((entry) => (
            <li key={entry.id}>
              <Card className={cn(entry.status === 'archived' && 'opacity-70')}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate">{entry.name}</span>
                    {entry.status === 'archived' ? (
                      <span className="shrink-0 text-xs font-normal text-muted-foreground">
                        {CLIENT_STATUS_LABELS.archived}
                      </span>
                    ) : null}
                  </CardTitle>
                  {entry.companyName ? (
                    <p className="truncate text-sm text-muted-foreground">{entry.companyName}</p>
                  ) : null}
                </CardHeader>

                <CardContent className="grid gap-3">
                  <p className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {entry.websiteCount} {entry.websiteCount === 1 ? 'website' : 'websites'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="size-3" aria-hidden="true" />
                      {entry.contactCount}
                    </span>
                  </p>

                  {canManage ? (
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelected(entry);
                        }}
                      >
                        Manage
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={setStatus.isPending}
                        onClick={() => {
                          setStatus.mutate({
                            id: entry.id,
                            status: entry.status === 'archived' ? 'active' : 'archived',
                          });
                        }}
                      >
                        {entry.status === 'archived' ? 'Restore' : 'Archive'}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <AddClientDialog
          saving={create.isPending}
          onCancel={() => {
            setCreating(false);
          }}
          onSave={(name) => {
            create.mutate(name);
          }}
        />
      ) : null}

      {selected ? (
        <ClientDetailDialog
          organizationId={organizationId}
          client={selected}
          onClose={() => {
            setSelected(null);
          }}
        />
      ) : null}
    </div>
  );
}

function AddClientDialog({
  saving,
  onCancel,
  onSave,
}: {
  readonly saving: boolean;
  readonly onCancel: () => void;
  readonly onSave: (name: string) => void;
}): React.ReactElement {
  const [name, setName] = useState('');

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave(name.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a client</DialogTitle>
            <DialogDescription>
              Websites are assigned to a client from the website’s own page.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5 py-4">
            <Label htmlFor="client-name">Name</Label>
            <Input
              id="client-name"
              value={name}
              required
              maxLength={120}
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || name.trim().length === 0}>
              {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

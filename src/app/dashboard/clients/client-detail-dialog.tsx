'use client';

import { PLAN_LABELS, cheapestPlanWith, type ClientDto } from '@/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { EmptyState, ErrorState, SkeletonRows } from '@/components/data-states';
import { RelativeTime } from '@/components/relative-time';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import {
  deleteClient,
  fetchClientContacts,
  inviteClientContact,
  revokeClientContact,
  updateClient,
} from '@/lib/clients';
import { queryKeys } from '@/lib/query-keys';

export interface ClientDetailDialogProps {
  readonly organizationId: string;
  readonly client: ClientDto;
  readonly onClose: () => void;
}

/**
 * Editing a client and managing who may see their portal.
 *
 * The notes field is labelled as internal, because it is: the portal never
 * renders it, and somebody writing "chasing unpaid invoice" needs to be certain
 * of that before they type it.
 */
export function ClientDetailDialog({
  organizationId,
  client,
  onClose,
}: ClientDetailDialogProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const [details, setDetails] = useState({
    name: client.name,
    companyName: client.companyName ?? '',
    contactName: client.contactName ?? '',
    contactEmail: client.contactEmail ?? '',
    notes: client.notes ?? '',
  });

  const entitlements = useEntitlements(organizationId);
  const portalAllowed = entitlements.data?.features.includes('client_portal') ?? false;

  const contacts = useQuery({
    queryKey: queryKeys.clientContacts(organizationId, client.id),
    queryFn: () => fetchClientContacts(client.id),
    enabled: portalAllowed,
  });

  const invalidate = async (): Promise<void> => {
    setActionError(null);
    await queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'clients'] });
  };

  const onError = (error: Error): void => {
    setActionError(error instanceof ApiError ? error.message : 'Something went wrong.');
  };

  const save = useMutation({
    mutationFn: () =>
      updateClient(client.id, {
        name: details.name,
        // Empty means "cleared", which the API models as null. Sending an empty
        // string would store one and render as a blank line in the portal.
        companyName: details.companyName.trim() || null,
        contactName: details.contactName.trim() || null,
        contactEmail: details.contactEmail.trim() || null,
        notes: details.notes.trim() || null,
      }),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
    onError,
  });

  const invite = useMutation({
    mutationFn: (email: string) => inviteClientContact(client.id, { email }),
    onSuccess: async () => {
      setInviteEmail('');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.clientContacts(organizationId, client.id),
      });
      await invalidate();
    },
    onError,
  });

  const revoke = useMutation({
    mutationFn: (contactId: string) => revokeClientContact(client.id, contactId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.clientContacts(organizationId, client.id),
      });
      await invalidate();
    },
    onError,
  });

  const remove = useMutation({
    mutationFn: () => deleteClient(client.id),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
    onError,
  });

  const requiredPlan = cheapestPlanWith('client_portal');

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client.name}</DialogTitle>
          <DialogDescription>
            Details the agency keeps, and who from this client may see their websites.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {actionError ? <Alert variant="error">{actionError}</Alert> : null}

          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="client-edit-name">Name</Label>
              <Input
                id="client-edit-name"
                value={details.name}
                required
                maxLength={120}
                onChange={(event) => {
                  setDetails((current) => ({ ...current, name: event.target.value }));
                }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="client-company">Company</Label>
                <Input
                  id="client-company"
                  value={details.companyName}
                  maxLength={120}
                  onChange={(event) => {
                    setDetails((current) => ({ ...current, companyName: event.target.value }));
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="client-contact-name">Main contact</Label>
                <Input
                  id="client-contact-name"
                  value={details.contactName}
                  maxLength={120}
                  onChange={(event) => {
                    setDetails((current) => ({ ...current, contactName: event.target.value }));
                  }}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="client-contact-email">Contact email</Label>
              <Input
                id="client-contact-email"
                type="email"
                value={details.contactEmail}
                maxLength={254}
                onChange={(event) => {
                  setDetails((current) => ({ ...current, contactEmail: event.target.value }));
                }}
              />
              <p className="text-xs text-muted-foreground">
                For the agency’s reference. Inviting someone to the portal is separate, below.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="client-notes">Internal notes</Label>
              <textarea
                id="client-notes"
                value={details.notes}
                maxLength={2000}
                rows={3}
                onChange={(event) => {
                  setDetails((current) => ({ ...current, notes: event.target.value }));
                }}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <p className="text-xs text-muted-foreground">Never shown in the client portal.</p>
            </div>

            <div>
              <Button type="submit" size="sm" disabled={save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                Save details
              </Button>
            </div>
          </form>

          <section className="grid gap-2 border-t pt-4">
            <h3 className="text-sm font-medium">Portal access</h3>

            {!portalAllowed ? (
              <p className="text-sm text-pretty text-muted-foreground">
                Inviting a client’s own contacts to a read-only portal is included from{' '}
                {requiredPlan ? PLAN_LABELS[requiredPlan] : 'a paid plan'}.
              </p>
            ) : (
              <>
                <p className="text-xs text-pretty text-muted-foreground">
                  A contact sees only this client’s websites and incidents. They cannot see your
                  other clients, your team, or anything they can change.
                </p>

                {contacts.isPending ? (
                  <SkeletonRows label="Loading contacts…" rows={2} />
                ) : contacts.isError ? (
                  <ErrorState
                    title="Could not load contacts"
                    onRetry={() => {
                      void contacts.refetch();
                    }}
                  />
                ) : (contacts.data ?? []).length === 0 ? (
                  <EmptyState
                    title="Nobody has access yet"
                    description="Invite a contact and they will receive a link to set up their own account."
                  />
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {(contacts.data ?? []).map((contact) => (
                      <li
                        key={contact.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm">{contact.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {contact.status === 'invited' ? (
                              <>
                                Invited <RelativeTime iso={contact.joinedAt} />
                              </>
                            ) : (
                              <>
                                Joined <RelativeTime iso={contact.joinedAt} />
                              </>
                            )}
                          </p>
                        </div>
                        {contact.status === 'active' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Revoke access for ${contact.email}`}
                            disabled={revoke.isPending}
                            onClick={() => {
                              revoke.mutate(contact.id);
                            }}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    invite.mutate(inviteEmail.trim());
                  }}
                >
                  <Input
                    type="email"
                    required
                    value={inviteEmail}
                    placeholder="contact@client.com"
                    aria-label="Contact email"
                    onChange={(event) => {
                      setInviteEmail(event.target.value);
                    }}
                  />
                  <Button type="submit" size="sm" disabled={invite.isPending}>
                    {invite.isPending ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : null}
                    Invite
                  </Button>
                </form>
              </>
            )}
          </section>

          <section className="grid gap-2 border-t pt-4">
            <h3 className="text-sm font-medium text-status-down">Delete this client</h3>
            <p className="text-xs text-pretty text-muted-foreground">
              Portal access is revoked and the client record is removed. Their websites keep running
              and keep their history — they simply stop being assigned to anyone.
            </p>

            {confirmDelete ? (
              <div className="grid gap-2">
                <Label htmlFor="client-delete-confirm">
                  Type <span className="font-mono">{client.name}</span> to confirm
                </Label>
                <Input
                  id="client-delete-confirm"
                  value={deleteConfirmation}
                  onChange={(event) => {
                    setDeleteConfirmation(event.target.value);
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={remove.isPending || deleteConfirmation !== client.name}
                    onClick={() => {
                      remove.mutate();
                    }}
                  >
                    {remove.isPending ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : null}
                    Delete permanently
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setConfirmDelete(false);
                      setDeleteConfirmation('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConfirmDelete(true);
                  }}
                >
                  Delete client
                </Button>
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

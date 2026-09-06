import type {
  ClientContactDto,
  ClientDto,
  CreateClientInput,
  InviteClientContactInput,
  ListClientsQuery,
  UpdateClientInput,
} from '@/contracts';

import { apiRequest } from './api-client';

/**
 * Agency clients and their portal access.
 *
 * None of these calls exist for a client contact: the capability is absent from
 * their role, so the API refuses every one. That is deliberate — a client must
 * not be able to enumerate the agency's other customers.
 */

export async function fetchClients(
  query: Partial<ListClientsQuery> = {},
): Promise<readonly ClientDto[]> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.search) params.set('search', query.search);

  const suffix = params.size > 0 ? `?${params.toString()}` : '';
  const result = await apiRequest<{ items: readonly ClientDto[] }>(`/api/clients${suffix}`);
  return result.items;
}

export async function createClient(input: CreateClientInput): Promise<ClientDto> {
  return apiRequest<ClientDto>('/api/clients', { method: 'POST', body: input });
}

export async function updateClient(clientId: string, input: UpdateClientInput): Promise<ClientDto> {
  return apiRequest<ClientDto>(`/api/clients/${clientId}`, { method: 'PATCH', body: input });
}

export async function deleteClient(clientId: string): Promise<void> {
  await apiRequest(`/api/clients/${clientId}`, { method: 'DELETE' });
}

export async function fetchClientContacts(clientId: string): Promise<readonly ClientContactDto[]> {
  const result = await apiRequest<{ items: readonly ClientContactDto[] }>(
    `/api/clients/${clientId}/contacts`,
  );
  return result.items;
}

export async function inviteClientContact(
  clientId: string,
  input: InviteClientContactInput,
): Promise<ClientContactDto> {
  return apiRequest<ClientContactDto>(`/api/clients/${clientId}/contacts`, {
    method: 'POST',
    body: input,
  });
}

export async function revokeClientContact(clientId: string, contactId: string): Promise<void> {
  await apiRequest(`/api/clients/${clientId}/contacts/${contactId}`, { method: 'DELETE' });
}

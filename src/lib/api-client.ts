import type { ApiErrorCode, ApiFieldError, ApiResponse } from '@/contracts';

import { readActiveOrganizationCookie } from './active-organization';
import { apiBaseUrl } from './api-base';

/**
 * The single way this app talks to the API.
 *
 * Every response uses the documented envelope, so unwrapping and error shaping
 * happen once here rather than in each caller. Failures become a typed
 * {@link ApiError} that carries the machine-readable code, which is what UI
 * code branches on — never the message text.
 */

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields: readonly ApiFieldError[];

  constructor(
    code: ApiErrorCode,
    message: string,
    status: number,
    fields: readonly ApiFieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }

  /** Maps server-side field errors onto react-hook-form field names. */
  get fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const field of this.fields) {
      result[field.field] ??= field.message;
    }
    return result;
  }
}

export interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly body?: unknown;
  readonly signal?: AbortSignal;
  /** Forwarded cookies, for calls made from a server component. */
  readonly headers?: Record<string, string>;
}

const NETWORK_ERROR_MESSAGE = 'Could not reach the server. Check your connection and try again.';

export async function apiRequest<TData>(
  path: string,
  options: RequestOptions = {},
): Promise<TData> {
  const { method = 'GET', body, signal, headers = {} } = options;

  const requestHeaders: Record<string, string> = { ...headers };

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  /*
   * Names the organization the UI is currently showing. The API treats it as a
   * hint and re-resolves membership from the session, so this cannot be used to
   * reach another tenant. An explicit caller-supplied value always wins.
   */
  const activeOrganizationId = readActiveOrganizationCookie();
  if (activeOrganizationId !== null && requestHeaders['X-Organization-Id'] === undefined) {
    requestHeaders['X-Organization-Id'] = activeOrganizationId;
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      // The session lives in an HttpOnly cookie, never readable from
      // JavaScript. Browser requests are same-origin through the `/api/*`
      // rewrite, so this is already the default — it is stated because the
      // whole session depends on the cookie travelling, and a silent default
      // is a poor place for that to rest.
      credentials: 'include',
      headers: requestHeaders,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
      cache: 'no-store',
    });
  } catch (error) {
    // An aborted request is a caller decision, not a failure to report.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('SERVICE_UNAVAILABLE', NETWORK_ERROR_MESSAGE, 0);
  }

  if (response.status === 204) {
    return undefined as TData;
  }

  let payload: ApiResponse<TData>;
  try {
    payload = (await response.json()) as ApiResponse<TData>;
  } catch {
    throw new ApiError(
      response.ok ? 'INTERNAL_ERROR' : 'SERVICE_UNAVAILABLE',
      'The server returned an unexpected response.',
      response.status,
    );
  }

  if (!payload.success) {
    throw new ApiError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.error.fields ?? [],
    );
  }

  return payload.data;
}

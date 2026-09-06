/**
 * The SiteOps API contract.
 *
 * SiteOps is two projects — this backend and the `siteOps-client` dashboard —
 * that meet only over HTTP. Everything in this directory describes what crosses
 * that boundary: the response envelope, the DTOs the API returns, the Zod
 * schemas both sides validate a request body with, and the domain vocabulary
 * (roles, plans, statuses) the two have to agree on to mean the same thing.
 *
 * **This directory is the source of truth.** `siteOps-client/src/contracts` is
 * a copy of it. Change it here first, then port the change there, and let the
 * tests that live alongside each module say whether the port was faithful.
 *
 * The copy is safe only because every module here is platform-neutral — no Node
 * built-ins, no database types, nothing but TypeScript and Zod. Anything that
 * cannot survive in a browser does not belong in this directory; put it in
 * `src/utils`, `src/email` or the layer that needs it.
 */

export * from './api/dto';
export * from './api/errors';
export * from './api/pagination';

export * from './domain/audit';
export * from './domain/check';
export * from './domain/incident';
export * from './domain/monitor';
export * from './domain/notification';
export * from './domain/permissions';
export * from './domain/plan';
export * from './domain/report';
export * from './domain/roles';
export * from './domain/website';

export * from './schemas/audit';
export * from './schemas/auth';
export * from './schemas/common';
export * from './schemas/monitor';
export * from './schemas/monitoring';
export * from './schemas/notification';
export * from './schemas/organization';
export * from './schemas/report';
export * from './schemas/website';

export * from './url/ip';
export * from './url/normalize';

export * from './uptime';

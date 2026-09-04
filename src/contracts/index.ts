/**
 * The API contract this app is written against.
 *
 * SiteOps is two projects — this frontend and siteOps-server — that meet only
 * over HTTP. Everything here describes what crosses that boundary: the response
 * envelope, the DTOs the API returns, the Zod schemas both sides validate a
 * request body with, and the domain vocabulary (roles, plans, statuses) the two
 * have to agree on to mean the same thing.
 *
 * It mirrors `packages/shared` in siteOps-server, which is the source of truth.
 * That package is deliberately platform-neutral — no Node built-ins, no
 * database types, nothing but TypeScript and Zod — which is what makes it safe
 * to carry a copy here rather than reaching across a filesystem boundary the
 * two deployments do not share. Server-only parts of it, the outgoing-email
 * templates, are not copied.
 *
 * Keeping a copy is a deliberate trade. The alternative is publishing the
 * package to a registry and depending on a version from both sides, which is
 * the right move once the contract changes often enough that drift becomes
 * likely. Until then: change it in siteOps-server first, then port the change
 * here, and let the tests in this directory — they came across with the code —
 * say whether the port was faithful.
 */

export * from './api/dto';
export * from './api/errors';
export * from './api/pagination';

export * from './domain/audit';
export * from './domain/check';
export * from './domain/incident';
export * from './domain/notification';
export * from './domain/permissions';
export * from './domain/plan';
export * from './domain/roles';
export * from './domain/website';

export * from './schemas/auth';
export * from './schemas/common';
export * from './schemas/monitoring';
export * from './schemas/notification';
export * from './schemas/organization';
export * from './schemas/website';

export * from './url/ip';
export * from './url/normalize';

export * from './uptime';

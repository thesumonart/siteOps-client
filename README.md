# SiteOps — dashboard

**The web frontend for SiteOps.**

SiteOps continuously checks the websites an agency adds, confirms real outages before it alerts
anyone, and keeps the uptime history their clients ask about. This repository is the dashboard
people look at: sign-up and sign-in, organizations and members, adding and configuring websites,
uptime and response-time charts, and the incident history.

It holds no data of its own. Everything on the screen comes from the SiteOps API, which lives in
[siteOps-server](https://github.com/thesumonart/siteOps-server) along with the monitoring worker
and the database. This project talks to it over HTTP and knows nothing else about it.

---

## Requirements

| Tool    | Version | Notes                                 |
| ------- | ------- | ------------------------------------- |
| Node.js | 24.15.0 | Pinned in `.nvmrc`; run `nvm use`     |
| pnpm    | >= 11   | `corepack enable` or install globally |

A running SiteOps API. For local work that means checking out `siteOps-server` and following its
README; there is nothing to run here on its own, because every screen loads from the API.

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Copy the environment template
cp .env.example .env.local

# 3. Run the dev server
pnpm dev
```

Then open http://localhost:3000. `.env.local` points at http://localhost:4000 by default, which is
where `siteOps-server`'s `pnpm dev` puts the API.

## Environment variables

Every variable is browser-visible. `NEXT_PUBLIC_*` values are inlined into the JavaScript bundle at
build time and served to every visitor, so a secret placed here is a published secret. There is no
server-only configuration in this project, and there is nothing to add: the database URI, the auth
secret and the mail API key belong to `siteOps-server`.

| Variable              | Notes                                                    |
| --------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | Origin of the SiteOps API. Every request goes here.      |
| `NEXT_PUBLIC_APP_URL` | Public origin of this app, for absolute links to itself. |

Both are validated at import time in `src/lib/env.ts`; a missing or malformed value fails the build
rather than producing a bundle that cannot reach anything. A test keeps `.env.example` honest.

## Layout

```text
siteOps-client/
├── e2e/            Playwright suite — real browser, real API, real database
├── src/
│   ├── app/        App Router: routes, layouts, pages, server components
│   ├── components/ UI — shadcn/ui in components/ui, app components above it
│   ├── contracts/  The API contract: DTOs, Zod schemas, domain vocabulary
│   ├── hooks/
│   └── lib/        API client, session, env, query keys, formatting
└── src/middleware.ts   Routing-level redirect for signed-out visitors
```

### `src/contracts`

The shape of everything that crosses the HTTP boundary: the response envelope, the DTOs the API
returns, the Zod schemas both sides validate a request body with, and the domain vocabulary — roles,
plans, statuses — the two have to agree on.

It mirrors `packages/shared` in `siteOps-server`, which is the source of truth. That package is
platform-neutral by construction — Zod and TypeScript, no Node built-ins, no Mongoose types, nothing
that assumes a server — which is what makes carrying a copy safe rather than a leak of server
internals. Its tests came across with it, so a bad port fails here rather than in production.

**Change it in `siteOps-server` first, then port the change here.** Keeping a copy is a deliberate
trade against publishing the package to a registry and depending on a version from both sides; that
becomes the better deal once the contract changes often enough for drift to be likely.

## Commands

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Dev server on port 3000                       |
| `pnpm build`        | Production build                              |
| `pnpm start`        | Serves the production build                   |
| `pnpm lint`         | ESLint                                        |
| `pnpm typecheck`    | `tsc --noEmit`                                |
| `pnpm test`         | Vitest unit and component tests               |
| `pnpm test:e2e`     | Playwright end-to-end tests                   |
| `pnpm format`       | Formats with Prettier                         |
| `pnpm format:check` | Fails if anything is unformatted (used by CI) |
| `pnpm clean`        | Removes build output and test artefacts       |

## End-to-end tests

The suite drives a real browser against a real Next.js server, a real API and a real database. It
covers the seams the unit tests cannot: session cookies crossing an origin, the organization header,
tenant isolation, an SSRF refusal reaching the person who typed the URL.

It builds and starts the Next.js server itself. It does **not** start the API — that lives in
another repository and another deployment, and a frontend harness that booted it by reaching across
a filesystem would only work on a machine where both happen to be checked out side by side.

Start one against a throwaway database, from a checkout of `siteOps-server`:

```bash
pnpm --filter @siteops/api... build

NODE_ENV=test PORT=4100 \
APP_URL=http://localhost:3100 API_URL=http://localhost:4100 \
MONGODB_URI='mongodb://localhost:27017/siteops_e2e?replicaSet=rs0&directConnection=true' \
MONGODB_AUTO_INDEX=true \
AUTH_SECRET=e2e-only-auth-secret-value-not-used-anywhere-else \
LOG_LEVEL=warn AUTH_RATE_LIMIT_MAX_REQUESTS=1000 RATE_LIMIT_MAX_REQUESTS=5000 \
node apps/api/dist/main.js
```

Then, here:

```bash
pnpm exec playwright install --with-deps chromium   # first run only
pnpm test:e2e
```

`E2E_API_URL`, `E2E_MONGODB_URI` and `E2E_AUTH_SECRET` override the defaults; the secret has to
match the `AUTH_SECRET` the API was started with, because the suite mints the email-verification
token itself — there is no mail provider in a test run to deliver the link. A `siteops_e2e`
database, never the development one: the tests create and delete accounts.

If the API is not up, the suite says so and stops rather than timing out one test at a time.

In CI this runs from `.github/workflows/e2e.yml`, started by hand. It checks out `siteOps-server`,
which needs a `SERVER_REPO_TOKEN` repository secret with read access to it.

## Deployment

Vercel, with this repository as the project root. Next.js is detected by default — no monorepo
settings, no build filter, no output directory to override.

| Setting               | Value                               |
| --------------------- | ----------------------------------- |
| Install command       | `pnpm install`                      |
| Build command         | `pnpm build` (the default)          |
| `NEXT_PUBLIC_API_URL` | The deployed API's public origin    |
| `NEXT_PUBLIC_APP_URL` | This deployment's own public origin |

Two things on the API side have to agree with it: its `APP_URL` must be this app's origin — it is
the CORS allowlist, the cookie domain and the base of every link in an outgoing email — and it must
be reachable from a browser, not only from a private network. See `siteOps-server`'s
`docs/DEPLOYMENT.md`.

This app can be deployed, rolled back and scaled without touching the API or the worker, and
neither of those needs this one to be deployed at all.

## Licence

Unlicensed and private.

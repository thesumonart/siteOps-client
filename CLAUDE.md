# CLAUDE.md

Working notes for this repository. Read before changing anything.

## What this is

SiteOps is a production website-monitoring SaaS for agencies: add client websites, and it checks
uptime, HTTP status and response time on a schedule, confirms real outages, opens and resolves
incidents, and emails the people who need to know.

This repository is the **dashboard**. It renders that product and nothing more. The API, the
monitoring worker and the database are a separate project, `siteOps-server`, reached over HTTP.

It is a real product, not a demo. Nothing in it may be faked.

## Stack

| Layer     | Choice                                                        |
| --------- | ------------------------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19                             |
| Styling   | Tailwind v4, shadcn/ui (new-york), tokens in `globals.css`    |
| Data      | TanStack Query over one hand-written API client               |
| Forms     | React Hook Form + Zod resolvers, schemas from `@/contracts`   |
| Tooling   | pnpm, TypeScript 5.9, ESLint 10, Prettier, Vitest, Playwright |

Version choices that are deliberate and must not be "upgraded" casually:

- **TypeScript 5.9, not 7.** `typescript-eslint@8` peers on `typescript <6.1.0`; TS 7 silently
  disables every type-aware lint rule.
- **No Better Auth browser client.** The API wraps every response — including the auth routes — in
  the SiteOps envelope, so one client and one error type cover the whole app. The session lives in
  an HttpOnly cookie the browser manages; nothing here touches a token.
- **One API client.** Everything goes through `apiRequest` in `src/lib/api-client.ts`. A second
  fetch path means a second place to get the credentials, the organization header or the error
  envelope wrong.

## Layout

```text
e2e/                Playwright suite (real browser, real API, real database)
src/app/            App Router: routes, layouts, pages, server components
src/components/     UI — shadcn/ui in components/ui, app components above it
src/contracts/      The API contract, mirrored from siteOps-server
src/hooks/
src/lib/            API client, auth calls, env, query keys, formatting
src/middleware.ts   Routing-level redirect for signed-out visitors
```

## The boundary

This is the rule the repository split exists to enforce, and the one worth being pedantic about.

**The API is the only way in.** No database driver, no Mongoose, no NestJS, no `@siteops/*`
package, no relative path that climbs out of this repository. ESLint refuses all of them; do not
add an exception. If a screen needs data the API does not expose, the change belongs in
`siteOps-server`.

**`src/contracts` is a mirror, not a source.** It carries the browser-safe half of
`packages/shared` in `siteOps-server`: DTOs, request schemas, roles, plans, statuses, uptime
formatting. Change it there first, then port the change here. The tests came across with the code,
so run them after a port. Never add anything to it that could not survive in a browser — a Node
built-in, a database type, a server secret. That constraint is the whole reason a copy is safe.

**Every value here is public.** `NEXT_PUBLIC_*` is inlined into the bundle at build time. There is
no server-only configuration in this project and nothing to add: an ESLint rule blocks
`process.env` outside `src/lib/env.ts`, which validates the two values that exist.

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e     # needs an API running; see README.md
pnpm format
pnpm format:check
```

## Conventions

**No business logic in components.** Rules live behind the API. A component decides what to render,
not what is allowed — permissions come from the server as a `Permission[]` and are checked with
`permissionsFor`, never by comparing role names.

**Validation.** One Zod schema per concept, from `@/contracts`, driving the React Hook Form
resolver. The API validates the same schema on its side. Never write a second, looser version of a
rule for the form.

**Server state lives in TanStack Query.** Keys come from `src/lib/query-keys.ts`. Genuine client
state — a dialog being open, a selected tab — is local. There is no global store and adding one
needs a reason.

**Types.** Strict, including `noUncheckedIndexedAccess`. `any` is an ESLint error. If it is truly
unavoidable, document why on the line.

**UI.** shadcn/ui, tokens from `globals.css`. Status is never colour alone — use `StatusBadge`.
Every async view handles loading, empty and error.

**Errors.** Branch on `ApiError.code`, never on the message text. Field errors from the API map
onto form fields through `ApiError.fieldErrors`.

**Comments.** Explain decisions, security reasoning and non-obvious edge cases. Do not restate the
code.

## Security rules

These are not style preferences.

1. **Nothing secret in the bundle.** Every value in this project reaches the browser. If something
   must stay private, it belongs to the API.
2. **The middleware is routing, not authorization.** It checks that a session cookie is present so
   a signed-out visitor is redirected rather than watching a dashboard flash and fail. The API is
   the security boundary; never move an access decision here.
3. **Never trust an organization id from the client.** `X-Organization-Id` is a hint. The API
   re-resolves membership from the session on every request, and the active-organization cookie is
   deliberately not a credential — treat it that way here too.
4. **Check permissions, never role names.** Deny by default.
5. **Never widen a validation rule** to make a form easier. The API will reject it anyway, and the
   two drifting is how a form starts accepting input that fails on submit.

## Git

- Conventional Commits, lowercase, imperative: `feat: add website filters`.
- Commit after each meaningful, working portion. Verify first:
  `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`, plus `pnpm build` after
  structural changes.
- Push after each verified commit.

## Never do these

- Never add `Co-authored-by`, `Generated with`, or any AI/Claude/ChatGPT attribution to a commit,
  PR, or code comment. Commits carry the developer's own identity and nothing else.
- Never mention AI in a commit message.
- Never `git push --force` or rewrite remote history without being asked.
- Never change the configured Git identity.
- Never commit `.env.local` or any real secret.
- Never fake monitoring data, uptime, incidents, response times or API responses. Mock data is for
  tests and isolated UI development only.
- Never create placeholder pages or routes for features that are not implemented.
- Never leave dead code: unused imports, files, components, or commented-out implementations.
- Never disable a lint rule or a type error to make something pass. Fix the cause.
- Never commit code knowing a check fails.
- Never reach into `siteOps-server` from here, by import, relative path or build step.

## Keeping this current

Update this file when a decision changes: a new directory, a changed boundary rule, a version pin
with a reason. Setup and command detail belongs in README.md, not here.

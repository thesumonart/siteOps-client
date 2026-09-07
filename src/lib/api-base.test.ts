import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiBaseUrl } from './api-base';

/**
 * Regression coverage for the production sign-in failure.
 *
 * SiteOps shipped with the browser calling the API on its own origin —
 * `siteops-client.vercel.app` talking to `siteops-server.onrender.com`. Sign-in
 * answered 200 with a real session, and Chrome discarded the `Set-Cookie`
 * unread: the cookie is `SameSite=Lax`, and a browser will not store a `Lax`
 * cookie delivered on a cross-site response. Nobody stayed signed in, and
 * `middleware.ts` sent every visitor from `/dashboard` back to `/login`.
 *
 * Nothing about that is visible in a local run. The end-to-end suite serves the
 * app on `localhost:3100` and the API on `localhost:4100`; cookies ignore the
 * port, so those are one site and the cookie is stored exactly as intended. The
 * assertions below are what stand in for a cross-origin browser, and they only
 * hold together: a same-origin request path is useless without the rewrite that
 * gives it somewhere to go.
 *
 * `next.config.ts` is read as text rather than imported, matching
 * `env-example.test.ts`. It sits outside `src`, so the `@/` alias cannot reach
 * it and a deep relative import is a lint error by deliberate policy.
 */

/*
 * Resolved from the working directory rather than `import.meta.url`: Vitest
 * serves this module through Vite, where that value is an http URL and not a
 * path on disk. The runner's working directory is the project root.
 */
const nextConfigSource = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiBaseUrl', () => {
  it('is same-origin in the browser, so the session cookie is stored', () => {
    // jsdom provides `window`, which is what the function branches on.
    expect(apiBaseUrl()).toBe('');
  });

  it('is absolute on the server, which has no origin to be relative to', () => {
    vi.stubGlobal('window', undefined);

    const base = apiBaseUrl();

    expect(base).not.toBe('');
    expect(() => new URL(`${base}/api/session`)).not.toThrow();
  });
});

describe('next.config.ts', () => {
  it('rewrites /api/* onto the API, keeping the prefix', () => {
    expect(nextConfigSource).toMatch(/rewrites\s*\(\s*\)/);
    // The path is passed through rather than remapped: the API mounts its own
    // routes under `/api`, so dropping the prefix here would 404 every call.
    expect(nextConfigSource).toMatch(/source:\s*'\/api\/:path\*'/);
    expect(nextConfigSource).toMatch(/destination:\s*`\$\{apiOrigin\(\)\}\/api\/:path\*`/);
  });

  it('takes the upstream origin from the environment', () => {
    // The destination above interpolates `apiOrigin()`, and this is where that
    // helper is required to get its value: a literal origin would ship one
    // deployment's API URL to every other deployment.
    expect(nextConfigSource).toMatch(/process\.env\.NEXT_PUBLIC_API_URL/);
  });
});

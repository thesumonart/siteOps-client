import type { NextConfig } from 'next';

/*
 * Environment values are loaded by Next itself from this directory — `.env`,
 * `.env.local` and the mode-specific files. The monorepo version of this file
 * had to reach up to a shared root `.env`; a standalone frontend does not, and
 * the only variables it reads are the two NEXT_PUBLIC_* values validated in
 * `src/lib/env.ts`.
 */

/**
 * Where `/api/*` is forwarded to.
 *
 * Read straight from the environment rather than through `src/lib/env.ts`: this
 * file is evaluated by Next's own config loader, outside the module graph that
 * validates browser configuration, and importing that module here would run its
 * schema against a `process.env` that Next has not finished assembling.
 */
function apiOrigin(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (!value) {
    throw new Error(
      'NEXT_PUBLIC_API_URL is required: it is the origin `/api/*` is proxied to. ' +
        'Set it to the SiteOps API origin, e.g. https://siteops-server.onrender.com',
    );
  }
  // A trailing slash would produce `//api/...` upstream, which some routers
  // treat as a different path than the one the API actually serves.
  return value.replace(/\/+$/, '');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /*
   * `NEXT_PUBLIC_*` values are inlined at build time, so the end-to-end suite
   * has to build the app against its own API URL. It does that into a separate
   * directory: sharing `.next` would leave a developer's next `pnpm start`
   * quietly pointing at the throwaway test API.
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // Never set `ignoreBuildErrors: true`. Type errors are also caught by
  // `pnpm typecheck` in CI, but the build must refuse to produce output from
  // code that does not compile. Next 16 no longer runs ESLint during builds;
  // linting is a separate CI step.
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,
  /*
   * Next 16 writes an AGENTS.md and CLAUDE.md into this directory on every dev
   * start. This project already documents its own conventions in CLAUDE.md, and
   * a generated file that restates framework defaults next to a hand-written
   * one that states deliberate exceptions is worse than no file.
   */
  agentRules: false,
  /*
   * The API is served from this app's own origin.
   *
   * The browser calls `/api/*` here and Next forwards it to the SiteOps API, so
   * the session cookie is set by, and sent back to, this host. Calling the API
   * directly from the browser does not work across origins: the cookie is
   * `HttpOnly` and `SameSite=Lax`, and a browser will not store a `Lax` cookie
   * that arrives on a cross-site response. On Vercel and Render — different
   * registrable domains — sign-in succeeded and the cookie was dropped on the
   * floor, so `middleware.ts` saw no session and sent every visitor back to the
   * sign-in page. See `src/lib/api-base.ts`.
   *
   * The upstream keeps the `/api` prefix because that is where the API mounts
   * its own routes; this is a pass-through, not a remapping.
   */
  rewrites() {
    return Promise.resolve([{ source: '/api/:path*', destination: `${apiOrigin()}/api/:path*` }]);
  },

  // Returns a resolved promise rather than being `async`: Next requires a
  // Promise here, but there is nothing to await.
  headers() {
    return Promise.resolve([
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ]);
  },
};

export default nextConfig;

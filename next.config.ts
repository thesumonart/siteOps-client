import type { NextConfig } from 'next';

/*
 * Environment values are loaded by Next itself from this directory — `.env`,
 * `.env.local` and the mode-specific files. The monorepo version of this file
 * had to reach up to a shared root `.env`; a standalone frontend does not, and
 * the only variables it reads are the two NEXT_PUBLIC_* values validated in
 * `src/lib/env.ts`.
 */

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

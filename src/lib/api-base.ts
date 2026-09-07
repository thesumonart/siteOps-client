import { env } from './env';

/**
 * The origin every API request is sent to.
 *
 * In the browser this is the empty string, which makes every request
 * same-origin: `next.config.ts` rewrites `/api/*` onto the SiteOps API, so the
 * browser only ever talks to this app's own host.
 *
 * That is not a convenience, it is what makes the session work. The API issues
 * an `HttpOnly` session cookie with `SameSite=Lax`, and a browser refuses to
 * *store* a `Lax` cookie that arrives on a cross-site response. Deployed as
 * `siteops-client.vercel.app` calling `siteops-server.onrender.com` directly —
 * different registrable domains, so cross-site — sign-in answered 200 with a
 * valid session and the browser discarded the cookie, leaving every later
 * request anonymous and bouncing the dashboard back to sign-in. Routing through
 * this app's own origin makes that response same-site, so the cookie is stored,
 * `middleware.ts` can read it, and a server component can forward it.
 *
 * It is deliberately not conditional on the two origins happening to differ.
 * Same-origin is the arrangement the rest of this app is written against, and a
 * base URL that quietly changed shape with the deployment would put the failure
 * back exactly where it was hardest to see.
 *
 * On the server there is no origin to be relative to, so requests go straight to
 * the API. A server component has no cookie jar either and forwards the
 * browser's `Cookie` header explicitly; see `app/dashboard/layout.tsx`.
 */
export function apiBaseUrl(): string {
  return typeof window === 'undefined' ? env.NEXT_PUBLIC_API_URL : '';
}

import { E2E_API_URL } from '../../playwright.config';

/**
 * Confirms the stack this suite tests is actually up before a browser starts.
 *
 * The API belongs to siteOps-server and is started by whoever runs the suite,
 * so "not running" is the most likely reason for a failure here. Without this
 * check that shows up as every test timing out on a rendered error message,
 * which is a slow and misleading way to learn the API was never listening.
 */

const HEALTH_TIMEOUT_MS = 5_000;

export default async function globalSetup(): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${E2E_API_URL}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
  } catch {
    throw new Error(
      [
        `No SiteOps API is answering at ${E2E_API_URL}.`,
        '',
        'This suite drives the real stack and does not start the API itself: it',
        'lives in the siteOps-server repository. Start one against a throwaway',
        'database, then run the suite again. README.md, under "End-to-end tests",',
        'has the exact command.',
        '',
        'E2E_API_URL, E2E_MONGODB_URI and E2E_AUTH_SECRET override the defaults;',
        'the secret has to match the AUTH_SECRET that API was started with.',
      ].join('\n'),
    );
  }

  if (!response.ok) {
    throw new Error(`The API at ${E2E_API_URL} answered /health with ${String(response.status)}.`);
  }
}

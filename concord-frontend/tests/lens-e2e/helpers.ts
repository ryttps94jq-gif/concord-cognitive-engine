import type { BrowserContext, Page } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

/**
 * Sets the auth cookie so the test user appears authenticated.
 * Mirrors the pattern used in existing E2E tests (auth.spec.ts).
 */
export async function loginAsTestUser(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: 'concord_refresh',
      value: 'e2e_test_token',
      domain: 'localhost',
      path: '/',
    },
  ]);
}

/**
 * Fetches a DTU by ID from the API. Returns null if not found or on error.
 */
export async function fetchDTU(page: Page, dtuId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await page.request.get(`${API_BASE}/api/dtus/${dtuId}`);
    if (!res.ok()) return null;
    const data = (await res.json()) as { dtu?: Record<string, unknown>; ok?: boolean };
    return data?.dtu ?? null;
  } catch {
    return null;
  }
}

/**
 * Core smoke assertion: navigates to a lens and verifies the shell loaded.
 * Filters out benign console errors (HMR, favicon, net::ERR).
 */
export async function verifyLensLoads(page: Page, lensId: string, lensPath: string): Promise<void> {
  const criticalErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (
      text.includes('favicon') ||
      text.includes('HMR') ||
      text.includes('webpack') ||
      text.includes('net::ERR') ||
      text.includes('Failed to load resource') ||
      text.includes('401') ||
      text.includes('403')
    ) {
      return;
    }
    criticalErrors.push(text);
  });

  await page.goto(lensPath);
  await page.waitForLoadState('networkidle');

  // LensPageShell must be present — added by Fix 3
  await page.waitForSelector('[data-testid="lens-shell"]', { timeout: 8000 }).catch(() => {
    throw new Error(
      `Lens "${lensId}": [data-testid="lens-shell"] not found within 8s. ` +
        `The page at ${lensPath} may not use LensPageShell.`
    );
  });

  if (criticalErrors.length > 0) {
    throw new Error(`Lens "${lensId}": console errors: ${criticalErrors.slice(0, 3).join(' | ')}`);
  }
}

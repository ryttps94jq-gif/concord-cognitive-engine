/**
 * Lens Smoke Tests — parameterized over all 175 non-chat lens pages.
 *
 * Each test:
 *   1. Sets auth cookie
 *   2. Navigates to the lens path
 *   3. Verifies [data-testid="lens-shell"] is visible (LensPageShell rendered)
 *   4. Verifies no critical console errors
 *
 * If a test fails: the lens page is either missing LensPageShell, has a
 * runtime error, or has a broken route. Fix the lens, rerun.
 */
import { test, expect } from '@playwright/test';
import { SMOKE_LENSES } from './lens-list';
import { loginAsTestUser, verifyLensLoads } from './helpers';

for (const lens of SMOKE_LENSES) {
  test(`[smoke] ${lens.id} lens loads`, async ({ page, context }) => {
    await loginAsTestUser(context);
    await verifyLensLoads(page, lens.id, lens.path);
    await expect(page.locator('[data-testid="lens-shell"]')).toBeVisible();
  });
}

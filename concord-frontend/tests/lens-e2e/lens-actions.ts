import type { Page, Route } from '@playwright/test';

export interface LensAction {
  lensPath: string;
  run: (page: Page) => Promise<{ dtuId: string }>;
}

/**
 * Intercepts POST /api/dtus to capture the created DTU ID.
 * Used by creation tests to verify DTU output without polling.
 */
function interceptDTUCreate(page: Page): Promise<string> {
  return new Promise((resolve) => {
    page.route('**/api/dtus', async (route: Route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const dtu = body?.dtu as Record<string, unknown> | undefined;
      resolve((dtu?.id as string) || (body?.id as string) || '');
      await route.fulfill({ response });
    });
  });
}

export const LENS_ACTIONS: Record<string, LensAction> = {
  research: {
    lensPath: '/lenses/research',
    run: async (page) => {
      const dtuIdPromise = interceptDTUCreate(page);
      const searchInput = page
        .locator(
          'input[placeholder*="search" i], input[placeholder*="query" i], input[placeholder*="research" i]'
        )
        .first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('test query for e2e verification');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);
      }
      const dtuId = await Promise.race([
        dtuIdPromise,
        new Promise<string>((r) => setTimeout(() => r(''), 3000)),
      ]);
      return { dtuId };
    },
  },

  music: {
    lensPath: '/lenses/music',
    run: async (page) => {
      const dtuIdPromise = interceptDTUCreate(page);
      const createBtn = page.getByRole('button', { name: /create|new|compose|record/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
      }
      const dtuId = await Promise.race([
        dtuIdPromise,
        new Promise<string>((r) => setTimeout(() => r(''), 3000)),
      ]);
      return { dtuId };
    },
  },

  art: {
    lensPath: '/lenses/art',
    run: async (page) => {
      const dtuIdPromise = interceptDTUCreate(page);
      const createBtn = page.getByRole('button', { name: /create|new|upload|gallery/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
      }
      const dtuId = await Promise.race([
        dtuIdPromise,
        new Promise<string>((r) => setTimeout(() => r(''), 3000)),
      ]);
      return { dtuId };
    },
  },

  code: {
    lensPath: '/lenses/code',
    run: async (page) => {
      const dtuIdPromise = interceptDTUCreate(page);
      const exportBtn = page
        .getByRole('button', { name: /export.*dtu|save.*dtu|create.*dtu|new snippet/i })
        .first();
      if (await exportBtn.isVisible().catch(() => false)) {
        await exportBtn.click();
        await page.waitForTimeout(1000);
      }
      const dtuId = await Promise.race([
        dtuIdPromise,
        new Promise<string>((r) => setTimeout(() => r(''), 3000)),
      ]);
      return { dtuId };
    },
  },

  studio: {
    lensPath: '/lenses/studio',
    run: async (page) => {
      const dtuIdPromise = interceptDTUCreate(page);
      const createBtn = page.getByRole('button', { name: /create|new project|produce/i }).first();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);
      }
      const dtuId = await Promise.race([
        dtuIdPromise,
        new Promise<string>((r) => setTimeout(() => r(''), 3000)),
      ]);
      return { dtuId };
    },
  },
};

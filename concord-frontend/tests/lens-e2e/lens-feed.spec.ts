/**
 * Lens Feed Tests — verifies the LensFeedPanel renders and receives live events
 * for the 12 lenses that have web feed sources wired up.
 *
 * The /api/global/feed/:lensId endpoint is mocked to avoid live network
 * dependency in CI. Socket events are simulated via window.__concordEventBus.
 */
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers';

const FEED_LENSES = [
  { id: 'news', path: '/lenses/news', lensId: 'news' },
  { id: 'finance', path: '/lenses/finance', lensId: 'finance' },
  { id: 'science', path: '/lenses/science', lensId: 'science' },
  { id: 'sports', path: '/lenses/sports', lensId: 'sports' },
  { id: 'healthcare', path: '/lenses/healthcare', lensId: 'healthcare' },
  { id: 'energy', path: '/lenses/energy', lensId: 'energy' },
  { id: 'agriculture', path: '/lenses/agriculture', lensId: 'agriculture' },
  { id: 'geology', path: '/lenses/geology', lensId: 'geology' },
  { id: 'ocean', path: '/lenses/ocean', lensId: 'ocean' },
  { id: 'environment', path: '/lenses/environment', lensId: 'environment' },
  { id: 'legal', path: '/lenses/legal', lensId: 'legal' },
  // research shows science feeds (science/arXiv content is relevant to research)
  { id: 'research', path: '/lenses/research', lensId: 'science' },
] as const;

function makeMockFeedResponse(lensId: string) {
  return {
    ok: true,
    lensId,
    feed: [
      {
        id: `test-feed-dtu-${lensId}-1`,
        title: `Test Feed Item — ${lensId} lens`,
        core: { definitions: [`Sample feed content for the ${lensId} lens.`] },
        tags: [lensId, 'feed', 'live', `lens:${lensId}`],
        meta: {
          sourceName: 'Test Source',
          sourceUrl: 'https://example.com/article',
          publishedAt: new Date().toISOString(),
          domain: lensId,
          lensId,
        },
      },
      {
        id: `test-feed-dtu-${lensId}-2`,
        title: `Second Feed Item — ${lensId}`,
        tags: [lensId, 'feed'],
        meta: {
          sourceName: 'Another Source',
          publishedAt: new Date(Date.now() - 3600000).toISOString(),
          domain: lensId,
          lensId,
        },
      },
    ],
    total: 2,
    hasMore: false,
  };
}

for (const lens of FEED_LENSES) {
  test(`[feed] ${lens.id} shows feed panel with items`, async ({ page, context }) => {
    // Mock the feed API to return seeded data
    await page.route(`**/api/global/feed/${lens.lensId}**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeMockFeedResponse(lens.lensId)),
      })
    );

    await loginAsTestUser(context);
    await page.goto(lens.path);
    await page.waitForLoadState('networkidle');

    // Feed panel must be present
    await expect(page.locator('[data-testid="lens-feed-panel"]')).toBeVisible({ timeout: 8000 });

    // At least one card must be rendered with seeded data
    await expect(page.locator('[data-testid="feed-dtu-card"]').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test(`[feed] ${lens.id} renders live indicator on socket event`, async ({ page, context }) => {
    // Start with empty feed to isolate the live event test
    await page.route(`**/api/global/feed/${lens.lensId}**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, lensId: lens.lensId, feed: [], total: 0, hasMore: false }),
      })
    );

    await loginAsTestUser(context);
    await page.goto(lens.path);
    await page.waitForLoadState('networkidle');

    // Wait for the feed panel to mount
    await page.waitForSelector('[data-testid="lens-feed-panel"]', { timeout: 8000 });

    // Emit a feed event via the window-exposed event bus
    await page.evaluate(
      ({ lensId }: { lensId: string }) => {
        const bus = (window as Record<string, unknown>).__concordEventBus as
          | { emitEvent?: (event: string, data: unknown) => void }
          | undefined;
        if (bus?.emitEvent) {
          bus.emitEvent('feed:new-dtu', {
            lensId,
            domain: lensId,
            dtuId: 'live-test-e2e-001',
            title: `Live E2E test item for ${lensId}`,
            sourceName: 'E2E Test',
            tags: [lensId, 'feed', 'live'],
          });
        }
      },
      { lensId: lens.lensId }
    );

    // Live indicator text "Live" should appear in the feed panel header
    await expect(page.locator('[data-testid="lens-feed-panel"]').getByText('Live')).toBeVisible({
      timeout: 3000,
    });
  });
}

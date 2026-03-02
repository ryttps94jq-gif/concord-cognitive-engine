// E2E Journey 8: Complete Offline Operation
// Device in airplane mode for 24 hours. Everything works. Reconnect syncs all data.

describe('Journey 8: Complete Offline Operation', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Simulate airplane mode: no network connectivity
    await device.setStatusBar({ network: 'no' });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    await device.enableSynchronization();
  });

  test('local chat with local model works offline', async () => {
    await element(by.id('tab-chat')).tap();

    await waitFor(element(by.id('chat-input')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify offline indicator
    await expect(element(by.id('connection-indicator'))).toHaveText('offline');

    await element(by.id('chat-input')).typeText('Hello from offline mode');
    await element(by.id('chat-send-button')).tap();

    // Verify message sent
    await waitFor(element(by.text('Hello from offline mode')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify local model response
    await waitFor(element(by.id('chat-response-0')))
      .toBeVisible()
      .withTimeout(15000);

    await expect(element(by.id('chat-routed-to'))).toHaveText('local');
  });

  test('DTU creation works offline', async () => {
    // DTU should have been created from the chat interaction
    await element(by.id('settings-button')).tap();

    await waitFor(element(by.id('settings-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('lattice-dtu-count'))).toBeVisible();
    await expect(element(by.id('latest-dtu-integrity'))).toHaveText('valid');
    await expect(element(by.id('latest-dtu-propagated'))).toHaveText('false');

    await device.pressBack();
  });

  test('Foundation Sense readings continue offline', async () => {
    await element(by.id('tab-lenses')).tap();

    await waitFor(element(by.id('lenses-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('foundation-sense-card')).tap();

    await waitFor(element(by.id('foundation-sense-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Trigger a manual capture while offline
    await element(by.id('foundation-capture-button')).tap();

    await waitFor(element(by.id('capture-result')))
      .toBeVisible()
      .withTimeout(10000);

    // Sensors still working offline (some may be degraded)
    await expect(element(by.id('capture-status'))).toHaveText('success');
    await expect(element(by.id('capture-stored-locally'))).toHaveText('true');

    // Heartbeat still active
    await expect(element(by.id('foundation-heartbeat-status'))).toHaveText('active');

    await device.pressBack();
  });

  test('local marketplace browse works offline', async () => {
    await element(by.id('tab-marketplace')).tap();

    await waitFor(element(by.id('marketplace-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Cached listings should be displayed
    await waitFor(element(by.id('marketplace-listing-0')))
      .toBeVisible()
      .withTimeout(5000);

    // Category filtering works offline
    await element(by.id('marketplace-category-filter')).tap();

    await waitFor(element(by.id('category-picker')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('category-option-0')).tap();

    await waitFor(element(by.id('marketplace-listing-0')))
      .toBeVisible()
      .withTimeout(5000);

    // Search works offline
    await element(by.id('marketplace-search-input')).typeText('test');

    await waitFor(element(by.id('marketplace-search-results')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('marketplace-search-input')).clearText();
  });

  test('local wallet operations work offline', async () => {
    await element(by.id('tab-wallet')).tap();

    await waitFor(element(by.id('wallet-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Balance displayed from local ledger
    await expect(element(by.id('wallet-balance'))).toBeVisible();
    await expect(element(by.id('wallet-balance-source'))).toHaveText('local');

    // Transaction history visible
    await element(by.id('wallet-transaction-history')).tap();

    await waitFor(element(by.id('transaction-history-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('transaction-list'))).toBeVisible();

    await device.pressBack();
  });

  test('reconnection syncs accumulated data', async () => {
    // Re-enable network connectivity
    await device.setStatusBar({ network: 'wifi' });
    await device.enableSynchronization();

    // Verify connection state changes
    await waitFor(element(by.id('connection-indicator')))
      .toHaveText('online')
      .withTimeout(15000);

    // Wait for sync to complete
    await element(by.id('settings-button')).tap();

    await waitFor(element(by.id('settings-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await waitFor(element(by.id('sync-status')))
      .toHaveText('synced')
      .withTimeout(30000);

    // Verify all accumulated data synced
    await expect(element(by.id('sync-transactions-pending'))).toHaveText('0');
    await expect(element(by.id('sync-foundation-dtus-pending'))).toHaveText('0');
    await expect(element(by.id('sync-chat-dtus-pending'))).toHaveText('0');
    await expect(element(by.id('lattice-consistency'))).toHaveText('consistent');

    await device.pressBack();
  });
});

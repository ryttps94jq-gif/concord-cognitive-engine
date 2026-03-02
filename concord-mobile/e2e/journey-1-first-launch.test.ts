// E2E Journey 1: First Launch
// Install → Generate identity → Download genesis seeds → Sync lattice → First chat → First DTU

describe('Journey 1: First Launch', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
  });

  test('app launches without crash', async () => {
    await waitFor(element(by.id('loading-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.text('Concord'))).toBeVisible();
    await expect(element(by.text('Initializing device identity...'))).toBeVisible();

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(15000);
  });

  test('device identity generated on first launch', async () => {
    await element(by.id('settings-button')).tap();

    await waitFor(element(by.id('identity-public-key')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('identity-public-key'))).not.toHaveText('');
    await expect(element(by.id('identity-key-algorithm'))).toHaveText('Ed25519');
    await expect(element(by.id('identity-linked-devices'))).toHaveText('0');

    await device.pressBack();
  });

  test('hardware capabilities detected', async () => {
    await element(by.id('settings-button')).tap();

    await waitFor(element(by.id('hardware-platform')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('hardware-platform'))).toBeVisible();
    await expect(element(by.id('hardware-sensors-count'))).not.toHaveText('0');

    await device.pressBack();
  });

  test('genesis seed DTUs downloaded', async () => {
    await waitFor(element(by.id('genesis-sync-complete')))
      .toBeVisible()
      .withTimeout(30000);

    await element(by.id('settings-button')).tap();

    await waitFor(element(by.id('lattice-dtu-count')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('genesis-complete-flag'))).toHaveText('true');
    await expect(element(by.id('lattice-integrity-status'))).toHaveText('valid');

    await device.pressBack();
  });

  test('first chat message with local model', async () => {
    await element(by.id('tab-chat')).tap();

    await waitFor(element(by.id('chat-input')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('chat-input')).typeText('Hello Concord');
    await element(by.id('chat-send-button')).tap();

    await waitFor(element(by.id('chat-message-list')))
      .toBeVisible()
      .withTimeout(5000);

    await waitFor(element(by.text('Hello Concord')))
      .toBeVisible()
      .withTimeout(3000);

    await waitFor(element(by.id('chat-response-0')))
      .toBeVisible()
      .withTimeout(15000);

    await expect(element(by.id('chat-routed-to'))).toBeVisible();
  });

  test('first DTU created and stored locally', async () => {
    await element(by.id('settings-button')).tap();

    await waitFor(element(by.id('lattice-dtu-count')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('latest-dtu-header-valid'))).toHaveText('true');
    await expect(element(by.id('latest-dtu-integrity'))).toHaveText('valid');

    await device.pressBack();
  });

  test('all screens render without crash', async () => {
    await element(by.id('tab-chat')).tap();
    await expect(element(by.id('chat-input'))).toBeVisible();

    await element(by.id('tab-lenses')).tap();
    await waitFor(element(by.id('lenses-screen'))).toBeVisible().withTimeout(5000);

    await element(by.id('tab-marketplace')).tap();
    await waitFor(element(by.id('marketplace-screen'))).toBeVisible().withTimeout(5000);

    await element(by.id('tab-wallet')).tap();
    await waitFor(element(by.id('wallet-screen'))).toBeVisible().withTimeout(5000);

    await element(by.id('tab-mesh')).tap();
    await waitFor(element(by.id('mesh-screen'))).toBeVisible().withTimeout(5000);

    await element(by.id('settings-button')).tap();
    await waitFor(element(by.id('settings-screen'))).toBeVisible().withTimeout(5000);
    await device.pressBack();
  });
});

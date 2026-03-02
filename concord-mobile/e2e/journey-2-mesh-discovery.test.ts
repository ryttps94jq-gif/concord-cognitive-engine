// E2E Journey 2: Mesh Discovery
// Two devices launch → BLE discovery → Mutual authentication → Lattice sync → DTU exchange

describe('Journey 2: Mesh Discovery', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  test('BLE advertising starts on app launch', async () => {
    await element(by.id('tab-mesh')).tap();

    await waitFor(element(by.id('mesh-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await waitFor(element(by.id('ble-transport-status')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('ble-transport-status'))).toHaveText('active');
    await expect(element(by.id('ble-service-uuid'))).toBeVisible();
  });

  test('peer discovered within 5 seconds', async () => {
    await element(by.id('tab-mesh')).tap();

    await waitFor(element(by.id('mesh-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await waitFor(element(by.id('mesh-peer-count')))
      .not.toHaveText('0')
      .withTimeout(5000);

    await expect(element(by.id('mesh-peer-list'))).toBeVisible();

    await waitFor(element(by.id('mesh-peer-0')))
      .toBeVisible()
      .withTimeout(5000);
  });

  test('mutual authentication via Ed25519 challenge-response', async () => {
    await element(by.id('tab-mesh')).tap();

    await waitFor(element(by.id('mesh-peer-0')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('mesh-peer-0')).tap();

    await waitFor(element(by.id('peer-detail-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await waitFor(element(by.id('peer-auth-status')))
      .toHaveText('authenticated')
      .withTimeout(10000);

    await expect(element(by.id('peer-auth-method'))).toHaveText('Ed25519');
    await expect(element(by.id('peer-challenge-sent'))).toHaveText('true');
    await expect(element(by.id('peer-challenge-verified'))).toHaveText('true');

    await device.pressBack();
  });

  test('lattice sync exchanges DTUs', async () => {
    await element(by.id('tab-mesh')).tap();

    await waitFor(element(by.id('mesh-peer-0')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('mesh-peer-0')).tap();

    await waitFor(element(by.id('peer-sync-status')))
      .toHaveText('synced')
      .withTimeout(15000);

    await expect(element(by.id('peer-dtus-sent'))).toBeVisible();
    await expect(element(by.id('peer-dtus-received'))).toBeVisible();
    await expect(element(by.id('peer-merkle-diff-computed'))).toHaveText('true');

    await device.pressBack();
  });

  test('mesh status screen shows correct peer info', async () => {
    await element(by.id('tab-mesh')).tap();

    await waitFor(element(by.id('mesh-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('mesh-peer-count'))).toHaveText('1');

    await element(by.id('mesh-peer-0')).tap();

    await waitFor(element(by.id('peer-detail-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('peer-public-key'))).toBeVisible();
    await expect(element(by.id('peer-rssi'))).toBeVisible();
    await expect(element(by.id('peer-authenticated-badge'))).toBeVisible();

    await device.pressBack();
  });
});

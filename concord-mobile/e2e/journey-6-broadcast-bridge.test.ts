// E2E Journey 6: Broadcast Bridge
// Device receives FM broadcast DTUs → ingests → shares to mesh peers

describe('Journey 6: Broadcast Bridge', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  test('broadcast DTU received via FM subcarrier', async () => {
    await element(by.id('tab-mesh')).tap();

    await waitFor(element(by.id('mesh-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('mesh-broadcast-tab')).tap();

    await waitFor(element(by.id('broadcast-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Enable FM receiver simulation
    await element(by.id('broadcast-enable-receiver')).tap();

    await waitFor(element(by.id('broadcast-receiver-status')))
      .toHaveText('listening')
      .withTimeout(10000);

    // Wait for a broadcast DTU to arrive
    await waitFor(element(by.id('broadcast-dtu-received')))
      .toBeVisible()
      .withTimeout(15000);

    await expect(element(by.id('broadcast-dtu-integrity'))).toHaveText('valid');
    await expect(element(by.id('broadcast-dtu-source'))).toHaveText('fm-subcarrier');
    await expect(element(by.id('broadcast-dtu-ingested'))).toHaveText('true');
  });

  test('broadcast DTU bridged to BLE mesh', async () => {
    await element(by.id('tab-mesh')).tap();
    await element(by.id('mesh-broadcast-tab')).tap();

    await waitFor(element(by.id('broadcast-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Enable bridge mode
    await element(by.id('broadcast-bridge-toggle')).tap();

    await waitFor(element(by.id('broadcast-bridge-status')))
      .toHaveText('active')
      .withTimeout(5000);

    // Verify DTU retransmitted to BLE peers
    await waitFor(element(by.id('bridge-ble-forward-count')))
      .not.toHaveText('0')
      .withTimeout(15000);

    await expect(element(by.id('bridge-ble-forward-status'))).toHaveText('sent');
  });

  test('internet bridge forwards broadcast DTU to server', async () => {
    await element(by.id('tab-mesh')).tap();
    await element(by.id('mesh-broadcast-tab')).tap();

    await waitFor(element(by.id('broadcast-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Enable internet bridge
    await element(by.id('broadcast-internet-bridge-toggle')).tap();

    await waitFor(element(by.id('internet-bridge-status')))
      .toHaveText('active')
      .withTimeout(5000);

    // Verify DTU forwarded to server
    await waitFor(element(by.id('bridge-server-forward-count')))
      .not.toHaveText('0')
      .withTimeout(15000);

    await expect(element(by.id('bridge-server-forward-status'))).toHaveText('accepted');
  });

  test('duplicate handling — broadcast and mesh', async () => {
    await element(by.id('tab-mesh')).tap();
    await element(by.id('mesh-broadcast-tab')).tap();

    await waitFor(element(by.id('broadcast-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Check deduplication stats
    await element(by.id('broadcast-dedup-stats')).tap();

    await waitFor(element(by.id('dedup-stats-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('dedup-total-received'))).toBeVisible();
    await expect(element(by.id('dedup-duplicates-dropped'))).toBeVisible();
    await expect(element(by.id('dedup-unique-stored'))).toBeVisible();

    await device.pressBack();
  });

  test('no radio hardware — graceful degradation', async () => {
    // Relaunch app without FM radio capability
    await device.launchApp({ newInstance: true, launchArgs: { simulateNoRadio: true } });

    await element(by.id('tab-mesh')).tap();

    await waitFor(element(by.id('mesh-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('mesh-broadcast-tab')).tap();

    await waitFor(element(by.id('broadcast-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Broadcast features disabled but no crash
    await expect(element(by.id('broadcast-radio-unavailable'))).toBeVisible();
    await expect(element(by.id('broadcast-enable-receiver'))).not.toBeVisible();

    // Rest of app still works
    await element(by.id('tab-chat')).tap();
    await expect(element(by.id('chat-input'))).toBeVisible();

    await element(by.id('tab-wallet')).tap();
    await waitFor(element(by.id('wallet-screen'))).toBeVisible().withTimeout(5000);
  });
});

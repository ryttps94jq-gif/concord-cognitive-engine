// E2E Journey 3: Multi-Hop Relay
// Three devices. A→B→C. DTU from A reaches C through B.

describe('Journey 3: Multi-Hop Relay', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  test('DTU relayed from A to C through B', async () => {
    await element(by.id('tab-mesh')).tap();

    await waitFor(element(by.id('mesh-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify multi-hop peers are connected (A->B->C topology)
    await waitFor(element(by.id('mesh-peer-count')))
      .not.toHaveText('0')
      .withTimeout(10000);

    // Navigate to chat and create a DTU that will relay
    await element(by.id('tab-chat')).tap();
    await element(by.id('chat-input')).typeText('Multi-hop relay test message');
    await element(by.id('chat-send-button')).tap();

    await waitFor(element(by.text('Multi-hop relay test message')))
      .toBeVisible()
      .withTimeout(5000);

    // Navigate to mesh to verify relay activity
    await element(by.id('tab-mesh')).tap();

    await waitFor(element(by.id('relay-activity-log')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('relay-dtu-ttl'))).toBeVisible();
    await expect(element(by.id('relay-hop-count'))).toBeVisible();

    // Verify DTU reached the remote peer with decremented TTL
    await waitFor(element(by.id('relay-status-delivered')))
      .toBeVisible()
      .withTimeout(15000);
  });

  test('TTL enforcement — TTL=1 relayed once then dropped', async () => {
    await element(by.id('tab-mesh')).tap();

    await waitFor(element(by.id('mesh-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Access relay debug panel
    await element(by.id('mesh-relay-debug')).tap();

    await waitFor(element(by.id('relay-debug-panel')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('debug-ttl-input')).clearText();
    await element(by.id('debug-ttl-input')).typeText('1');
    await element(by.id('debug-send-test-dtu')).tap();

    // Verify TTL decremented to 0 at first hop
    await waitFor(element(by.id('debug-relay-result')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('debug-hop-1-ttl'))).toHaveText('0');
    await expect(element(by.id('debug-hop-2-received'))).toHaveText('false');

    await device.pressBack();
  });

  test('TTL=0 never relayed', async () => {
    await element(by.id('tab-mesh')).tap();
    await element(by.id('mesh-relay-debug')).tap();

    await waitFor(element(by.id('relay-debug-panel')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('debug-ttl-input')).clearText();
    await element(by.id('debug-ttl-input')).typeText('0');
    await element(by.id('debug-send-test-dtu')).tap();

    await waitFor(element(by.id('debug-relay-result')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('debug-hop-1-received'))).toHaveText('false');
    await expect(element(by.id('debug-relay-count'))).toHaveText('0');

    await device.pressBack();
  });

  test('priority relay — Shield threat before normal DTU', async () => {
    await element(by.id('tab-mesh')).tap();
    await element(by.id('mesh-relay-debug')).tap();

    await waitFor(element(by.id('relay-debug-panel')))
      .toBeVisible()
      .withTimeout(5000);

    // Queue a normal DTU then a shield threat DTU
    await element(by.id('debug-queue-normal-dtu')).tap();
    await element(by.id('debug-queue-shield-dtu')).tap();
    await element(by.id('debug-flush-relay-queue')).tap();

    await waitFor(element(by.id('debug-relay-order')))
      .toBeVisible()
      .withTimeout(10000);

    // Shield DTU should be relayed first
    await expect(element(by.id('debug-relay-order-0'))).toHaveText('shield');
    await expect(element(by.id('debug-relay-order-1'))).toHaveText('normal');

    await device.pressBack();
  });

  test('deduplication — same DTU from two peers stored once', async () => {
    await element(by.id('tab-mesh')).tap();
    await element(by.id('mesh-relay-debug')).tap();

    await waitFor(element(by.id('relay-debug-panel')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('debug-send-duplicate-dtu')).tap();

    await waitFor(element(by.id('debug-dedup-result')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('debug-dedup-received-count'))).toHaveText('2');
    await expect(element(by.id('debug-dedup-stored-count'))).toHaveText('1');

    await device.pressBack();
  });
});

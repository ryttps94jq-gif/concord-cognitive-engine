// E2E Journey 7: Emergency Alert — Collective Immunity
// Shield detects threat → propagates → all peers quarantine

describe('Journey 7: Emergency Alert', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  test('Shield detects threat and creates threat DTU', async () => {
    await element(by.id('tab-mesh')).tap();

    await waitFor(element(by.id('mesh-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Open Shield panel
    await element(by.id('mesh-shield-tab')).tap();

    await waitFor(element(by.id('shield-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Inject a simulated malicious DTU for testing
    await element(by.id('shield-debug-inject-threat')).tap();

    // Verify threat detected
    await waitFor(element(by.id('shield-threat-detected')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('shield-threat-classification'))).toBeVisible();
    await expect(element(by.id('shield-quarantine-count'))).not.toHaveText('0');

    // Verify threat DTU created with priority flag
    await expect(element(by.id('shield-threat-dtu-created'))).toHaveText('true');
    await expect(element(by.id('shield-threat-dtu-priority'))).toHaveText('true');
  });

  test('threat DTU propagated to peers within one heartbeat', async () => {
    await element(by.id('tab-mesh')).tap();
    await element(by.id('mesh-shield-tab')).tap();

    await waitFor(element(by.id('shield-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify propagation status
    await waitFor(element(by.id('shield-propagation-status')))
      .toHaveText('propagated')
      .withTimeout(15000);

    await expect(element(by.id('shield-propagation-peers'))).toBeVisible();
    await expect(element(by.id('shield-propagation-transport'))).toHaveText('priority-relay');

    // Verify it was sent within heartbeat window
    await expect(element(by.id('shield-propagation-time'))).toBeVisible();
  });

  test('receiving peers quarantine matching content', async () => {
    await element(by.id('tab-mesh')).tap();
    await element(by.id('mesh-shield-tab')).tap();

    await waitFor(element(by.id('shield-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Check collective immunity status
    await element(by.id('shield-collective-immunity')).tap();

    await waitFor(element(by.id('collective-immunity-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify threat signatures updated across peers
    await expect(element(by.id('immunity-signature-count'))).not.toHaveText('0');
    await expect(element(by.id('immunity-peers-protected'))).toBeVisible();
    await expect(element(by.id('immunity-auto-quarantine'))).toHaveText('enabled');

    // Verify matching DTUs are quarantined on this device
    await expect(element(by.id('immunity-local-quarantine-count'))).not.toHaveText('0');

    await device.pressBack();
  });

  test('false positive release mechanism', async () => {
    await element(by.id('tab-mesh')).tap();
    await element(by.id('mesh-shield-tab')).tap();

    await waitFor(element(by.id('shield-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Navigate to quarantine list
    await element(by.id('shield-quarantine-list')).tap();

    await waitFor(element(by.id('quarantine-list-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Select a quarantined item and release it
    await element(by.id('quarantine-item-0')).tap();

    await waitFor(element(by.id('quarantine-detail-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('quarantine-release-button')).tap();

    await waitFor(element(by.id('quarantine-release-confirm')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('quarantine-release-confirm')).tap();

    // Verify DTU re-ingested
    await waitFor(element(by.id('quarantine-release-success')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('released-dtu-status'))).toHaveText('ingested');

    await device.pressBack();
    await device.pressBack();
  });
});

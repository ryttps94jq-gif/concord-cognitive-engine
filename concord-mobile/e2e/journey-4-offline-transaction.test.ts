// E2E Journey 4: Offline Transaction
// Two devices, airplane mode, Bluetooth coin transfer, eventual sync

describe('Journey 4: Offline Transaction', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  test('offline transfer over Bluetooth', async () => {
    // Enable airplane mode but keep Bluetooth on
    await device.setStatusBar({ network: 'no' });
    await device.disableSynchronization();

    await element(by.id('tab-wallet')).tap();

    await waitFor(element(by.id('wallet-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify initial balance is visible
    await expect(element(by.id('wallet-balance'))).toBeVisible();

    // Verify connection indicator shows offline
    await expect(element(by.id('connection-indicator'))).toHaveText('offline');

    // Initiate a BLE transfer
    await element(by.id('wallet-send-button')).tap();

    await waitFor(element(by.id('send-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('send-amount-input')).typeText('10');
    await element(by.id('send-recipient-scan')).tap();

    // Select BLE peer as recipient
    await waitFor(element(by.id('ble-peer-select-0')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('ble-peer-select-0')).tap();

    await element(by.id('send-confirm-button')).tap();

    // Verify transaction signed and sent
    await waitFor(element(by.id('transaction-success')))
      .toBeVisible()
      .withTimeout(15000);

    await expect(element(by.id('transaction-signature'))).toBeVisible();
    await expect(element(by.id('transaction-transport'))).toHaveText('bluetooth');

    await device.enableSynchronization();
  });

  test('transaction propagates when reconnected', async () => {
    // Re-enable network
    await device.setStatusBar({ network: 'wifi' });

    await element(by.id('tab-wallet')).tap();

    await waitFor(element(by.id('wallet-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Wait for sync to complete
    await waitFor(element(by.id('connection-indicator')))
      .toHaveText('online')
      .withTimeout(15000);

    await waitFor(element(by.id('wallet-sync-status')))
      .toHaveText('synced')
      .withTimeout(15000);

    // Verify transaction is now propagated
    await element(by.id('wallet-transaction-history')).tap();

    await waitFor(element(by.id('transaction-0-propagated')))
      .toHaveText('true')
      .withTimeout(10000);
  });

  test('double-spend prevented', async () => {
    await element(by.id('tab-wallet')).tap();

    await waitFor(element(by.id('wallet-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Attempt to send full balance to two different recipients
    await element(by.id('wallet-send-button')).tap();
    await element(by.id('send-amount-input')).typeText('10');
    await element(by.id('send-recipient-scan')).tap();

    await waitFor(element(by.id('ble-peer-select-0')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('ble-peer-select-0')).tap();
    await element(by.id('send-confirm-button')).tap();

    await waitFor(element(by.id('transaction-success')))
      .toBeVisible()
      .withTimeout(10000);

    // Second attempt with same funds should fail
    await element(by.id('wallet-send-button')).tap();
    await element(by.id('send-amount-input')).typeText('10');
    await element(by.id('send-recipient-scan')).tap();

    await waitFor(element(by.id('ble-peer-select-1')))
      .toBeVisible()
      .withTimeout(10000);

    await element(by.id('ble-peer-select-1')).tap();
    await element(by.id('send-confirm-button')).tap();

    await waitFor(element(by.id('transaction-error')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.text('Insufficient funds'))).toBeVisible();
  });

  test('insufficient funds rejected immediately', async () => {
    await element(by.id('tab-wallet')).tap();

    await waitFor(element(by.id('wallet-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('wallet-send-button')).tap();

    await waitFor(element(by.id('send-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Enter amount exceeding balance
    await element(by.id('send-amount-input')).typeText('999999');

    await expect(element(by.id('send-error-insufficient'))).toBeVisible();
    await expect(element(by.id('send-confirm-button'))).not.toBeVisible();

    await device.pressBack();
  });
});

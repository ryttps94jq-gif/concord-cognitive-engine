// E2E Journey 5: Foundation Survey
// Device captures sensor data continuously, creates Foundation DTUs

describe('Journey 5: Foundation Survey', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  test('Foundation Sense captures all available sensors', async () => {
    await element(by.id('tab-lenses')).tap();

    await waitFor(element(by.id('lenses-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('foundation-sense-card')).tap();

    await waitFor(element(by.id('foundation-sense-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify each sensor reading is displayed
    await expect(element(by.id('sensor-wifi-rssi'))).toBeVisible();
    await expect(element(by.id('sensor-wifi-frequency'))).toBeVisible();
    await expect(element(by.id('sensor-wifi-channel'))).toBeVisible();

    await expect(element(by.id('sensor-bt-device-count'))).toBeVisible();
    await expect(element(by.id('sensor-bt-aggregate-rssi'))).toBeVisible();

    await expect(element(by.id('sensor-gps-accuracy'))).toBeVisible();
    await expect(element(by.id('sensor-gps-multipath'))).toBeVisible();

    await expect(element(by.id('sensor-barometric-pressure'))).toBeVisible();
    await expect(element(by.id('sensor-magnetometer'))).toBeVisible();
    await expect(element(by.id('sensor-accelerometer'))).toBeVisible();
    await expect(element(by.id('sensor-ambient-light'))).toBeVisible();
  });

  test('sensor DTUs geotagged to 100m grid not exact coordinates', async () => {
    await element(by.id('tab-lenses')).tap();
    await element(by.id('foundation-sense-card')).tap();

    await waitFor(element(by.id('foundation-sense-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Trigger a sensor capture
    await element(by.id('foundation-capture-button')).tap();

    await waitFor(element(by.id('capture-result')))
      .toBeVisible()
      .withTimeout(10000);

    // Verify geogrid is used, not exact coords
    await expect(element(by.id('capture-geogrid'))).toBeVisible();
    await expect(element(by.id('capture-exact-gps'))).not.toBeVisible();
    await expect(element(by.id('capture-grid-precision'))).toHaveText('100m');
  });

  test('Bluetooth scan never includes individual device IDs', async () => {
    await element(by.id('tab-lenses')).tap();
    await element(by.id('foundation-sense-card')).tap();

    await waitFor(element(by.id('foundation-sense-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('foundation-capture-button')).tap();

    await waitFor(element(by.id('capture-result')))
      .toBeVisible()
      .withTimeout(10000);

    // Verify only aggregate BT data, no individual IDs
    await element(by.id('capture-bt-detail')).tap();

    await waitFor(element(by.id('bt-detail-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('bt-device-count'))).toBeVisible();
    await expect(element(by.id('bt-aggregate-rssi'))).toBeVisible();
    await expect(element(by.id('bt-mac-addresses'))).not.toBeVisible();
    await expect(element(by.id('bt-device-names'))).not.toBeVisible();

    await device.pressBack();
  });

  test('each sensor failure independent', async () => {
    await element(by.id('tab-lenses')).tap();
    await element(by.id('foundation-sense-card')).tap();

    await waitFor(element(by.id('foundation-sense-screen')))
      .toBeVisible()
      .withTimeout(5000);

    // Simulate GPS unavailable
    await element(by.id('debug-disable-gps')).tap();
    await element(by.id('foundation-capture-button')).tap();

    await waitFor(element(by.id('capture-result')))
      .toBeVisible()
      .withTimeout(10000);

    // Other sensors still captured despite GPS failure
    await expect(element(by.id('sensor-gps-status'))).toHaveText('unavailable');
    await expect(element(by.id('sensor-wifi-rssi'))).toBeVisible();
    await expect(element(by.id('sensor-barometric-pressure'))).toBeVisible();
    await expect(element(by.id('sensor-magnetometer'))).toBeVisible();

    // Re-enable GPS
    await element(by.id('debug-enable-gps')).tap();
  });

  test('daily DTU limit enforced (10,000)', async () => {
    await element(by.id('settings-button')).tap();

    await waitFor(element(by.id('settings-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('foundation-daily-limit'))).toHaveText('10000');
    await expect(element(by.id('foundation-daily-count'))).toBeVisible();
    await expect(element(by.id('foundation-limit-enforced'))).toHaveText('true');

    await device.pressBack();
  });

  test('each Foundation DTU under 500 bytes compressed', async () => {
    await element(by.id('tab-lenses')).tap();
    await element(by.id('foundation-sense-card')).tap();

    await waitFor(element(by.id('foundation-sense-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('foundation-capture-button')).tap();

    await waitFor(element(by.id('capture-result')))
      .toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('capture-compressed-size'))).toBeVisible();
    await expect(element(by.id('capture-size-under-limit'))).toHaveText('true');
  });
});

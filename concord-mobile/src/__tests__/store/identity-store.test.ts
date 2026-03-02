// Tests for identity-store.ts

import { useIdentityStore } from '../../store/identity-store';
import type { DeviceIdentity, HardwareCapabilities } from '../../utils/types';

function createMockIdentity(overrides: Partial<DeviceIdentity> = {}): DeviceIdentity {
  return {
    publicKey: 'pk_' + Math.random().toString(36).slice(2),
    keyAlgorithm: 'Ed25519',
    createdAt: Date.now(),
    deviceId: 'dev_' + Math.random().toString(36).slice(2),
    linkedDevices: [],
    ...overrides,
  };
}

function createMockHardware(overrides: Partial<HardwareCapabilities> = {}): HardwareCapabilities {
  return {
    bluetooth: true,
    bluetoothLE: true,
    wifiDirect: false,
    nfc: false,
    gps: true,
    barometer: false,
    magnetometer: false,
    accelerometer: true,
    gyroscope: true,
    ambientLight: false,
    fmRadio: false,
    secureEnclave: true,
    totalRAMGB: 4,
    availableStorageGB: 32,
    cpuCores: 8,
    platform: 'android',
    osVersion: '14.0',
    ...overrides,
  };
}

describe('useIdentityStore', () => {
  beforeEach(() => {
    useIdentityStore.getState().reset();
  });

  describe('identity management', () => {
    test('setIdentity stores identity and marks initialized', () => {
      const identity = createMockIdentity();
      useIdentityStore.getState().setIdentity(identity);

      expect(useIdentityStore.getState().identity).toEqual(identity);
      expect(useIdentityStore.getState().isInitialized).toBe(true);
    });

    test('clearIdentity removes identity and resets initialized', () => {
      const identity = createMockIdentity();
      useIdentityStore.getState().setIdentity(identity);
      useIdentityStore.getState().clearIdentity();

      expect(useIdentityStore.getState().identity).toBeNull();
      expect(useIdentityStore.getState().isInitialized).toBe(false);
    });

    test('identity is null by default', () => {
      expect(useIdentityStore.getState().identity).toBeNull();
      expect(useIdentityStore.getState().isInitialized).toBe(false);
    });
  });

  describe('linked devices', () => {
    test('addLinkedDevice appends a device key', () => {
      const identity = createMockIdentity({ linkedDevices: [] });
      useIdentityStore.getState().setIdentity(identity);
      useIdentityStore.getState().addLinkedDevice('pk_device_2');

      expect(useIdentityStore.getState().identity?.linkedDevices).toContain('pk_device_2');
    });

    test('addLinkedDevice does not add duplicates', () => {
      const identity = createMockIdentity({ linkedDevices: ['pk_device_2'] });
      useIdentityStore.getState().setIdentity(identity);
      useIdentityStore.getState().addLinkedDevice('pk_device_2');

      expect(useIdentityStore.getState().identity?.linkedDevices).toHaveLength(1);
    });

    test('addLinkedDevice does nothing when identity is null', () => {
      useIdentityStore.getState().addLinkedDevice('pk_device_2');
      expect(useIdentityStore.getState().identity).toBeNull();
    });

    test('removeLinkedDevice removes a device key', () => {
      const identity = createMockIdentity({ linkedDevices: ['pk_a', 'pk_b'] });
      useIdentityStore.getState().setIdentity(identity);
      useIdentityStore.getState().removeLinkedDevice('pk_a');

      const linked = useIdentityStore.getState().identity?.linkedDevices ?? [];
      expect(linked).toEqual(['pk_b']);
    });

    test('removeLinkedDevice does nothing for unknown key', () => {
      const identity = createMockIdentity({ linkedDevices: ['pk_a'] });
      useIdentityStore.getState().setIdentity(identity);
      useIdentityStore.getState().removeLinkedDevice('pk_unknown');

      expect(useIdentityStore.getState().identity?.linkedDevices).toEqual(['pk_a']);
    });

    test('removeLinkedDevice does nothing when identity is null', () => {
      useIdentityStore.getState().removeLinkedDevice('pk_a');
      expect(useIdentityStore.getState().identity).toBeNull();
    });

    test('getLinkedDevices returns empty array when identity is null', () => {
      expect(useIdentityStore.getState().getLinkedDevices()).toEqual([]);
    });

    test('getLinkedDevices returns current linked devices', () => {
      const identity = createMockIdentity({ linkedDevices: ['pk_x', 'pk_y'] });
      useIdentityStore.getState().setIdentity(identity);

      expect(useIdentityStore.getState().getLinkedDevices()).toEqual(['pk_x', 'pk_y']);
    });
  });

  describe('hardware', () => {
    test('setHardware stores capabilities', () => {
      const hw = createMockHardware({ bluetooth: true, nfc: false });
      useIdentityStore.getState().setHardware(hw);

      expect(useIdentityStore.getState().hardware).toEqual(hw);
      expect(useIdentityStore.getState().hardware?.bluetooth).toBe(true);
      expect(useIdentityStore.getState().hardware?.nfc).toBe(false);
    });

    test('hardware is null by default', () => {
      expect(useIdentityStore.getState().hardware).toBeNull();
    });
  });

  describe('connection state', () => {
    test('setConnectionState updates state', () => {
      useIdentityStore.getState().setConnectionState('mesh-only');
      expect(useIdentityStore.getState().connectionState).toBe('mesh-only');
    });

    test('connectionState defaults to offline', () => {
      expect(useIdentityStore.getState().connectionState).toBe('offline');
    });

    test('setServerUrl updates url', () => {
      useIdentityStore.getState().setServerUrl('https://concord.example.com');
      expect(useIdentityStore.getState().serverUrl).toBe('https://concord.example.com');
    });

    test('serverUrl defaults to empty string', () => {
      expect(useIdentityStore.getState().serverUrl).toBe('');
    });
  });

  describe('battery', () => {
    test('setBattery updates level and charging status', () => {
      useIdentityStore.getState().setBattery(75, true);

      expect(useIdentityStore.getState().batteryLevel).toBe(75);
      expect(useIdentityStore.getState().isCharging).toBe(true);
    });

    test('setBattery clamps level to 0-100 range', () => {
      useIdentityStore.getState().setBattery(-10, false);
      expect(useIdentityStore.getState().batteryLevel).toBe(0);

      useIdentityStore.getState().setBattery(150, false);
      expect(useIdentityStore.getState().batteryLevel).toBe(100);
    });

    test('battery defaults to 100 and not charging', () => {
      expect(useIdentityStore.getState().batteryLevel).toBe(100);
      expect(useIdentityStore.getState().isCharging).toBe(false);
    });
  });

  describe('reset', () => {
    test('resets all state to initial values', () => {
      useIdentityStore.getState().setIdentity(createMockIdentity());
      useIdentityStore.getState().setHardware(createMockHardware());
      useIdentityStore.getState().setConnectionState('online');
      useIdentityStore.getState().setServerUrl('https://example.com');
      useIdentityStore.getState().setBattery(50, true);

      useIdentityStore.getState().reset();

      expect(useIdentityStore.getState().identity).toBeNull();
      expect(useIdentityStore.getState().isInitialized).toBe(false);
      expect(useIdentityStore.getState().hardware).toBeNull();
      expect(useIdentityStore.getState().connectionState).toBe('offline');
      expect(useIdentityStore.getState().serverUrl).toBe('');
      expect(useIdentityStore.getState().batteryLevel).toBe(100);
      expect(useIdentityStore.getState().isCharging).toBe(false);
    });
  });
});

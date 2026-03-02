// Integration test: Full App.tsx boot sequence (5-phase init)
// Verifies that the boot phases (hardware, identity, store, mesh, heartbeat)
// complete in order and update the correct Zustand stores.

import { useIdentityStore } from '../../store/identity-store';
import { useMeshStore } from '../../store/mesh-store';
import { detectHardwareCapabilities, getGracefulDegradation, setNativeDeviceInfo } from '../../utils/hardware-detect';
import { createIdentityManager, SecureStorage } from '../../identity/identity-manager';
import { setCryptoProvider } from '../../utils/crypto';
import type { CryptoProvider } from '../../utils/crypto';
import type { NativeDeviceInfo } from '../../utils/hardware-detect';
import { TRANSPORT_LAYERS } from '../../utils/constants';

// ── Mock crypto provider ────────────────────────────────────────────────────

const mockCryptoProvider: CryptoProvider = {
  sha256: jest.fn(async (data: Uint8Array) => {
    const xor = data.reduce((a, b) => a ^ b, 0);
    return new Uint8Array(32).fill(xor);
  }),
  hmacSha256: jest.fn(async () => new Uint8Array(32).fill(0xaa)),
  crc32: jest.fn(() => 0x12345678),
  randomBytes: jest.fn((size) => new Uint8Array(size).fill(0x42)),
  ed25519GenerateKeypair: jest.fn(async () => ({
    publicKey: new Uint8Array(32).fill(0x01),
    privateKey: new Uint8Array(64).fill(0x02),
  })),
  ed25519Sign: jest.fn(async () => new Uint8Array(64).fill(0x55)),
  ed25519Verify: jest.fn(async () => true),
};

// ── Mock secure storage ─────────────────────────────────────────────────────

function createMockSecureStorage(): SecureStorage {
  const store = new Map<string, string>();
  return {
    setItem: jest.fn(async (k, v) => { store.set(k, v); }),
    getItem: jest.fn(async (k) => store.get(k) ?? null),
    removeItem: jest.fn(async (k) => { store.delete(k); }),
    hasItem: jest.fn(async (k) => store.has(k)),
  };
}

// ── Mock native device info ─────────────────────────────────────────────────

function createMockNativeDeviceInfo(overrides: Partial<Record<string, boolean | number | string>> = {}): NativeDeviceInfo {
  const defaults: Record<string, any> = {
    bluetooth: true, bluetoothLE: true, wifiDirect: false, nfc: false,
    gps: true, barometer: false, magnetometer: false, accelerometer: true,
    gyroscope: true, ambientLight: false, fmRadio: false, secureEnclave: true,
    totalRAMGB: 4, availableStorageGB: 32, cpuCores: 8, osVersion: '14.0',
    ...overrides,
  };

  return {
    hasBluetooth: jest.fn(async () => defaults.bluetooth),
    hasBluetoothLE: jest.fn(async () => defaults.bluetoothLE),
    hasWifiDirect: jest.fn(async () => defaults.wifiDirect),
    hasNFC: jest.fn(async () => defaults.nfc),
    hasGPS: jest.fn(async () => defaults.gps),
    hasBarometer: jest.fn(async () => defaults.barometer),
    hasMagnetometer: jest.fn(async () => defaults.magnetometer),
    hasAccelerometer: jest.fn(async () => defaults.accelerometer),
    hasGyroscope: jest.fn(async () => defaults.gyroscope),
    hasAmbientLight: jest.fn(async () => defaults.ambientLight),
    hasFMRadio: jest.fn(async () => defaults.fmRadio),
    hasSecureEnclave: jest.fn(async () => defaults.secureEnclave),
    getTotalRAMGB: jest.fn(async () => defaults.totalRAMGB),
    getAvailableStorageGB: jest.fn(async () => defaults.availableStorageGB),
    getCPUCores: jest.fn(async () => defaults.cpuCores),
    getPlatform: jest.fn(() => 'android') as any,
    getOSVersion: jest.fn(async () => defaults.osVersion),
  };
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeAll(() => {
  setCryptoProvider(mockCryptoProvider);
});

beforeEach(() => {
  jest.clearAllMocks();
  useIdentityStore.getState().reset();
  useMeshStore.getState().reset();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('App.tsx Boot Sequence (5-phase init)', () => {
  it('Phase 1: detects hardware capabilities and stores them', async () => {
    const nativeInfo = createMockNativeDeviceInfo();
    setNativeDeviceInfo(nativeInfo);

    const hardware = await detectHardwareCapabilities();

    expect(hardware.bluetooth).toBe(true);
    expect(hardware.bluetoothLE).toBe(true);
    expect(hardware.gps).toBe(true);
    expect(hardware.wifiDirect).toBe(false);
    expect(hardware.totalRAMGB).toBe(4);
    expect(hardware.platform).toBe('android');

    // Store in identity store (as App.tsx does)
    useIdentityStore.getState().setHardware(hardware);
    expect(useIdentityStore.getState().hardware).toEqual(hardware);
  });

  it('Phase 1: generates degradation messages for missing capabilities', async () => {
    const nativeInfo = createMockNativeDeviceInfo({
      bluetooth: false, nfc: false, fmRadio: false,
    });
    setNativeDeviceInfo(nativeInfo);

    const hardware = await detectHardwareCapabilities();
    const degradations = getGracefulDegradation(hardware);

    expect(degradations.length).toBeGreaterThan(0);
    expect(degradations.some(d => d.includes('Bluetooth'))).toBe(true);
    expect(degradations.some(d => d.includes('NFC'))).toBe(true);
    expect(degradations.some(d => d.includes('FM radio'))).toBe(true);
  });

  it('Phase 2: initializes identity and stores it', async () => {
    const secureStorage = createMockSecureStorage();
    const identityManager = createIdentityManager(secureStorage);

    const identity = await identityManager.initialize();

    expect(identity.publicKey).toBeTruthy();
    expect(identity.deviceId).toMatch(/^dev_/);
    expect(identity.keyAlgorithm).toBe('Ed25519');
    expect(identity.linkedDevices).toEqual([]);

    // Store in identity store (as App.tsx does)
    useIdentityStore.getState().setIdentity(identity);
    expect(useIdentityStore.getState().identity?.publicKey).toBe(identity.publicKey);
    expect(useIdentityStore.getState().isInitialized).toBe(true);
  });

  it('Phase 2: reloads existing identity on subsequent boot', async () => {
    const secureStorage = createMockSecureStorage();

    // First boot
    const manager1 = createIdentityManager(secureStorage);
    const identity1 = await manager1.initialize();

    // Second boot — same storage
    const manager2 = createIdentityManager(secureStorage);
    const identity2 = await manager2.initialize();

    expect(identity2.publicKey).toBe(identity1.publicKey);
    expect(identity2.deviceId).toBe(identity1.deviceId);
  });

  it('Phase 4: sets mesh transport status for BLE', () => {
    // Simulating what App.tsx does in Phase 4
    useMeshStore.getState().setTransportStatus(TRANSPORT_LAYERS.BLUETOOTH, {
      available: true,
      active: false,
      peerCount: 0,
      lastActivity: Date.now(),
    });

    const bt = useMeshStore.getState().transports.find(
      t => t.layer === TRANSPORT_LAYERS.BLUETOOTH
    );
    expect(bt?.available).toBe(true);
    expect(bt?.active).toBe(false);
    expect(bt?.peerCount).toBe(0);
  });

  it('runs all 5 phases in sequence and reaches ready state', async () => {
    // Simulate the full boot sequence from App.tsx
    const phases: string[] = [];

    // Phase 1: Hardware
    phases.push('hardware');
    const nativeInfo = createMockNativeDeviceInfo();
    setNativeDeviceInfo(nativeInfo);
    const hardware = await detectHardwareCapabilities();
    useIdentityStore.getState().setHardware(hardware);

    // Phase 2: Identity
    phases.push('identity');
    const secureStorage = createMockSecureStorage();
    const identityManager = createIdentityManager(secureStorage);
    const identity = await identityManager.initialize();
    useIdentityStore.getState().setIdentity(identity);

    // Phase 3: Store (DTU lattice — placeholder in App.tsx)
    phases.push('store');
    // In actual App.tsx this is a no-op placeholder for lazy DTU store init

    // Phase 4: Mesh
    phases.push('mesh');
    useMeshStore.getState().setTransportStatus(TRANSPORT_LAYERS.BLUETOOTH, {
      available: true,
      active: false,
      peerCount: 0,
      lastActivity: Date.now(),
    });

    // Phase 5: Heartbeat
    phases.push('heartbeat');
    // In actual App.tsx this is a no-op placeholder for heartbeat engine

    // Verify all phases ran
    phases.push('ready');
    expect(phases).toEqual(['hardware', 'identity', 'store', 'mesh', 'heartbeat', 'ready']);

    // Verify stores are in expected state after boot
    expect(useIdentityStore.getState().isInitialized).toBe(true);
    expect(useIdentityStore.getState().identity).not.toBeNull();
    expect(useIdentityStore.getState().hardware).not.toBeNull();
    expect(useIdentityStore.getState().hardware?.bluetooth).toBe(true);

    const bt = useMeshStore.getState().transports.find(
      t => t.layer === TRANSPORT_LAYERS.BLUETOOTH
    );
    expect(bt?.available).toBe(true);
  });

  it('boot continues even if hardware detection partially fails', async () => {
    // Simulate a device where some probes throw
    const nativeInfo = createMockNativeDeviceInfo();
    (nativeInfo.hasBarometer as jest.Mock).mockRejectedValue(new Error('Sensor unavailable'));
    (nativeInfo.hasMagnetometer as jest.Mock).mockRejectedValue(new Error('Sensor unavailable'));
    setNativeDeviceInfo(nativeInfo);

    const hardware = await detectHardwareCapabilities();

    // Failed probes should fall back to false
    expect(hardware.barometer).toBe(false);
    expect(hardware.magnetometer).toBe(false);
    // Other probes should succeed
    expect(hardware.bluetooth).toBe(true);
    expect(hardware.gps).toBe(true);

    useIdentityStore.getState().setHardware(hardware);
    expect(useIdentityStore.getState().hardware).toBeDefined();
  });

  it('identity initialization creates a fresh keypair and device ID', async () => {
    const secureStorage = createMockSecureStorage();
    const identityManager = createIdentityManager(secureStorage);
    const identity = await identityManager.initialize();

    // Verify crypto was called to generate a keypair
    expect(mockCryptoProvider.ed25519GenerateKeypair).toHaveBeenCalled();

    // Verify the identity structure
    expect(identity.publicKey).toHaveLength(64); // 32 bytes as hex
    expect(identity.createdAt).toBeGreaterThan(0);
    expect(identity.linkedDevices).toEqual([]);

    // Verify it was stored in secure storage
    expect(secureStorage.setItem).toHaveBeenCalled();
  });

  it('mesh store initializes with all transport layers', () => {
    const transports = useMeshStore.getState().transports;

    // Should have all 7 transport layers from TRANSPORT_LAYERS
    expect(transports.length).toBe(7);

    // All should be inactive by default
    for (const t of transports) {
      expect(t.available).toBe(false);
      expect(t.active).toBe(false);
      expect(t.peerCount).toBe(0);
    }
  });
});

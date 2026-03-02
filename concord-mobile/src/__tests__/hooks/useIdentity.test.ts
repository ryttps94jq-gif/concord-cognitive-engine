// Tests for useIdentity hook

import { renderHook } from '@testing-library/react-native';
import { useIdentity } from '../../hooks/useIdentity';
import { useIdentityStore } from '../../store/identity-store';
import type { DeviceIdentity, HardwareCapabilities, ConnectionState } from '../../utils/types';

jest.mock('../../store/identity-store');

const mockUseIdentityStore = useIdentityStore as unknown as jest.Mock;

const mockIdentity: DeviceIdentity = {
  publicKey: 'ed25519-pubkey-abc123',
  keyAlgorithm: 'Ed25519',
  createdAt: 1700000000000,
  deviceId: 'device-001',
  linkedDevices: ['device-002', 'device-003'],
};

const mockHardware: HardwareCapabilities = {
  bluetooth: true,
  bluetoothLE: true,
  wifiDirect: true,
  nfc: false,
  gps: true,
  barometer: false,
  magnetometer: true,
  accelerometer: true,
  gyroscope: true,
  ambientLight: false,
  fmRadio: false,
  secureEnclave: true,
  totalRAMGB: 8,
  availableStorageGB: 64,
  cpuCores: 8,
  platform: 'android',
  osVersion: '14',
};

interface MockStoreState {
  identity: DeviceIdentity | null;
  isInitialized: boolean;
  hardware: HardwareCapabilities | null;
  connectionState: ConnectionState;
}

function setupStoreMock(overrides: Partial<MockStoreState> = {}) {
  const state: MockStoreState = {
    identity: null,
    isInitialized: false,
    hardware: null,
    connectionState: 'offline',
    ...overrides,
  };

  mockUseIdentityStore.mockImplementation((selector: (s: MockStoreState) => any) => {
    return selector(state);
  });
}

describe('useIdentity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when identity is null (not initialized)', () => {
    it('returns null identity', () => {
      setupStoreMock();
      const { result } = renderHook(() => useIdentity());
      expect(result.current.identity).toBeNull();
    });

    it('returns isInitialized as false', () => {
      setupStoreMock();
      const { result } = renderHook(() => useIdentity());
      expect(result.current.isInitialized).toBe(false);
    });

    it('returns null publicKey when identity is null', () => {
      setupStoreMock();
      const { result } = renderHook(() => useIdentity());
      expect(result.current.publicKey).toBeNull();
    });

    it('returns null hardware when not set', () => {
      setupStoreMock();
      const { result } = renderHook(() => useIdentity());
      expect(result.current.hardware).toBeNull();
    });

    it('returns zero linkedDeviceCount when identity is null', () => {
      setupStoreMock();
      const { result } = renderHook(() => useIdentity());
      expect(result.current.linkedDeviceCount).toBe(0);
    });

    it('returns offline connectionState by default', () => {
      setupStoreMock();
      const { result } = renderHook(() => useIdentity());
      expect(result.current.connectionState).toBe('offline');
    });
  });

  describe('when identity exists', () => {
    it('returns the full identity object', () => {
      setupStoreMock({ identity: mockIdentity, isInitialized: true });
      const { result } = renderHook(() => useIdentity());
      expect(result.current.identity).toEqual(mockIdentity);
    });

    it('returns isInitialized as true', () => {
      setupStoreMock({ identity: mockIdentity, isInitialized: true });
      const { result } = renderHook(() => useIdentity());
      expect(result.current.isInitialized).toBe(true);
    });

    it('extracts publicKey from identity', () => {
      setupStoreMock({ identity: mockIdentity, isInitialized: true });
      const { result } = renderHook(() => useIdentity());
      expect(result.current.publicKey).toBe('ed25519-pubkey-abc123');
    });

    it('returns correct linkedDeviceCount', () => {
      setupStoreMock({ identity: mockIdentity, isInitialized: true });
      const { result } = renderHook(() => useIdentity());
      expect(result.current.linkedDeviceCount).toBe(2);
    });

    it('returns zero linkedDeviceCount for identity with no linked devices', () => {
      const soloIdentity = { ...mockIdentity, linkedDevices: [] };
      setupStoreMock({ identity: soloIdentity, isInitialized: true });
      const { result } = renderHook(() => useIdentity());
      expect(result.current.linkedDeviceCount).toBe(0);
    });
  });

  describe('hardware capabilities', () => {
    it('returns hardware capabilities when present', () => {
      setupStoreMock({ hardware: mockHardware });
      const { result } = renderHook(() => useIdentity());
      expect(result.current.hardware).toEqual(mockHardware);
    });
  });

  describe('connection states', () => {
    it.each<ConnectionState>(['online', 'mesh-only', 'offline'])(
      'returns connectionState "%s" correctly',
      (state) => {
        setupStoreMock({ connectionState: state });
        const { result } = renderHook(() => useIdentity());
        expect(result.current.connectionState).toBe(state);
      },
    );
  });
});

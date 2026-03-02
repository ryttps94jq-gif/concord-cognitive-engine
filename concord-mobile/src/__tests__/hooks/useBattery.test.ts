// Tests for useBattery hook

import { renderHook } from '@testing-library/react-native';
import { useBattery } from '../../hooks/useBattery';
import { useIdentityStore } from '../../store/identity-store';
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_LOW_BATTERY_INTERVAL_MS,
  HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS,
  HEARTBEAT_DORMANT_BATTERY_THRESHOLD,
} from '../../utils/constants';

jest.mock('../../store/identity-store');

const mockUseIdentityStore = useIdentityStore as unknown as jest.Mock;

function setupStoreMock(batteryLevel: number, isCharging: boolean) {
  mockUseIdentityStore.mockImplementation((selector: (s: any) => any) => {
    const state = { batteryLevel, isCharging };
    return selector(state);
  });
}

describe('useBattery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('battery level and charging state', () => {
    it('returns current battery level from the store', () => {
      setupStoreMock(75, false);
      const { result } = renderHook(() => useBattery());
      expect(result.current.level).toBe(75);
    });

    it('returns charging state from the store', () => {
      setupStoreMock(50, true);
      const { result } = renderHook(() => useBattery());
      expect(result.current.isCharging).toBe(true);
    });

    it('returns full battery state correctly', () => {
      setupStoreMock(100, true);
      const { result } = renderHook(() => useBattery());
      expect(result.current.level).toBe(100);
      expect(result.current.isCharging).toBe(true);
      expect(result.current.isLow).toBe(false);
      expect(result.current.isCritical).toBe(false);
      expect(result.current.isDormant).toBe(false);
    });
  });

  describe('isLow threshold (< 30 and not charging)', () => {
    it('is false when battery is above 30', () => {
      setupStoreMock(50, false);
      const { result } = renderHook(() => useBattery());
      expect(result.current.isLow).toBe(false);
    });

    it('is false when battery is exactly 30', () => {
      setupStoreMock(30, false);
      const { result } = renderHook(() => useBattery());
      expect(result.current.isLow).toBe(false);
    });

    it('is true when battery is 29 and not charging', () => {
      setupStoreMock(29, false);
      const { result } = renderHook(() => useBattery());
      expect(result.current.isLow).toBe(true);
    });

    it('is false when battery is low but charging', () => {
      setupStoreMock(20, true);
      const { result } = renderHook(() => useBattery());
      expect(result.current.isLow).toBe(false);
    });
  });

  describe('isCritical threshold (< 15 and not charging)', () => {
    it('is false when battery is 15', () => {
      setupStoreMock(15, false);
      const { result } = renderHook(() => useBattery());
      expect(result.current.isCritical).toBe(false);
    });

    it('is true when battery is 14 and not charging', () => {
      setupStoreMock(14, false);
      const { result } = renderHook(() => useBattery());
      expect(result.current.isCritical).toBe(true);
    });

    it('is false when battery is critical but charging', () => {
      setupStoreMock(10, true);
      const { result } = renderHook(() => useBattery());
      expect(result.current.isCritical).toBe(false);
    });
  });

  describe('isDormant threshold (< HEARTBEAT_DORMANT_BATTERY_THRESHOLD and not charging)', () => {
    it('is false when battery is at the threshold', () => {
      setupStoreMock(HEARTBEAT_DORMANT_BATTERY_THRESHOLD, false);
      const { result } = renderHook(() => useBattery());
      expect(result.current.isDormant).toBe(false);
    });

    it('is true when battery is below the threshold and not charging', () => {
      setupStoreMock(HEARTBEAT_DORMANT_BATTERY_THRESHOLD - 1, false);
      const { result } = renderHook(() => useBattery());
      expect(result.current.isDormant).toBe(true);
    });

    it('is false when battery is below threshold but charging', () => {
      setupStoreMock(2, true);
      const { result } = renderHook(() => useBattery());
      expect(result.current.isDormant).toBe(false);
    });
  });

  describe('heartbeatInterval', () => {
    it('returns normal interval for healthy battery', () => {
      setupStoreMock(80, false);
      const { result } = renderHook(() => useBattery());
      expect(result.current.heartbeatInterval).toBe(HEARTBEAT_INTERVAL_MS);
    });

    it('returns low battery interval when battery is low but not critical', () => {
      setupStoreMock(20, false);
      const { result } = renderHook(() => useBattery());
      expect(result.current.heartbeatInterval).toBe(HEARTBEAT_LOW_BATTERY_INTERVAL_MS);
    });

    it('returns critical interval when battery is critical but not dormant', () => {
      setupStoreMock(10, false);
      const { result } = renderHook(() => useBattery());
      expect(result.current.heartbeatInterval).toBe(HEARTBEAT_CRITICAL_BATTERY_INTERVAL_MS);
    });

    it('returns Infinity when battery is dormant', () => {
      setupStoreMock(HEARTBEAT_DORMANT_BATTERY_THRESHOLD - 1, false);
      const { result } = renderHook(() => useBattery());
      expect(result.current.heartbeatInterval).toBe(Infinity);
    });

    it('returns normal interval when charging regardless of level', () => {
      setupStoreMock(3, true);
      const { result } = renderHook(() => useBattery());
      expect(result.current.heartbeatInterval).toBe(HEARTBEAT_INTERVAL_MS);
    });
  });
});

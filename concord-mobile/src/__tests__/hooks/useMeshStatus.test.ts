// Tests for useMeshStatus, usePeerCount, and useRelayQueueDepth hooks

import { renderHook } from '@testing-library/react-native';
import { useMeshStatus, usePeerCount, useRelayQueueDepth } from '../../hooks/useMeshStatus';
import { useMeshStore } from '../../store/mesh-store';
import type {
  MeshHealth,
  TransportStatus,
  ConnectionState,
  MeshPeer,
  RelayQueueEntry,
} from '../../utils/types';

jest.mock('../../store/mesh-store');

const mockUseMeshStore = useMeshStore as unknown as jest.Mock;

const defaultHealth: MeshHealth = {
  connectedPeers: 0,
  activeTransports: 0,
  relayQueueDepth: 0,
  dtusPropagated: 0,
  dtusReceived: 0,
  uptime: 0,
};

const bleTransport: TransportStatus = {
  layer: 3,
  available: true,
  active: true,
  peerCount: 2,
  lastActivity: Date.now(),
};

const wifiTransport: TransportStatus = {
  layer: 2,
  available: true,
  active: false,
  peerCount: 0,
  lastActivity: 0,
};

const loraTransport: TransportStatus = {
  layer: 4,
  available: false,
  active: false,
  peerCount: 0,
  lastActivity: 0,
};

interface MockMeshState {
  meshHealth: MeshHealth;
  transports: TransportStatus[];
  connectionState: ConnectionState;
  peers: Map<string, MeshPeer>;
  relayQueue: RelayQueueEntry[];
}

function setupStoreMock(overrides: Partial<MockMeshState> = {}) {
  const state: MockMeshState = {
    meshHealth: { ...defaultHealth },
    transports: [],
    connectionState: 'offline',
    peers: new Map(),
    relayQueue: [],
    ...overrides,
  };

  mockUseMeshStore.mockImplementation((selector: (s: MockMeshState) => any) => {
    return selector(state);
  });
}

describe('useMeshStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('health', () => {
    it('returns mesh health from the store', () => {
      const health: MeshHealth = {
        ...defaultHealth,
        connectedPeers: 5,
        activeTransports: 2,
        dtusPropagated: 150,
      };
      setupStoreMock({ meshHealth: health });
      const { result } = renderHook(() => useMeshStatus());
      expect(result.current.health).toEqual(health);
    });
  });

  describe('transports', () => {
    it('returns all transports from the store', () => {
      const transports = [bleTransport, wifiTransport, loraTransport];
      setupStoreMock({ transports });
      const { result } = renderHook(() => useMeshStatus());
      expect(result.current.transports).toHaveLength(3);
    });

    it('filters active transports correctly', () => {
      const transports = [bleTransport, wifiTransport, loraTransport];
      setupStoreMock({ transports });
      const { result } = renderHook(() => useMeshStatus());
      expect(result.current.activeTransports).toHaveLength(1);
      expect(result.current.activeTransports[0].layer).toBe(3);
    });

    it('returns empty active transports when none are active', () => {
      setupStoreMock({ transports: [wifiTransport, loraTransport] });
      const { result } = renderHook(() => useMeshStatus());
      expect(result.current.activeTransports).toHaveLength(0);
    });
  });

  describe('peerCount', () => {
    it('returns zero when no peers', () => {
      setupStoreMock();
      const { result } = renderHook(() => useMeshStatus());
      expect(result.current.peerCount).toBe(0);
    });

    it('returns correct peer count from map size', () => {
      const peers = new Map<string, MeshPeer>();
      peers.set('peer-1', {} as MeshPeer);
      peers.set('peer-2', {} as MeshPeer);
      peers.set('peer-3', {} as MeshPeer);
      setupStoreMock({ peers });
      const { result } = renderHook(() => useMeshStatus());
      expect(result.current.peerCount).toBe(3);
    });
  });

  describe('connection state flags', () => {
    it('returns isConnected true only when online', () => {
      setupStoreMock({ connectionState: 'online' });
      const { result } = renderHook(() => useMeshStatus());
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isMeshOnly).toBe(false);
      expect(result.current.isOffline).toBe(false);
    });

    it('returns isMeshOnly true only when mesh-only', () => {
      setupStoreMock({ connectionState: 'mesh-only' });
      const { result } = renderHook(() => useMeshStatus());
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isMeshOnly).toBe(true);
      expect(result.current.isOffline).toBe(false);
    });

    it('returns isOffline true only when offline', () => {
      setupStoreMock({ connectionState: 'offline' });
      const { result } = renderHook(() => useMeshStatus());
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isMeshOnly).toBe(false);
      expect(result.current.isOffline).toBe(true);
    });

    it('returns the raw connectionState string', () => {
      setupStoreMock({ connectionState: 'mesh-only' });
      const { result } = renderHook(() => useMeshStatus());
      expect(result.current.connectionState).toBe('mesh-only');
    });
  });
});

describe('usePeerCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns zero for empty peers map', () => {
    setupStoreMock();
    const { result } = renderHook(() => usePeerCount());
    expect(result.current).toBe(0);
  });

  it('returns the size of the peers map', () => {
    const peers = new Map<string, MeshPeer>();
    peers.set('a', {} as MeshPeer);
    peers.set('b', {} as MeshPeer);
    setupStoreMock({ peers });
    const { result } = renderHook(() => usePeerCount());
    expect(result.current).toBe(2);
  });
});

describe('useRelayQueueDepth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns zero for empty relay queue', () => {
    setupStoreMock();
    const { result } = renderHook(() => useRelayQueueDepth());
    expect(result.current).toBe(0);
  });

  it('returns the length of the relay queue', () => {
    const relayQueue = [
      { dtuId: 'dtu-1' } as RelayQueueEntry,
      { dtuId: 'dtu-2' } as RelayQueueEntry,
      { dtuId: 'dtu-3' } as RelayQueueEntry,
    ];
    setupStoreMock({ relayQueue });
    const { result } = renderHook(() => useRelayQueueDepth());
    expect(result.current).toBe(3);
  });
});

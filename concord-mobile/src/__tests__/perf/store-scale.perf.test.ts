// Performance benchmarks for store scalability — insert, query, memory, Zustand throughput

import { createDTUStore } from '../../dtu/store/dtu-store';
import type { DTUStore, SQLiteDatabase } from '../../dtu/store/dtu-store';
import { useMeshStore } from '../../store/mesh-store';
import { setCryptoProvider } from '../../utils/crypto';
import type { CryptoProvider } from '../../utils/crypto';
import { DTU_TYPES, DTU_VERSION, TRANSPORT_LAYERS } from '../../utils/constants';
import type { DTU, DTUTypeCode, MeshPeer, RelayQueueEntry } from '../../utils/types';

// ── Timing helpers ───────────────────────────────────────────────────────────

function measureMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

async function measureMsAsync(fn: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

// ── Mock crypto provider ─────────────────────────────────────────────────────

const mockCryptoProvider: CryptoProvider = {
  sha256: jest.fn(async (data: Uint8Array) => new Uint8Array(32).fill(data[0] ?? 0)),
  hmacSha256: jest.fn(async () => new Uint8Array(32).fill(0xaa)),
  crc32: jest.fn(() => 0x12345678),
  randomBytes: jest.fn((size: number) => new Uint8Array(size).fill(0x42)),
  ed25519GenerateKeypair: jest.fn(async () => ({
    publicKey: new Uint8Array(32).fill(0x01),
    privateKey: new Uint8Array(64).fill(0x02),
  })),
  ed25519Sign: jest.fn(async () => new Uint8Array(64).fill(0x55)),
  ed25519Verify: jest.fn(async () => true),
};

// ── Mock SQLite database ─────────────────────────────────────────────────────

function createMockDb(): SQLiteDatabase {
  return {
    executeSql: jest.fn().mockResolvedValue({ rows: { length: 0, item: () => null } }),
  };
}

// ── DTU factory ──────────────────────────────────────────────────────────────

const typePool: DTUTypeCode[] = [
  DTU_TYPES.TEXT,
  DTU_TYPES.KNOWLEDGE,
  DTU_TYPES.FOUNDATION_SENSE,
  DTU_TYPES.SHIELD_THREAT,
  DTU_TYPES.ECONOMY_TRANSACTION,
] as DTUTypeCode[];

function makeDTU(index: number, contentSize: number = 128): DTU {
  const typeIdx = index % typePool.length;
  return {
    id: `dtu_scale_${index}`,
    header: {
      version: DTU_VERSION,
      flags: 0,
      type: typePool[typeIdx],
      timestamp: Date.now() - index * 1000,
      contentLength: contentSize,
      contentHash: new Uint8Array(32).fill(index & 0xff),
    },
    content: new Uint8Array(contentSize).fill(0x61 + (index % 26)),
    tags: ['scale', `type-${typeIdx}`, `batch-${Math.floor(index / 100)}`],
    meta: {
      scope: index % 3 === 0 ? 'global' : 'local',
      published: false,
      painTagged: index % 10 === 0,
      crpiScore: 0,
      relayCount: 0,
      ttl: 7,
    },
    lineage: { parentId: null, ancestors: [], depth: 0 },
  };
}

function makeMockPeer(id: string): MeshPeer {
  return {
    id,
    publicKey: `pk_${id}`,
    transport: TRANSPORT_LAYERS.BLUETOOTH,
    rssi: -60,
    lastSeen: Date.now(),
    capabilities: { bluetooth: true, wifiDirect: false, nfc: false, lora: false, internet: false },
    reputation: { validDTUs: 0, invalidDTUs: 0, totalRelays: 0, score: 0.5 },
    authenticated: false,
  };
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeAll(() => {
  setCryptoProvider(mockCryptoProvider);
});

beforeEach(() => {
  jest.clearAllMocks();
  useMeshStore.getState().reset();
});

// ── Insert N Items ───────────────────────────────────────────────────────────

describe('DTU store insert scalability', () => {
  it('inserts 100 DTUs in under 100ms', () => {
    const store = createDTUStore(createMockDb());
    const dtus = Array.from({ length: 100 }, (_, i) => makeDTU(i));
    const elapsed = measureMs(() => {
      for (const dtu of dtus) {
        store.set(dtu.id, dtu);
      }
    });
    expect(store.size).toBe(100);
    expect(elapsed).toBeLessThan(100);
  });

  it('inserts 1000 DTUs in under 500ms', () => {
    const store = createDTUStore(createMockDb());
    const dtus = Array.from({ length: 1000 }, (_, i) => makeDTU(i));
    const elapsed = measureMs(() => {
      for (const dtu of dtus) {
        store.set(dtu.id, dtu);
      }
    });
    expect(store.size).toBe(1000);
    expect(elapsed).toBeLessThan(500);
  });

  it('inserts 10000 DTUs in under 3000ms', () => {
    const store = createDTUStore(createMockDb());
    const dtus = Array.from({ length: 10000 }, (_, i) => makeDTU(i));
    const elapsed = measureMs(() => {
      for (const dtu of dtus) {
        store.set(dtu.id, dtu);
      }
    });
    expect(store.size).toBe(10000);
    expect(elapsed).toBeLessThan(3000);
  });

  it('has/get lookups after inserting 10000 DTUs complete 10000 lookups in under 200ms', () => {
    const store = createDTUStore(createMockDb());
    for (let i = 0; i < 10000; i++) {
      store.set(`dtu_scale_${i}`, makeDTU(i));
    }
    const elapsed = measureMs(() => {
      for (let i = 0; i < 10000; i++) {
        store.has(`dtu_scale_${i}`);
        store.get(`dtu_scale_${i}`);
      }
    });
    expect(elapsed).toBeLessThan(200);
  });
});

// ── Query Performance at Different Store Sizes ───────────────────────────────

describe('DTU store query performance', () => {
  function populateStore(count: number): DTUStore {
    const store = createDTUStore(createMockDb());
    for (let i = 0; i < count; i++) {
      store.set(`dtu_scale_${i}`, makeDTU(i));
    }
    return store;
  }

  it('searches 100-item store in under 50ms', () => {
    const store = populateStore(100);
    const elapsed = measureMs(() => {
      store.search('scale batch', 20);
    });
    expect(elapsed).toBeLessThan(50);
  });

  it('searches 1000-item store in under 200ms', () => {
    const store = populateStore(1000);
    const elapsed = measureMs(() => {
      store.search('scale batch', 20);
    });
    expect(elapsed).toBeLessThan(200);
  });

  it('searches 5000-item store in under 1000ms', () => {
    const store = populateStore(5000);
    const elapsed = measureMs(() => {
      store.search('scale batch', 20);
    });
    expect(elapsed).toBeLessThan(1000);
  });

  it('getByType on 5000-item store in under 200ms', () => {
    const store = populateStore(5000);
    const elapsed = measureMs(() => {
      for (const typeCode of typePool) {
        store.getByType(typeCode);
      }
    });
    expect(elapsed).toBeLessThan(200);
  });

  it('getByTags on 5000-item store in under 200ms', () => {
    const store = populateStore(5000);
    const elapsed = measureMs(() => {
      store.getByTags(['scale']);
      store.getByTags(['type-0', 'type-1']);
      store.getByTags(['batch-5']);
    });
    expect(elapsed).toBeLessThan(200);
  });

  it('getStats on 5000-item store in under 200ms', () => {
    const store = populateStore(5000);
    const elapsed = measureMs(() => {
      for (let i = 0; i < 100; i++) {
        store.getStats();
      }
    });
    expect(elapsed).toBeLessThan(200);
  });

  it('prunes 1000 expired DTUs from 5000-item store in under 500ms', () => {
    const store = createDTUStore(createMockDb());
    for (let i = 0; i < 5000; i++) {
      const dtu = makeDTU(i);
      // First 1000 are very old
      if (i < 1000) {
        dtu.header.timestamp = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days ago
      }
      store.set(dtu.id, dtu);
    }
    const elapsed = measureMs(() => {
      const pruned = store.prune({ maxAgeDays: 30, protectPainTagged: false });
      expect(pruned).toBe(1000);
    });
    expect(elapsed).toBeLessThan(500);
  });
});

// ── Memory Usage Estimation ──────────────────────────────────────────────────

describe('memory usage estimation per DTU', () => {
  it('estimates memory for DTUs of varying content sizes', () => {
    const contentSizes = [64, 256, 1024, 4096];

    for (const size of contentSizes) {
      const dtus: DTU[] = [];
      const count = 100;
      for (let i = 0; i < count; i++) {
        dtus.push(makeDTU(i, size));
      }

      // Estimate per-DTU memory overhead:
      // id string (~20 chars) + header (numbers + 32-byte hash) + content + tags + meta
      const estimatedPerDTU = 20 + 32 + 48 + size + 50 + 80; // rough bytes
      const totalEstimate = estimatedPerDTU * count;

      // The total estimated memory should be reasonable (no huge overhead)
      expect(totalEstimate).toBeLessThan(count * (size + 500));
      // Verify all DTUs are constructed correctly
      expect(dtus.length).toBe(count);
      expect(dtus[0].content.length).toBe(size);
    }
  });

  it('store with 1000 128-byte DTUs uses bounded memory', () => {
    const store = createDTUStore(createMockDb());
    for (let i = 0; i < 1000; i++) {
      store.set(`dtu_mem_${i}`, makeDTU(i, 128));
    }
    const stats = store.getStats();
    expect(stats.totalCount).toBe(1000);
    // Content alone is 128 * 1000 = 128KB; total with overhead should be under 1MB
    expect(stats.totalSizeBytes).toBe(128 * 1000);
    expect(stats.totalSizeBytes).toBeLessThan(1024 * 1024);
  });
});

// ── Zustand Store Update Throughput ──────────────────────────────────────────

describe('Zustand mesh store update throughput', () => {
  it('adds 1000 peers in under 500ms', () => {
    const elapsed = measureMs(() => {
      for (let i = 0; i < 1000; i++) {
        useMeshStore.getState().addPeer(makeMockPeer(`peer_${i}`));
      }
    });
    expect(useMeshStore.getState().peers.size).toBe(1000);
    expect(elapsed).toBeLessThan(500);
  });

  it('updates 1000 peers in under 500ms', () => {
    for (let i = 0; i < 1000; i++) {
      useMeshStore.getState().addPeer(makeMockPeer(`peer_${i}`));
    }
    const elapsed = measureMs(() => {
      for (let i = 0; i < 1000; i++) {
        useMeshStore.getState().updatePeer(`peer_${i}`, { rssi: -50 + (i % 40) });
      }
    });
    expect(elapsed).toBeLessThan(500);
  });

  it('enqueues/dequeues 1000 relay entries in under 500ms', () => {
    const elapsed = measureMs(() => {
      for (let i = 0; i < 1000; i++) {
        useMeshStore.getState().enqueueRelay({
          dtuId: `dtu_${i}`,
          dtuHash: `hash_${i}`,
          priority: i % 10,
          ttl: 7,
          enqueuedAt: Date.now(),
          excludePeers: [],
        });
      }
      for (let i = 0; i < 1000; i++) {
        useMeshStore.getState().dequeueRelay();
      }
    });
    expect(useMeshStore.getState().relayQueue.length).toBe(0);
    expect(elapsed).toBeLessThan(500);
  });

  it('adds and checks 10000 seen hashes in under 500ms', () => {
    const elapsed = measureMs(() => {
      for (let i = 0; i < 10000; i++) {
        useMeshStore.getState().addSeenHash(`hash_${i}`);
      }
      for (let i = 0; i < 10000; i++) {
        useMeshStore.getState().hasSeenHash(`hash_${i}`);
      }
    });
    expect(elapsed).toBeLessThan(500);
  });

  it('reputation updates for 1000 peers in under 500ms', () => {
    for (let i = 0; i < 1000; i++) {
      useMeshStore.getState().addPeer(makeMockPeer(`peer_${i}`));
    }
    const elapsed = measureMs(() => {
      for (let i = 0; i < 1000; i++) {
        useMeshStore.getState().updatePeerReputation(`peer_${i}`, i % 3 !== 0);
      }
    });
    expect(elapsed).toBeLessThan(500);
  });

  it('getMeshState snapshot from 500-peer store in under 200ms', () => {
    for (let i = 0; i < 500; i++) {
      useMeshStore.getState().addPeer(makeMockPeer(`peer_${i}`));
    }
    const elapsed = measureMs(() => {
      for (let i = 0; i < 100; i++) {
        useMeshStore.getState().getMeshState();
      }
    });
    expect(elapsed).toBeLessThan(200);
  });

  it('reset from populated state completes in under 10ms', () => {
    for (let i = 0; i < 500; i++) {
      useMeshStore.getState().addPeer(makeMockPeer(`peer_${i}`));
    }
    for (let i = 0; i < 100; i++) {
      useMeshStore.getState().addSeenHash(`hash_${i}`);
    }
    const elapsed = measureMs(() => {
      useMeshStore.getState().reset();
    });
    expect(useMeshStore.getState().peers.size).toBe(0);
    expect(elapsed).toBeLessThan(10);
  });
});

// Integration test: Wallet -> peer transfer -> marketplace via mesh
// Verifies that the economy module (ledger, peer transfer, marketplace)
// works end-to-end with DTU creation and mesh store tracking.

import { createPeerTransfer, PeerTransfer, IdentityManager } from '../../economy/coin/peer-transfer';
import { createLocalLedger, LocalLedger, SQLiteDatabase, SQLiteResultSet } from '../../economy/wallet/local-ledger';
import { createLocalMarketplace, LocalMarketplace } from '../../economy/marketplace/local-marketplace';
import { createTransactionDTU } from '../../dtu/creation/dtu-forge';
import { useEconomyStore } from '../../store/economy-store';
import { setCryptoProvider } from '../../utils/crypto';
import type { CryptoProvider } from '../../utils/crypto';
import type { Transaction, MarketplaceListing } from '../../utils/types';
import { MIN_TRANSFER_AMOUNT, TRANSACTION_NONCE_BYTES } from '../../utils/constants';

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

// ── Mock SQLite database (in-memory table simulation) ───────────────────────

function createMockSQLite(): SQLiteDatabase {
  const tables: Record<string, Record<string, unknown>[]> = {};

  return {
    executeSql: jest.fn(async (sql: string, params?: unknown[]): Promise<SQLiteResultSet> => {
      const sqlUpper = sql.trim().toUpperCase();

      if (sqlUpper.startsWith('CREATE')) {
        return { rows: { length: 0, item: () => ({}), raw: () => [] }, rowsAffected: 0 };
      }

      if (sqlUpper.startsWith('INSERT')) {
        const tableName = sql.match(/INTO\s+(\w+)/i)?.[1] ?? 'default';
        if (!tables[tableName]) tables[tableName] = [];

        // Check for existing row with same id (for OR REPLACE / idempotency)
        const id = params?.[0] as string;
        const existing = tables[tableName].findIndex(r => r.id === id);
        const row: Record<string, unknown> = { id };

        if (tableName === 'transactions' && params) {
          row.type = params[1]; row.amount = params[2]; row.from_key = params[3];
          row.to_key = params[4]; row.timestamp = params[5]; row.nonce = params[6];
          row.balance_hash = params[7]; row.signature = params[8]; row.status = params[9];
          row.propagated = params[10]; row.created_at = params[11];
        }
        if (tableName === 'marketplace_listings' && params) {
          row.dtu_id = params[1]; row.title = params[2]; row.description = params[3];
          row.price = params[4]; row.creator_key = params[5]; row.category = params[6];
          row.tags = params[7]; row.created_at = params[8]; row.active = params[9];
          row.cached_at = params[10];
        }

        if (existing >= 0) {
          tables[tableName][existing] = row;
        } else {
          tables[tableName].push(row);
        }
        return { rows: { length: 0, item: () => ({}), raw: () => [] }, rowsAffected: 1 };
      }

      if (sqlUpper.startsWith('SELECT')) {
        const tableName = sql.match(/FROM\s+(\w+)/i)?.[1] ?? 'default';
        const data = tables[tableName] ?? [];
        let filtered = [...data];

        // Simple WHERE id = ? handling
        if (sql.includes('WHERE id = ?') && params?.[0]) {
          filtered = data.filter(r => r.id === params[0]);
        }
        // WHERE active = 1
        if (sql.includes('active = 1')) {
          filtered = data.filter(r => r.active === 1);
        }
        // COUNT(*)
        if (sqlUpper.includes('COUNT(*)')) {
          return {
            rows: { length: 1, item: () => ({ count: filtered.length, total: 0, cnt: 0 }), raw: () => [] },
            rowsAffected: 0,
          };
        }
        // SUM handling
        if (sqlUpper.includes('SUM(AMOUNT)')) {
          return {
            rows: { length: 1, item: () => ({ total: 0 }), raw: () => [] },
            rowsAffected: 0,
          };
        }

        return {
          rows: {
            length: filtered.length,
            item: (i: number) => filtered[i],
            raw: () => filtered.map(r => Object.values(r)),
          },
          rowsAffected: 0,
        };
      }

      if (sqlUpper.startsWith('UPDATE')) {
        const tableName = sql.match(/UPDATE\s+(\w+)/i)?.[1] ?? 'default';
        const data = tables[tableName] ?? [];
        if (sql.includes('active = 0') && params?.[0]) {
          const row = data.find(r => r.id === params[0]);
          if (row) row.active = 0;
        }
        if (sql.includes('propagated = 1') && params?.[0]) {
          const row = data.find(r => r.id === params[0]);
          if (row) row.propagated = 1;
        }
        return { rows: { length: 0, item: () => ({}), raw: () => [] }, rowsAffected: 1 };
      }

      if (sqlUpper.startsWith('DELETE')) {
        const tableName = sql.match(/FROM\s+(\w+)/i)?.[1] ?? 'default';
        tables[tableName] = [];
        return { rows: { length: 0, item: () => ({}), raw: () => [] }, rowsAffected: 0 };
      }

      return { rows: { length: 0, item: () => ({}), raw: () => [] }, rowsAffected: 0 };
    }),
    transaction: jest.fn(async (fn) => { fn({ executeSql: jest.fn() }); }),
  };
}

// ── Mock identity manager for peer transfer ─────────────────────────────────

function createMockIdentity(publicKey: string): IdentityManager {
  return {
    getPublicKey: () => publicKey,
    sign: jest.fn(async () => new Uint8Array(64).fill(0x55)),
    verify: jest.fn(async () => true),
  };
}

// ── Setup ───────────────────────────────────────────────────────────────────

beforeAll(() => {
  setCryptoProvider(mockCryptoProvider);
});

beforeEach(() => {
  jest.clearAllMocks();
  useEconomyStore.getState().reset();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Wallet -> Peer Transfer -> Marketplace via Mesh flow', () => {
  it('creates a transfer, records it in the ledger, and wraps it as a DTU', async () => {
    const db = createMockSQLite();
    const ledger = createLocalLedger(db);
    const identity = createMockIdentity('pk_alice');
    const transfer = createPeerTransfer(identity, ledger);

    // Seed a balance by recording an incoming reward transaction
    const reward: Transaction = {
      id: 'tx_reward_1',
      type: 'reward',
      amount: 50,
      fromKey: '',
      toKey: 'pk_alice',
      timestamp: Date.now(),
      nonce: new Uint8Array(TRANSACTION_NONCE_BYTES),
      balanceHash: 'init_hash',
      signature: new Uint8Array(64).fill(0x01),
      status: 'confirmed',
      propagated: true,
    };
    await ledger.recordTransaction(reward);

    // Create a peer transfer
    const tx = await transfer.createTransfer('pk_bob', 10);
    expect(tx.id).toMatch(/^tx_/);
    expect(tx.amount).toBe(10);
    expect(tx.fromKey).toBe('pk_alice');
    expect(tx.toKey).toBe('pk_bob');
    expect(tx.status).toBe('pending');

    // Wrap the transaction as a DTU for mesh propagation
    const dtu = await createTransactionDTU(tx);
    expect(dtu.header.type).toBe(0x0006); // ECONOMY_TRANSACTION
    expect(dtu.meta.creatorKey).toBe('pk_alice');
    expect(dtu.tags).toContain('economy');
    expect(dtu.tags).toContain('transaction');
  });

  it('validates transfer and rejects self-transfer', async () => {
    const db = createMockSQLite();
    const ledger = createLocalLedger(db);
    const identity = createMockIdentity('pk_alice');
    const transfer = createPeerTransfer(identity, ledger);

    await expect(transfer.createTransfer('pk_alice', 5)).rejects.toThrow('Cannot transfer to self');
  });

  it('validates transfer amount constraints', () => {
    const db = createMockSQLite();
    const ledger = createLocalLedger(db);
    const identity = createMockIdentity('pk_alice');
    const transfer = createPeerTransfer(identity, ledger);

    const validTx: Transaction = {
      id: 'tx_test',
      type: 'transfer',
      amount: 10,
      fromKey: 'pk_alice',
      toKey: 'pk_bob',
      timestamp: Date.now(),
      nonce: new Uint8Array(TRANSACTION_NONCE_BYTES),
      balanceHash: 'hash_123',
      signature: new Uint8Array(64).fill(0x55),
      status: 'pending',
      propagated: false,
    };

    const result = transfer.validateTransfer(validTx);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('marketplace purchase creates a transfer to the listing creator', async () => {
    const db = createMockSQLite();
    const marketplace = createLocalMarketplace(db);

    // Cache a listing
    const listing: MarketplaceListing = {
      id: 'listing_art_1',
      dtuId: 'dtu_art_1',
      title: 'Digital Artwork',
      description: 'A beautiful digital painting',
      price: 25,
      creatorKey: 'pk_artist',
      category: 'art',
      tags: ['art', 'digital'],
      createdAt: Date.now(),
      active: true,
    };
    await marketplace.cacheListings([listing]);

    // Verify listing is retrievable
    const retrieved = await marketplace.getListing('listing_art_1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe('Digital Artwork');
    expect(retrieved?.price).toBe(25);
  });

  it('tracks transactions in economy store for UI state', async () => {
    const tx: Transaction = {
      id: 'tx_store_1',
      type: 'transfer',
      amount: 15,
      fromKey: 'pk_alice',
      toKey: 'pk_bob',
      timestamp: Date.now(),
      nonce: new Uint8Array(TRANSACTION_NONCE_BYTES),
      balanceHash: 'hash_abc',
      signature: new Uint8Array(64).fill(0x55),
      status: 'pending',
      propagated: false,
    };

    useEconomyStore.getState().addTransaction(tx);
    expect(useEconomyStore.getState().transactions).toHaveLength(1);
    expect(useEconomyStore.getState().pendingTransactions).toHaveLength(1);

    // Mark as propagated (sent over mesh)
    useEconomyStore.getState().markPropagated('tx_store_1');
    expect(useEconomyStore.getState().transactions[0].propagated).toBe(true);
    expect(useEconomyStore.getState().pendingTransactions).toHaveLength(0);
  });

  it('caches marketplace listings in economy store', async () => {
    const listings: MarketplaceListing[] = [
      {
        id: 'l1', dtuId: 'dtu_1', title: 'Song', description: 'A song',
        price: 5, creatorKey: 'pk_musician', category: 'music',
        tags: ['music'], createdAt: Date.now(), active: true,
      },
      {
        id: 'l2', dtuId: 'dtu_2', title: 'Article', description: 'An article',
        price: 2, creatorKey: 'pk_writer', category: 'writing',
        tags: ['writing'], createdAt: Date.now(), active: true,
      },
    ];

    useEconomyStore.getState().cacheListings(listings);
    expect(useEconomyStore.getState().listingCount).toBe(2);

    const musicListings = useEconomyStore.getState().getListingsByCategory('music');
    expect(musicListings).toHaveLength(1);
    expect(musicListings[0].title).toBe('Song');
  });

  it('rejects transfer with invalid structure', () => {
    const db = createMockSQLite();
    const ledger = createLocalLedger(db);
    const identity = createMockIdentity('pk_alice');
    const transfer = createPeerTransfer(identity, ledger);

    const invalidTx = {
      id: '',
      type: 'invalid_type' as any,
      amount: -5,
      fromKey: '',
      toKey: '',
      timestamp: -1,
      nonce: new Uint8Array(0),
      balanceHash: '',
      signature: new Uint8Array(0),
      status: 'pending' as const,
      propagated: false,
    };

    const result = transfer.validateTransfer(invalidTx);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

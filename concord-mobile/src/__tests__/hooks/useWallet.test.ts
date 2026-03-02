// Tests for useWallet hook

import { renderHook } from '@testing-library/react-native';
import { useWallet } from '../../hooks/useWallet';
import { useEconomyStore } from '../../store/economy-store';
import type { CoinBalance, Transaction, TransactionType } from '../../utils/types';

jest.mock('../../store/economy-store');

const mockUseEconomyStore = useEconomyStore as unknown as jest.Mock;

const defaultBalance: CoinBalance = {
  available: 0,
  pending: 0,
  total: 0,
  lastUpdated: 0,
};

function createTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-001',
    type: 'transfer',
    amount: 10.5,
    fromKey: 'key-sender',
    toKey: 'key-receiver',
    timestamp: 1700000000000,
    nonce: new Uint8Array(16),
    balanceHash: 'hash-abc',
    signature: new Uint8Array(64),
    status: 'confirmed',
    propagated: true,
    ...overrides,
  };
}

const sampleTransactions: Transaction[] = [
  createTransaction({ id: 'tx-001', type: 'transfer', amount: 10.5, propagated: true }),
  createTransaction({ id: 'tx-002', type: 'royalty', amount: 2.0, propagated: true }),
  createTransaction({ id: 'tx-003', type: 'transfer', amount: -5.0, propagated: false }),
  createTransaction({ id: 'tx-004', type: 'marketplace_purchase', amount: -20.0, propagated: false }),
  createTransaction({ id: 'tx-005', type: 'reward', amount: 1.0, status: 'pending', propagated: false }),
];

interface MockEconomyState {
  balance: CoinBalance;
  transactions: Transaction[];
  pendingTransactions: Transaction[];
  getUnpropagated: () => Transaction[];
  getTransactionsByType: (type: TransactionType) => Transaction[];
}

function setupStoreMock(overrides: Partial<MockEconomyState> = {}) {
  const transactions = overrides.transactions ?? [];
  const state: MockEconomyState = {
    balance: overrides.balance ?? { ...defaultBalance },
    transactions,
    pendingTransactions: overrides.pendingTransactions ?? [],
    getUnpropagated: overrides.getUnpropagated ?? (() => transactions.filter(tx => !tx.propagated)),
    getTransactionsByType: overrides.getTransactionsByType ??
      ((type: TransactionType) => transactions.filter(tx => tx.type === type)),
  };

  mockUseEconomyStore.mockImplementation((selector: (s: MockEconomyState) => any) => {
    return selector(state);
  });
}

describe('useWallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('balance', () => {
    it('returns zero balance by default', () => {
      setupStoreMock();
      const { result } = renderHook(() => useWallet());
      expect(result.current.balance).toEqual(defaultBalance);
    });

    it('returns the balance from the store', () => {
      const balance: CoinBalance = {
        available: 100.5,
        pending: 20.0,
        total: 120.5,
        lastUpdated: 1700000000000,
      };
      setupStoreMock({ balance });
      const { result } = renderHook(() => useWallet());
      expect(result.current.balance.available).toBe(100.5);
      expect(result.current.balance.pending).toBe(20.0);
      expect(result.current.balance.total).toBe(120.5);
    });
  });

  describe('transactions', () => {
    it('returns empty transactions list by default', () => {
      setupStoreMock();
      const { result } = renderHook(() => useWallet());
      expect(result.current.transactions).toEqual([]);
    });

    it('returns all transactions from the store', () => {
      setupStoreMock({ transactions: sampleTransactions });
      const { result } = renderHook(() => useWallet());
      expect(result.current.transactions).toHaveLength(5);
    });
  });

  describe('pendingCount', () => {
    it('returns zero when no pending transactions', () => {
      setupStoreMock({ pendingTransactions: [] });
      const { result } = renderHook(() => useWallet());
      expect(result.current.pendingCount).toBe(0);
    });

    it('returns the count of pending transactions', () => {
      const pending = [
        createTransaction({ id: 'tx-p1', status: 'pending' }),
        createTransaction({ id: 'tx-p2', status: 'pending' }),
      ];
      setupStoreMock({ pendingTransactions: pending });
      const { result } = renderHook(() => useWallet());
      expect(result.current.pendingCount).toBe(2);
    });
  });

  describe('unpropagatedCount', () => {
    it('returns zero when all transactions are propagated', () => {
      const txs = [
        createTransaction({ id: 'tx-1', propagated: true }),
        createTransaction({ id: 'tx-2', propagated: true }),
      ];
      setupStoreMock({ transactions: txs });
      const { result } = renderHook(() => useWallet());
      expect(result.current.unpropagatedCount).toBe(0);
    });

    it('returns the count of unpropagated transactions', () => {
      setupStoreMock({ transactions: sampleTransactions });
      const { result } = renderHook(() => useWallet());
      // tx-003, tx-004, tx-005 are unpropagated
      expect(result.current.unpropagatedCount).toBe(3);
    });
  });

  describe('getTransactionsByType', () => {
    it('filters transactions by transfer type', () => {
      setupStoreMock({ transactions: sampleTransactions });
      const { result } = renderHook(() => useWallet());
      const transfers = result.current.getTransactionsByType('transfer');
      expect(transfers).toHaveLength(2);
      expect(transfers.every(tx => tx.type === 'transfer')).toBe(true);
    });

    it('filters transactions by royalty type', () => {
      setupStoreMock({ transactions: sampleTransactions });
      const { result } = renderHook(() => useWallet());
      const royalties = result.current.getTransactionsByType('royalty');
      expect(royalties).toHaveLength(1);
      expect(royalties[0].id).toBe('tx-002');
    });

    it('filters transactions by marketplace_purchase type', () => {
      setupStoreMock({ transactions: sampleTransactions });
      const { result } = renderHook(() => useWallet());
      const purchases = result.current.getTransactionsByType('marketplace_purchase');
      expect(purchases).toHaveLength(1);
      expect(purchases[0].id).toBe('tx-004');
    });

    it('filters transactions by reward type', () => {
      setupStoreMock({ transactions: sampleTransactions });
      const { result } = renderHook(() => useWallet());
      const rewards = result.current.getTransactionsByType('reward');
      expect(rewards).toHaveLength(1);
      expect(rewards[0].id).toBe('tx-005');
    });

    it('returns empty array for type with no matches', () => {
      setupStoreMock({ transactions: [] });
      const { result } = renderHook(() => useWallet());
      const rewards = result.current.getTransactionsByType('reward');
      expect(rewards).toEqual([]);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the api client
vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock the socket hook
const mockOn = vi.fn();
const mockOff = vi.fn();
vi.mock('@/hooks/useSocket', () => ({
  useSocket: vi.fn(() => ({
    socket: null,
    isConnected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: mockOn,
    off: mockOff,
  })),
}));

import { useCreativeRegistry } from '@/hooks/useCreativeRegistry';
import { api } from '@/lib/api/client';

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe('useCreativeRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('returns empty entries while loading', () => {
      mockedApi.post.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useCreativeRegistry('art'), {
        wrapper: createWrapper(),
      });

      expect(result.current.entries).toEqual([]);
      expect(result.current.total).toBe(0);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('successful fetch', () => {
    it('fetches creative registry entries for a domain', async () => {
      const mockResponse = {
        ok: true,
        domain: 'art',
        entries: [
          {
            dtuId: 'dtu-1',
            registeredAt: '2026-01-01',
            contentType: 'image',
            title: 'Test Art',
            creator: 'user-1',
            tier: 'regular',
            dtu: null,
          },
        ],
        total: 1,
        hasMore: false,
      };

      mockedApi.post.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(() => useCreativeRegistry('art'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0].dtuId).toBe('dtu-1');
      expect(result.current.total).toBe(1);
      expect(result.current.hasMore).toBe(false);
    });

    it('passes contentType filter to API', async () => {
      mockedApi.post.mockResolvedValue({
        data: { ok: true, domain: 'music', entries: [], total: 0, hasMore: false },
      });

      const { result } = renderHook(
        () => useCreativeRegistry('music', 'audio'),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.post).toHaveBeenCalledWith('/api/creative/registry', {
        domain: 'music',
        contentType: 'audio',
        limit: 30,
      });
    });
  });

  describe('disabled state', () => {
    it('does not fetch when domain is empty', async () => {
      const { result } = renderHook(() => useCreativeRegistry(''), {
        wrapper: createWrapper(),
      });

      // Wait a tick to ensure query has settled
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockedApi.post).not.toHaveBeenCalled();
      expect(result.current.entries).toEqual([]);
    });
  });

  describe('return shape', () => {
    it('returns refetch function and data fields', async () => {
      mockedApi.post.mockResolvedValue({
        data: { ok: true, domain: 'art', entries: [], total: 0, hasMore: false },
      });

      const { result } = renderHook(() => useCreativeRegistry('art'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(typeof result.current.refetch).toBe('function');
      expect(result.current).toHaveProperty('entries');
      expect(result.current).toHaveProperty('total');
      expect(result.current).toHaveProperty('hasMore');
    });
  });

  describe('socket subscription', () => {
    it('subscribes to creative_registry:update on mount and unsubscribes on unmount', async () => {
      mockedApi.post.mockResolvedValue({
        data: { ok: true, domain: 'art', entries: [], total: 0, hasMore: false },
      });

      const { unmount } = renderHook(() => useCreativeRegistry('art'), {
        wrapper: createWrapper(),
      });

      // Should have subscribed to creative_registry:update
      expect(mockOn).toHaveBeenCalledWith('creative_registry:update', expect.any(Function));

      unmount();

      // Should have unsubscribed on unmount
      expect(mockOff).toHaveBeenCalledWith('creative_registry:update', expect.any(Function));
    });
  });
});

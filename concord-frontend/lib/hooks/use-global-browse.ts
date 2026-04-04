'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

interface GlobalDTU {
  id: string;
  title: string;
  domain: string;
  tier: string;
  tags: string[];
  authority: { score: number };
  createdAt: string;
}

interface BrowseResult {
  dtus: GlobalDTU[];
  total: number;
  page: number;
  hasMore: boolean;
}

export function useGlobalBrowse(params?: { domain?: string; search?: string; page?: number }) {
  const qc = useQueryClient();

  const browse = useQuery({
    queryKey: ['global', 'browse', params],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params?.domain) qs.set('domain', params.domain);
      if (params?.search) qs.set('search', params.search);
      if (params?.page) qs.set('page', String(params.page));
      return api.get(`/api/global/browse?${qs}`).then(r => r.data as BrowseResult);
    },
    staleTime: 30_000,
  });

  const syncToUniverse = useMutation({
    mutationFn: (dtuIds: string[]) =>
      api.post('/api/global/sync', { dtuIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['universe'] });
      qc.invalidateQueries({ queryKey: ['global'] });
    },
  });

  const submitToCouncil = useMutation({
    mutationFn: (data: { dtuId: string; reason?: string }) =>
      api.post('/api/global/submit', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['global'] }),
  });

  return {
    dtus: browse.data?.dtus ?? [],
    total: browse.data?.total ?? 0,
    hasMore: browse.data?.hasMore ?? false,
    isLoading: browse.isLoading,
    syncToUniverse,
    submitToCouncil,
    refetch: browse.refetch,
  };
}

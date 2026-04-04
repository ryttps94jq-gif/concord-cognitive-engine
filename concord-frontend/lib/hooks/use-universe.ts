'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

interface UniverseStats {
  initialized: boolean;
  mode: string;
  dtuCount: number;
  domains: string[];
  createdAt: string;
}

export function useUniverse() {
  const qc = useQueryClient();

  const stats = useQuery({
    queryKey: ['universe', 'stats'],
    queryFn: () => api.get('/api/universe/stats').then(r => r.data as UniverseStats),
    staleTime: 60_000,
  });

  const initialize = useMutation({
    mutationFn: (data: { mode: string; domains?: string[] }) =>
      api.post('/api/universe/initialize', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['universe'] }),
  });

  const updatePreferences = useMutation({
    mutationFn: (prefs: Record<string, unknown>) =>
      api.put('/api/universe/preferences', prefs),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['universe'] }),
  });

  return {
    stats: stats.data,
    isLoading: stats.isLoading,
    isInitialized: stats.data?.initialized ?? false,
    initialize,
    updatePreferences,
    refetch: stats.refetch,
  };
}

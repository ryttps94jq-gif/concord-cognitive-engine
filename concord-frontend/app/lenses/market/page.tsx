'use client';

import { useLensNav } from '@/hooks/useLensNav';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiHelpers } from '@/lib/api/client';
import { MarketEmpireListing } from '@/components/market/MarketEmpireListing';
import { Store, TrendingUp, Package, Coins } from 'lucide-react';
import { ErrorState } from '@/components/common/EmptyState';

interface MarketListingItem {
  id: string;
  title?: string;
  description?: string;
  price?: number;
  seller?: string;
  createdAt?: string;
  tags?: string[];
  type?: string;
}

export default function MarketLensPage() {
  useLensNav('market');
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newType, setNewType] = useState('beat');

  // Backend: GET /api/marketplace/listings
  const { data: listings, isLoading, isError: isError, error: error, refetch: refetch,} = useQuery({
    queryKey: ['marketplace-listings'],
    queryFn: () => apiHelpers.marketplace.listings().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { title: string; description: string; price: number; type: string }) =>
      apiHelpers.marketplace.submit(payload as unknown as { name: string; githubUrl: string; description?: string; category?: string }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      setShowCreate(false);
      setNewTitle('');
      setNewDescription('');
      setNewPrice('');
      setNewType('beat');
    },
    onError: (err) => console.error('createMutation failed:', err instanceof Error ? err.message : err),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <p className="text-gray-400 animate-pulse">Loading marketplace data...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <ErrorState error={error?.message} onRetry={refetch} />
      </div>
    );
  }
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏪</span>
          <div>
            <h1 className="text-xl font-bold">Market Lens</h1>
            <p className="text-sm text-gray-400">
              DTU marketplace, listings, and economy simulation
            </p>
          </div>
        </div>
        <button className="btn-neon purple" onClick={() => setShowCreate(!showCreate)}>
          <Store className="w-4 h-4 mr-2 inline" />
          Create Listing
        </button>
      </header>

      {/* Create Listing Form */}
      {showCreate && (
        <div className="panel p-4 space-y-3">
          <h2 className="font-semibold">New Listing</h2>
          <input
            className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm focus:border-neon-purple outline-none"
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <textarea
            className="w-full px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm focus:border-neon-purple outline-none resize-none"
            placeholder="Description"
            rows={2}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <div className="flex gap-3">
            <input
              className="flex-1 px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm focus:border-neon-purple outline-none"
              placeholder="Price"
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
            />
            <select
              className="px-3 py-2 bg-lattice-surface border border-lattice-border rounded-lg text-sm"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            >
              <option value="beat">Beat</option>
              <option value="stem">Stem</option>
              <option value="sample">Sample</option>
              <option value="artwork">Artwork</option>
            </select>
          </div>
          {createMutation.isError && (
            <p className="text-xs text-red-400">
              {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create listing'}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
            <button
              className="btn-neon purple text-sm"
              disabled={!newTitle.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  title: newTitle.trim(),
                  description: newDescription.trim(),
                  price: Number(newPrice) || 0,
                  type: newType,
                })
              }
            >
              {createMutation.isPending ? 'Creating...' : 'Submit Listing'}
            </button>
          </div>
        </div>
      )}

      {/* Market Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Store />} label="Active Listings" value={listings?.listings?.length || 0} />
        <StatCard icon={<Package />} label="Your Library" value={listings?.library?.length ?? 0} />
        <StatCard icon={<TrendingUp />} label="Transactions" value={listings?.transactions ?? 0} />
        <StatCard icon={<Coins />} label="Volume" value={listings?.volume ?? 0} />
      </div>

      {/* Listings Grid */}
      <div className="panel p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-neon-green" />
          Active Listings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings?.listings?.length === 0 ? (
            <p className="col-span-full text-center py-8 text-gray-500">
              No listings yet. Create the first marketplace listing!
            </p>
          ) : (
            listings?.listings?.map((listing: MarketListingItem) => (
              <MarketEmpireListing key={listing.id} listing={listing} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="lens-card">
      <div className="flex items-center justify-between">
        <span className="text-neon-green">{icon}</span>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="text-sm text-gray-400 mt-2">{label}</p>
    </div>
  );
}

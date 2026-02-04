export default function LensLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-lattice-surface rounded-lg mb-2" />
          <div className="h-4 w-32 bg-lattice-surface/50 rounded" />
        </div>
        <div className="h-10 w-24 bg-lattice-surface rounded-lg" />
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-40 bg-lattice-surface rounded-xl"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>

      {/* Bottom section skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-lattice-surface rounded-xl" />
        <div className="h-64 bg-lattice-surface rounded-xl" />
      </div>
    </div>
  );
}

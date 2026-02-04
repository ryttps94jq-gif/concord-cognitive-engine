import { Brain } from 'lucide-react';

export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-lattice-void flex items-center justify-center">
      <div className="text-center">
        {/* Animated logo */}
        <div className="relative inline-flex items-center justify-center mb-6">
          {/* Outer ring */}
          <div className="absolute w-20 h-20 rounded-full border-2 border-neon-cyan/30 animate-ping" />

          {/* Middle ring */}
          <div className="absolute w-16 h-16 rounded-full border border-neon-blue/50 animate-pulse" />

          {/* Inner circle with icon */}
          <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-neon-cyan/20 to-neon-blue/20 flex items-center justify-center">
            <Brain className="w-6 h-6 text-neon-cyan animate-pulse" />
          </div>
        </div>

        {/* Loading text */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-white">Loading Concord</h2>
          <div className="flex items-center justify-center gap-1">
            <span className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import dynamic from 'next/dynamic';
import { SkeletonGraph } from '@/components/common/Skeleton';

/**
 * InteractiveGraph — lazy-loaded wrapper.
 *
 * The actual Cytoscape.js implementation lives in InteractiveGraphCore.tsx
 * and is loaded on-demand via next/dynamic with SSR disabled
 * (Cytoscape requires a browser DOM environment).
 */

const InteractiveGraph = dynamic(
  () =>
    import('./InteractiveGraphCore').then((mod) => ({
      default: mod.InteractiveGraph,
    })),
  {
    ssr: false,
    loading: () => <SkeletonGraph />,
  }
);

export { InteractiveGraph };
export default InteractiveGraph;

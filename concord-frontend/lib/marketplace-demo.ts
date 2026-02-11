/**
 * FE-006: Marketplace demo/mock data — DISABLED.
 *
 * Demo data has been removed. The marketplace now fetches exclusively from
 * the backend API (/api/artistry/marketplace/*). Components that previously
 * fell back to demo data will render an empty state instead.
 *
 * The interfaces and helper functions are retained for type compatibility.
 */

export interface DemoPlugin {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  author: { name: string; avatar?: string; verified?: boolean };
  githubUrl?: string;
  version: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  status: 'approved' | 'pending_review' | 'rejected' | 'draft';
  featured?: boolean;
  trending?: boolean;
  price?: number;
  tags?: string[];
  permissions?: string[];
  changelog?: { version: string; date: string; changes: string[] }[];
  createdAt: string;
  updatedAt: string;
  weeklyDownloads?: number;
}

export interface DemoReview {
  id: string;
  pluginId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  helpful: number;
  createdAt: string;
}

/** @deprecated Demo data disabled — marketplace uses real API data only. */
export const DEMO_FEATURED: DemoPlugin[] = [];

/** @deprecated Demo data disabled — marketplace uses real API data only. */
export const DEMO_PLUGINS: DemoPlugin[] = [];

/** @deprecated Demo data disabled — marketplace uses real API data only. */
export const DEMO_REVIEWS: DemoReview[] = [];

/** Returns true when the marketplace API returned an error and we fell back to demo data. */
export function isDemoMode(apiData: unknown): boolean {
  return !apiData || (typeof apiData === 'object' && apiData !== null && '_demo' in apiData);
}

/** Wraps demo data with a `_demo` flag so consumers can detect it. */
export function asDemoResponse<T>(data: T): T & { _demo: true } {
  return { ...data, _demo: true as const };
}

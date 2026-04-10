/**
 * Centralized permission logic — single source of truth.
 *
 * Rules:
 *  - Authenticated users can view and use ALL lenses except:
 *    • "admin" lens → admin + sovereign only
 *    • "command-center" lens → admin + sovereign only
 *  - Actions are sent to the backend which is the final authority.
 *  - The frontend never blocks display for authenticated users.
 *  - The frontend never pre-rejects actions — the backend decides.
 */

/** RBAC roles in the system (ascending privilege) */
export type Role = 'spectator' | 'member' | 'admin' | 'sovereign';

/** Lenses restricted to admin+ roles */
const ADMIN_ONLY_LENSES = new Set(['admin', 'command-center']);

/**
 * Can this user see the lens in navigation / render it?
 * Only admin and command-center are restricted (admin+sovereign).
 * Everything else is visible to all authenticated users.
 */
export function canViewLens(lensId: string, role: string): boolean {
  if (!role) return false;
  if (ADMIN_ONLY_LENSES.has(lensId)) {
    return role === 'admin' || role === 'sovereign' || role === 'owner' || role === 'founder';
  }
  return true;
}

/**
 * Can this user perform an action?
 * The frontend should almost never call this — actions go to the backend.
 * This exists only for the rare case where we want to hide an admin-only
 * button in the UI (not block it, just hide it for cleanliness).
 */
export function canDo(action: string, role: string): boolean {
  if (!role) return false;
  if (role === 'sovereign' || role === 'owner' || role === 'founder') return true;
  if (role === 'admin') return !action.startsWith('sovereign.');
  if (role === 'member') return !action.startsWith('sovereign.') && !action.startsWith('admin.');
  return false;
}

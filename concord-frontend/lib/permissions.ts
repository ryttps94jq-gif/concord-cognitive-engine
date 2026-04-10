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

/**
 * Can this user see the lens in navigation / render it?
 * Every lens is usable by default for ALL authenticated users.
 * Only exception: spectators (login page only).
 */
export function canViewLens(_lensId: string, role: string): boolean {
  if (!role || role === 'spectator') return false;
  return true;
}

/**
 * Can this user perform an action?
 * The frontend NEVER blocks actions. Everything goes to the backend.
 * The backend is the final authority. This always returns true for
 * authenticated users so the UI never pre-rejects.
 */
export function canDo(_action: string, role: string): boolean {
  if (!role || role === 'spectator') return false;
  return true;
}

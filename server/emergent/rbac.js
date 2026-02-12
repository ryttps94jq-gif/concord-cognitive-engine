/**
 * Concord — Enterprise RBAC & Access Controls
 *
 * Role-based permissions, organization workspaces,
 * private lenses per org, and audit log export.
 */

import crypto from "crypto";

// ── Role Definitions ─────────────────────────────────────────────────────

export const ROLES = Object.freeze({
  OWNER:      "owner",
  ADMIN:      "admin",
  EDITOR:     "editor",
  REVIEWER:   "reviewer",
  VIEWER:     "viewer",
  API_ONLY:   "api_only",
});

// Permissions each role has
const ROLE_PERMISSIONS = {
  owner: [
    "read", "write", "delete", "promote", "admin",
    "manage_members", "manage_roles", "manage_org",
    "export_audit", "manage_api_keys", "manage_lenses",
    "council_vote", "manage_webhooks", "manage_compliance",
    "view_analytics", "manage_workspaces",
  ],
  admin: [
    "read", "write", "delete", "promote",
    "manage_members", "manage_roles",
    "export_audit", "manage_api_keys", "manage_lenses",
    "council_vote", "manage_webhooks",
    "view_analytics", "manage_workspaces",
  ],
  editor: [
    "read", "write", "promote",
    "council_vote", "view_analytics",
    "manage_workspaces",
  ],
  reviewer: [
    "read", "council_vote", "view_analytics",
  ],
  viewer: [
    "read", "view_analytics",
  ],
  api_only: [
    "read", "write",
  ],
};

// ── RBAC State ───────────────────────────────────────────────────────────

function getRbacState(STATE) {
  if (!STATE._rbac) {
    STATE._rbac = {
      orgWorkspaces: new Map(),    // orgId → org workspace
      userRoles: new Map(),        // `${orgId}:${userId}` → role
      orgLenses: new Map(),        // orgId → Set<lensId>
      permissions: new Map(),      // `${orgId}:${userId}` → cached permissions
      auditLog: [],                // all RBAC audit events
      resourceACLs: new Map(),     // resourceId → { rules[] }

      metrics: {
        totalOrgs: 0,
        totalRoleAssignments: 0,
        permissionChecks: 0,
        permissionDenials: 0,
        auditExports: 0,
      },
    };
  }
  return STATE._rbac;
}

// ── Organization Workspaces ──────────────────────────────────────────────

export function createOrgWorkspace(STATE, input) {
  const rbac = getRbacState(STATE);

  const orgWorkspace = {
    id: input.orgId || `org_${crypto.randomBytes(6).toString("hex")}`,
    name: input.name || "New Organization",
    description: input.description || "",
    ownerId: input.ownerId,
    plan: input.plan || "free", // free, pro, enterprise
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      maxMembers: input.plan === "enterprise" ? 500 : (input.plan === "pro" ? 50 : 10),
      maxDtus: input.plan === "enterprise" ? 100000 : (input.plan === "pro" ? 10000 : 1000),
      dataRegion: input.dataRegion || "default",
      complianceLevel: input.complianceLevel || "standard",
      allowPublicDtus: input.allowPublicDtus ?? true,
    },
    memberCount: 1,
  };

  rbac.orgWorkspaces.set(orgWorkspace.id, orgWorkspace);

  // Set owner role
  rbac.userRoles.set(`${orgWorkspace.id}:${input.ownerId}`, ROLES.OWNER);
  rbac.metrics.totalOrgs++;
  rbac.metrics.totalRoleAssignments++;

  logRbacEvent(rbac, "ORG_CREATED", input.ownerId, orgWorkspace.id, { name: orgWorkspace.name });

  return { ok: true, orgWorkspace };
}

export function getOrgWorkspace(STATE, orgId) {
  const rbac = getRbacState(STATE);
  const org = rbac.orgWorkspaces.get(orgId);
  if (!org) return { ok: false, error: "Organization not found" };

  // Count members
  let memberCount = 0;
  for (const key of rbac.userRoles.keys()) {
    if (key.startsWith(`${orgId}:`)) memberCount++;
  }
  org.memberCount = memberCount;

  return { ok: true, orgWorkspace: org };
}

// ── Role Management ──────────────────────────────────────────────────────

/**
 * Assign a role to a user within an org.
 */
export function assignRole(STATE, orgId, userId, role, assignedBy) {
  const rbac = getRbacState(STATE);

  if (!Object.values(ROLES).includes(role)) {
    return { ok: false, error: `Invalid role: ${role}` };
  }

  const org = rbac.orgWorkspaces.get(orgId);
  if (!org) return { ok: false, error: "Organization not found" };

  // Check assigner has permission
  if (assignedBy) {
    const assignerRole = rbac.userRoles.get(`${orgId}:${assignedBy}`);
    if (!hasPermission(assignerRole, "manage_roles")) {
      return { ok: false, error: "Insufficient permissions to manage roles" };
    }
    // Cannot assign higher role than own
    const roleHierarchy = ["viewer", "api_only", "reviewer", "editor", "admin", "owner"];
    if (roleHierarchy.indexOf(role) > roleHierarchy.indexOf(assignerRole)) {
      return { ok: false, error: "Cannot assign a role higher than your own" };
    }
  }

  const key = `${orgId}:${userId}`;
  const previousRole = rbac.userRoles.get(key);
  rbac.userRoles.set(key, role);

  // Clear cached permissions
  rbac.permissions.delete(key);

  if (!previousRole) rbac.metrics.totalRoleAssignments++;

  logRbacEvent(rbac, "ROLE_ASSIGNED", assignedBy || "system", orgId, {
    userId, role, previousRole: previousRole || null,
  });

  return { ok: true, orgId, userId, role, previousRole };
}

export function revokeRole(STATE, orgId, userId, revokedBy) {
  const rbac = getRbacState(STATE);
  const key = `${orgId}:${userId}`;

  const currentRole = rbac.userRoles.get(key);
  if (!currentRole) return { ok: false, error: "User has no role in this org" };
  if (currentRole === "owner") return { ok: false, error: "Cannot revoke owner role" };

  rbac.userRoles.delete(key);
  rbac.permissions.delete(key);
  rbac.metrics.totalRoleAssignments = Math.max(0, rbac.metrics.totalRoleAssignments - 1);

  logRbacEvent(rbac, "ROLE_REVOKED", revokedBy || "system", orgId, {
    userId, previousRole: currentRole,
  });

  return { ok: true, orgId, userId, revokedRole: currentRole };
}

export function getUserRole(STATE, orgId, userId) {
  const rbac = getRbacState(STATE);
  const role = rbac.userRoles.get(`${orgId}:${userId}`) || null;
  return { ok: true, orgId, userId, role };
}

export function getOrgMembers(STATE, orgId) {
  const rbac = getRbacState(STATE);
  const members = [];
  for (const [key, role] of rbac.userRoles) {
    if (key.startsWith(`${orgId}:`)) {
      const userId = key.split(":")[1];
      members.push({ userId, role });
    }
  }
  return { ok: true, orgId, members, total: members.length };
}

// ── Permission Checking ──────────────────────────────────────────────────

function hasPermission(role, permission) {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

/**
 * Check if a user has a specific permission in an org context.
 */
export function checkPermission(STATE, orgId, userId, permission) {
  const rbac = getRbacState(STATE);
  rbac.metrics.permissionChecks++;

  const key = `${orgId}:${userId}`;
  const role = rbac.userRoles.get(key);

  if (!role) {
    rbac.metrics.permissionDenials++;
    return { allowed: false, reason: "no_role", orgId, userId, permission };
  }

  const allowed = hasPermission(role, permission);
  if (!allowed) rbac.metrics.permissionDenials++;

  return { allowed, role, orgId, userId, permission };
}

/**
 * Get all permissions for a user in an org.
 */
export function getUserPermissions(STATE, orgId, userId) {
  const rbac = getRbacState(STATE);
  const role = rbac.userRoles.get(`${orgId}:${userId}`);
  if (!role) return { ok: true, permissions: [], role: null };
  return { ok: true, permissions: ROLE_PERMISSIONS[role] || [], role };
}

// ── Per-Org Private Lenses ───────────────────────────────────────────────

export function assignOrgLens(STATE, orgId, lensId) {
  const rbac = getRbacState(STATE);
  if (!rbac.orgLenses.has(orgId)) rbac.orgLenses.set(orgId, new Set());
  rbac.orgLenses.get(orgId).add(lensId);
  return { ok: true, orgId, lensId };
}

export function revokeOrgLens(STATE, orgId, lensId) {
  const rbac = getRbacState(STATE);
  rbac.orgLenses.get(orgId)?.delete(lensId);
  return { ok: true, orgId, lensId };
}

export function getOrgLenses(STATE, orgId) {
  const rbac = getRbacState(STATE);
  const lenses = Array.from(rbac.orgLenses.get(orgId) || new Set());
  return { ok: true, orgId, lenses };
}

// ── Resource-Level ACLs ──────────────────────────────────────────────────

export function setResourceACL(STATE, resourceId, rules) {
  const rbac = getRbacState(STATE);
  rbac.resourceACLs.set(resourceId, {
    resourceId,
    rules, // [{ userId, permissions: ["read","write"] }]
    updatedAt: new Date().toISOString(),
  });
  return { ok: true, resourceId };
}

export function checkResourceAccess(STATE, resourceId, userId, permission) {
  const rbac = getRbacState(STATE);
  const acl = rbac.resourceACLs.get(resourceId);
  if (!acl) return { allowed: true }; // no ACL = open

  const rule = acl.rules.find(r => r.userId === userId);
  if (!rule) return { allowed: false, reason: "not_in_acl" };

  return { allowed: rule.permissions.includes(permission) };
}

// ── Audit Log ────────────────────────────────────────────────────────────

function logRbacEvent(rbac, action, actor, orgId, details = {}) {
  rbac.auditLog.push({
    id: `rbac_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
    ts: Date.now(),
    timestamp: new Date().toISOString(),
    action,
    actor,
    orgId,
    details,
  });
}

/**
 * Export audit log for an organization (for compliance).
 */
export function exportAuditLog(STATE, orgId, options = {}) {
  const rbac = getRbacState(STATE);
  rbac.metrics.auditExports++;

  let events = rbac.auditLog.filter(e => e.orgId === orgId);

  // Date range filter
  if (options.since) {
    const sinceTs = new Date(options.since).getTime();
    events = events.filter(e => e.ts >= sinceTs);
  }
  if (options.until) {
    const untilTs = new Date(options.until).getTime();
    events = events.filter(e => e.ts <= untilTs);
  }

  // Action filter
  if (options.action) {
    events = events.filter(e => e.action === options.action);
  }

  events.sort((a, b) => b.ts - a.ts);

  const limit = options.limit || 1000;
  return {
    ok: true,
    orgId,
    events: events.slice(0, limit),
    total: events.length,
    exportedAt: new Date().toISOString(),
  };
}

// ── Metrics ──────────────────────────────────────────────────────────────

export function getRbacMetrics(STATE) {
  const rbac = getRbacState(STATE);
  return {
    ok: true,
    ...rbac.metrics,
    roles: Object.keys(ROLE_PERMISSIONS),
    auditLogSize: rbac.auditLog.length,
  };
}

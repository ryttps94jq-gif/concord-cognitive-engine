// server/lib/messaging/permission-tiers.js
// Permission tier definitions and before_tool hook for external messaging channels.
// Registers a hook that blocks tool calls that exceed the sender's permission tier.

import { register } from "../agentic/hooks.js";

export const PERMISSION_TIERS = Object.freeze({
  restricted: {
    label: "Restricted",
    description: "Read-only. Can query substrate but cannot create or modify.",
    allowedTools: new Set(["search", "dtu.list", "dtu.get", "get_balance", "get_status"]),
    canCreate: false,
    canSpend: false,
    canTransact: false,
  },
  standard: {
    label: "Standard",
    description: "Can create DTUs and use lenses. Cannot transact.",
    allowedTools: new Set(["search", "dtu.list", "dtu.get", "dtu.create", "chat.respond", "get_balance", "lens.action"]),
    canCreate: true,
    canSpend: false,
    canTransact: false,
  },
  elevated: {
    label: "Elevated",
    description: "Full access including marketplace transactions.",
    allowedTools: "*", // all tools permitted
    canCreate: true,
    canSpend: true,
    canTransact: true,
    requiresPerSessionVerification: true,
  },
});

let _hookUnregister = null;

/**
 * Register the messaging permission tier hook into the before_tool hook chain.
 * Call once at server startup.
 * @returns {Function} unregister function
 */
export function registerPermissionTierHook() {
  if (_hookUnregister) return _hookUnregister; // idempotent

  const rawUnregister = register("before_tool", async (context) => {
    const { toolName, lensContext } = context;
    if (!lensContext?.platform) return; // not a messaging-channel request

    const permissionLevel = lensContext.permissionLevel || "restricted";
    const tier = PERMISSION_TIERS[permissionLevel] || PERMISSION_TIERS.restricted;

    if (tier.allowedTools === "*") return; // elevated — all tools allowed

    if (!tier.allowedTools.has(toolName)) {
      return {
        abort: true,
        reason: `tool_not_permitted_for_tier: ${toolName} requires at least standard tier`,
      };
    }
  }, { priority: 10, name: "messaging-permission-tier-filter" });

  _hookUnregister = () => {
    rawUnregister();
    _hookUnregister = null;
  };

  return _hookUnregister;
}

/**
 * Check if a given tool is permitted for a permission level.
 * @param {string} toolName
 * @param {string} permissionLevel
 * @returns {{ permitted: boolean, reason?: string }}
 */
export function isToolPermitted(toolName, permissionLevel) {
  const tier = PERMISSION_TIERS[permissionLevel] || PERMISSION_TIERS.restricted;
  if (tier.allowedTools === "*") return { permitted: true };
  if (tier.allowedTools.has(toolName)) return { permitted: true };
  return { permitted: false, reason: `${toolName} not allowed at ${permissionLevel} tier` };
}

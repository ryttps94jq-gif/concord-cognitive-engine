/**
 * MIND-SPACE EVENT BRIDGE
 *
 * Forwards local EventEmitter events from mind-space modules
 * to the global ConcordEventBus for server-wide observability.
 */

const BRIDGE_EVENTS = {
  mindSpace: [
    'participant:joined', 'emotion:transmitted', 'thought:shared',
    'presence:transitioned', 'memory:anchored', 'space:closed',
    'sensory:shared', 'distress:detected'
  ],
  subconscious: [
    'subconscious:started', 'subconscious:stopped',
    'space:added', 'space:removed',
    'focus:changed', 'focus:released',
    'pulse', 'escalation:queued', 'escalation:processed', 'escalation:failed'
  ],
  cognitiveBridge: [
    'bridge:initialized', 'space:opened', 'space:backgrounded',
    'interface:upgraded', 'bridge:shutdown'
  ],
  multiSpace: [
    'attention:shifted', 'escalation:failed'
  ]
};

/**
 * Bridge a local emitter's events to the global event bus.
 * @param {EventEmitter} localEmitter - The module's local emitter
 * @param {string} namespace - Prefix for global events (e.g. 'mindspace.presence')
 * @param {string[]} events - List of event names to forward
 * @param {object} globalBus - The ConcordEventBus instance
 */
function bridgeEmitter(localEmitter, namespace, events, globalBus) {
  for (const evt of events) {
    localEmitter.on(evt, (data) => {
      try {
        globalBus.emit(`${namespace}.${evt}`, data);
      } catch (_) { /* don't let bridge errors break the source */ }
    });
  }
}

/**
 * Bridge a MindSpace instance to the global bus.
 */
export function bridgeMindSpace(mindSpace, globalBus) {
  if (!mindSpace?.emitter || !globalBus) return;
  bridgeEmitter(mindSpace.emitter, 'mindspace.presence', BRIDGE_EVENTS.mindSpace, globalBus);
}

/**
 * Bridge a SubconsciousManager instance to the global bus.
 */
export function bridgeSubconscious(subconsciousManager, globalBus) {
  if (!subconsciousManager?.emitter || !globalBus) return;
  bridgeEmitter(subconsciousManager.emitter, 'mindspace.subconscious', BRIDGE_EVENTS.subconscious, globalBus);
}

/**
 * Bridge a CognitiveBridge instance to the global bus.
 */
export function bridgeCognitiveBridge(cognitiveBridge, globalBus) {
  if (!cognitiveBridge?.emitter || !globalBus) return;
  bridgeEmitter(cognitiveBridge.emitter, 'mindspace.bridge', BRIDGE_EVENTS.cognitiveBridge, globalBus);
  // Also bridge the internal subconscious if present
  if (cognitiveBridge.subconscious) {
    bridgeSubconscious(cognitiveBridge.subconscious, globalBus);
  }
}

/**
 * Bridge a MultiSpaceHandler instance to the global bus.
 */
export function bridgeMultiSpaceHandler(handler, globalBus) {
  if (!handler?.emitter || !globalBus) return;
  bridgeEmitter(handler.emitter, 'mindspace.multi', BRIDGE_EVENTS.multiSpace, globalBus);
  // Also bridge the internal cognitive bridge
  if (handler.bridge) {
    bridgeCognitiveBridge(handler.bridge, globalBus);
  }
}

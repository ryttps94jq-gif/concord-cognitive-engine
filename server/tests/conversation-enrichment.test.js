/**
 * Conversation Enrichment — Comprehensive Tests
 * Run: node --test tests/conversation-enrichment.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  createInputDTU,
  createOutputDTU,
  consolidationCheck,
  isConsolidationDue,
  isAcceleratedPromotionDue,
  acceleratedChatPromotion,
  pruneSessionDTUs,
  forgeFromMessage,
  ENRICHMENT_CONSTANTS,
} from '../lib/conversation-enrichment.js';

// ── Helper ────────────────────────────────────────────────────────────────────

function makeState() {
  return { shadowDtus: new Map(), dtus: new Map() };
}

// ── createInputDTU tests ────────────────────────────────────────────────────

describe('createInputDTU', () => {
  it('creates a shadow DTU from user message', () => {
    const STATE = makeState();
    const result = createInputDTU(STATE, {
      userId: 'u1',
      sessionId: 's1',
      message: 'How does gravity work in quantum physics?',
    });
    assert.strictEqual(result.ok, true);
    assert.ok(result.dtuId);
    assert.ok(result.dtuId.startsWith('chat_input_'));

    const dtu = STATE.shadowDtus.get(result.dtuId);
    assert.strictEqual(dtu.tier, 'shadow');
    assert.ok(dtu.tags.includes('shadow'));
    assert.ok(dtu.tags.includes('chat-input'));
    assert.ok(dtu.tags.includes('session:s1'));
    assert.ok(dtu.tags.includes('user:u1'));
    assert.strictEqual(dtu.machine.kind, 'chat_input');
    assert.strictEqual(dtu.machine.sessionId, 's1');
    assert.strictEqual(dtu.machine.userId, 'u1');
  });

  it('rejects short messages', () => {
    const STATE = makeState();
    const result = createInputDTU(STATE, {
      userId: 'u1', sessionId: 's1', message: 'Hi',
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'message_too_short');
    assert.strictEqual(STATE.shadowDtus.size, 0);
  });

  it('rejects empty messages', () => {
    const STATE = makeState();
    const result = createInputDTU(STATE, {
      userId: 'u1', sessionId: 's1', message: '',
    });
    assert.strictEqual(result.ok, false);
  });

  it('includes intent tag when provided', () => {
    const STATE = makeState();
    const result = createInputDTU(STATE, {
      userId: 'u1', sessionId: 's1',
      message: 'This is a longer test message for intent testing',
      intent: 'question',
    });
    const dtu = STATE.shadowDtus.get(result.dtuId);
    assert.ok(dtu.tags.includes('intent:question'));
    assert.strictEqual(dtu.machine.intent, 'question');
  });

  it('includes topic tags', () => {
    const STATE = makeState();
    const result = createInputDTU(STATE, {
      userId: 'u1', sessionId: 's1',
      message: 'This is a longer message about science and physics',
      topics: ['science', 'physics'],
    });
    const dtu = STATE.shadowDtus.get(result.dtuId);
    assert.ok(dtu.tags.includes('science'));
    assert.ok(dtu.tags.includes('physics'));
  });

  it('truncates content at max length', () => {
    const STATE = makeState();
    const longMessage = 'x'.repeat(1000);
    const result = createInputDTU(STATE, {
      userId: 'u1', sessionId: 's1', message: longMessage,
    });
    const dtu = STATE.shadowDtus.get(result.dtuId);
    assert.ok(dtu.content.length <= ENRICHMENT_CONSTANTS.MAX_DTU_CONTENT);
  });

  it('creates shadowDtus map if missing', () => {
    const STATE = {};
    const result = createInputDTU(STATE, {
      userId: 'u1', sessionId: 's1',
      message: 'A sufficiently long message for DTU creation',
    });
    assert.strictEqual(result.ok, true);
    assert.ok(STATE.shadowDtus instanceof Map);
  });

  it('generates unique IDs', () => {
    const STATE = makeState();
    const ids = new Set();
    for (let i = 0; i < 10; i++) {
      const result = createInputDTU(STATE, {
        userId: 'u1', sessionId: 's1',
        message: `Test message number ${i} with enough length`,
      });
      ids.add(result.dtuId);
    }
    assert.strictEqual(ids.size, 10);
  });

  it('computes content hash', () => {
    const STATE = makeState();
    const result = createInputDTU(STATE, {
      userId: 'u1', sessionId: 's1',
      message: 'A message long enough to generate a DTU hash',
    });
    const dtu = STATE.shadowDtus.get(result.dtuId);
    assert.ok(dtu.hash);
    assert.strictEqual(dtu.hash.length, 16);
  });
});

// ── createOutputDTU tests ───────────────────────────────────────────────────

describe('createOutputDTU', () => {
  it('creates shadow DTU from AI response', () => {
    const STATE = makeState();
    const result = createOutputDTU(STATE, {
      sessionId: 's1',
      response: 'Gravity is a fundamental force described by general relativity.',
      brain: 'conscious',
      confidence: 0.85,
    });
    assert.strictEqual(result.ok, true);
    assert.ok(result.dtuId.startsWith('chat_output_'));

    const dtu = STATE.shadowDtus.get(result.dtuId);
    assert.strictEqual(dtu.tier, 'shadow');
    assert.ok(dtu.tags.includes('chat-output'));
    assert.ok(dtu.tags.includes('brain:conscious'));
    assert.strictEqual(dtu.machine.kind, 'chat_output');
    assert.strictEqual(dtu.machine.brain, 'conscious');
    assert.strictEqual(dtu.machine.confidence, 0.85);
  });

  it('rejects short responses', () => {
    const STATE = makeState();
    const result = createOutputDTU(STATE, {
      sessionId: 's1', response: 'OK',
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'response_too_short');
  });

  it('includes working set DTU IDs', () => {
    const STATE = makeState();
    const result = createOutputDTU(STATE, {
      sessionId: 's1',
      response: 'A longer response with working set references included',
      workingSetDtuIds: ['ref1', 'ref2', 'ref3'],
    });
    const dtu = STATE.shadowDtus.get(result.dtuId);
    assert.deepStrictEqual(dtu.machine.workingSetDtuIds, ['ref1', 'ref2', 'ref3']);
  });

  it('caps workingSetDtuIds at 20', () => {
    const STATE = makeState();
    const ids = Array.from({ length: 30 }, (_, i) => `ref_${i}`);
    const result = createOutputDTU(STATE, {
      sessionId: 's1',
      response: 'A longer response testing working set cap limits',
      workingSetDtuIds: ids,
    });
    const dtu = STATE.shadowDtus.get(result.dtuId);
    assert.strictEqual(dtu.machine.workingSetDtuIds.length, 20);
  });

  it('defaults brain to conscious', () => {
    const STATE = makeState();
    const result = createOutputDTU(STATE, {
      sessionId: 's1',
      response: 'A longer response with default brain testing',
    });
    const dtu = STATE.shadowDtus.get(result.dtuId);
    assert.strictEqual(dtu.machine.brain, 'conscious');
  });
});

// ── consolidationCheck tests ────────────────────────────────────────────────

describe('consolidationCheck', () => {
  it('returns no consolidation for empty state', () => {
    const result = consolidationCheck({}, 's1');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.flaggedCount, 0);
    assert.strictEqual(result.shouldConsolidate, false);
  });

  it('returns no consolidation for few session shadows', () => {
    const STATE = makeState();
    STATE.shadowDtus.set('s1', {
      machine: { sessionId: 's1', kind: 'chat_input' },
      tags: ['shadow', 'chat-input'],
    });
    const result = consolidationCheck(STATE, 's1');
    assert.strictEqual(result.shouldConsolidate, false);
  });

  it('detects overlap with substrate DTUs', () => {
    const STATE = makeState();

    // Add session shadows with topic tags
    for (let i = 0; i < 5; i++) {
      STATE.shadowDtus.set(`shadow_${i}`, {
        machine: { sessionId: 's1', kind: 'chat_input' },
        tags: ['shadow', 'chat-input', 'physics', 'quantum'],
      });
    }

    // Add substrate DTUs with matching tags
    for (let i = 0; i < 5; i++) {
      STATE.dtus.set(`dtu_${i}`, {
        tags: ['physics', 'quantum', 'science'],
      });
    }

    const result = consolidationCheck(STATE, 's1');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.shouldConsolidate, true);
    assert.ok(result.flaggedCount > 0);
  });

  it('flags session shadows for consolidation', () => {
    const STATE = makeState();

    for (let i = 0; i < 5; i++) {
      STATE.shadowDtus.set(`shadow_${i}`, {
        machine: { sessionId: 's1', kind: 'chat_input' },
        tags: ['shadow', 'chat-input', 'physics', 'quantum'],
      });
    }

    for (let i = 0; i < 5; i++) {
      STATE.dtus.set(`dtu_${i}`, { tags: ['physics', 'quantum', 'science'] });
    }

    consolidationCheck(STATE, 's1');

    const shadow = STATE.shadowDtus.get('shadow_0');
    assert.strictEqual(shadow.meta.flaggedForConsolidation, true);
    assert.ok(shadow.meta.flaggedAt);
  });

  it('ignores system tags when checking overlap', () => {
    const STATE = makeState();

    for (let i = 0; i < 5; i++) {
      STATE.shadowDtus.set(`shadow_${i}`, {
        machine: { sessionId: 's1', kind: 'chat_input' },
        tags: ['shadow', 'chat-input', 'session:s1', 'user:u1'],
      });
    }

    STATE.dtus.set('dtu1', { tags: ['shadow', 'session:s1'] });

    const result = consolidationCheck(STATE, 's1');
    assert.strictEqual(result.shouldConsolidate, false);
  });
});

// ── isConsolidationDue tests ────────────────────────────────────────────────

describe('isConsolidationDue', () => {
  it('returns false for null session', () => {
    assert.strictEqual(isConsolidationDue(null), false);
  });

  it('returns false for session with no messages', () => {
    assert.strictEqual(isConsolidationDue({}), false);
  });

  it('returns false for fewer than 20 messages', () => {
    const sess = { messages: Array(18).fill({}) };
    assert.strictEqual(isConsolidationDue(sess), false);
  });

  it('returns true at 20 messages (10 exchanges)', () => {
    const sess = { messages: Array(20).fill({}) };
    assert.strictEqual(isConsolidationDue(sess), true);
  });

  it('returns false when already checked at current interval', () => {
    const sess = { messages: Array(20).fill({}), _lastConsolidationCheck: 10 };
    assert.strictEqual(isConsolidationDue(sess), false);
  });

  it('returns true at next interval', () => {
    const sess = { messages: Array(40).fill({}), _lastConsolidationCheck: 10 };
    assert.strictEqual(isConsolidationDue(sess), true);
  });
});

// ── pruneSessionDTUs tests ──────────────────────────────────────────────────

describe('pruneSessionDTUs', () => {
  it('handles missing shadowDtus', () => {
    const result = pruneSessionDTUs({});
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.pruned, 0);
  });

  it('prunes old chat DTUs', () => {
    const STATE = makeState();
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago

    STATE.shadowDtus.set('old1', {
      machine: { kind: 'chat_input' },
      createdAt: oldDate,
      meta: {},
    });
    STATE.shadowDtus.set('old2', {
      machine: { kind: 'chat_output' },
      createdAt: oldDate,
      meta: {},
    });
    STATE.shadowDtus.set('recent', {
      machine: { kind: 'chat_input' },
      createdAt: new Date().toISOString(),
      meta: {},
    });

    const result = pruneSessionDTUs(STATE, 7);
    assert.strictEqual(result.pruned, 2);
    assert.strictEqual(STATE.shadowDtus.size, 1);
    assert.ok(STATE.shadowDtus.has('recent'));
  });

  it('preserves DTUs flagged for consolidation', () => {
    const STATE = makeState();
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    STATE.shadowDtus.set('old_flagged', {
      machine: { kind: 'chat_input' },
      createdAt: oldDate,
      meta: { flaggedForConsolidation: true },
    });

    const result = pruneSessionDTUs(STATE, 7);
    assert.strictEqual(result.pruned, 0);
    assert.ok(STATE.shadowDtus.has('old_flagged'));
  });

  it('does not prune non-chat shadow DTUs', () => {
    const STATE = makeState();
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    STATE.shadowDtus.set('summary_session_s1', {
      machine: { kind: 'conversation_summary' },
      createdAt: oldDate,
    });

    const result = pruneSessionDTUs(STATE, 7);
    assert.strictEqual(result.pruned, 0);
    assert.ok(STATE.shadowDtus.has('summary_session_s1'));
  });

  it('respects custom maxAgeDays', () => {
    const STATE = makeState();
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    STATE.shadowDtus.set('d1', {
      machine: { kind: 'chat_input' },
      createdAt: fiveDaysAgo,
      meta: {},
    });

    // 3-day max should prune it
    const result = pruneSessionDTUs(STATE, 3);
    assert.strictEqual(result.pruned, 1);
  });
});

// ── forgeFromMessage tests ──────────────────────────────────────────────────

describe('forgeFromMessage', () => {
  it('creates a regular-tier DTU', () => {
    const STATE = makeState();
    const result = forgeFromMessage(STATE, {
      messageContent: 'This is an important insight about quantum entanglement that should be preserved.',
      sessionId: 's1',
      userId: 'u1',
    });
    assert.strictEqual(result.ok, true);
    assert.ok(result.dtuId.startsWith('forged_'));
    assert.ok(result.title);

    const dtu = STATE.dtus.get(result.dtuId);
    assert.strictEqual(dtu.tier, 'regular');
    assert.ok(dtu.tags.includes('forged'));
    assert.ok(dtu.tags.includes('user-promoted'));
    assert.strictEqual(dtu.machine.kind, 'user_forged');
    assert.strictEqual(dtu.source, 'user-forge');
  });

  it('rejects short content', () => {
    const STATE = makeState();
    const result = forgeFromMessage(STATE, {
      messageContent: 'Short',
      sessionId: 's1',
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error, 'content_too_short');
  });

  it('uses custom title when provided', () => {
    const STATE = makeState();
    const result = forgeFromMessage(STATE, {
      messageContent: 'This is an important insight about physics.',
      sessionId: 's1',
      title: 'Custom Title',
    });
    const dtu = STATE.dtus.get(result.dtuId);
    assert.strictEqual(dtu.title, 'Custom Title');
  });

  it('includes custom tags', () => {
    const STATE = makeState();
    const result = forgeFromMessage(STATE, {
      messageContent: 'An insight about quantum mechanics and entanglement.',
      sessionId: 's1',
      tags: ['physics', 'quantum'],
    });
    const dtu = STATE.dtus.get(result.dtuId);
    assert.ok(dtu.tags.includes('physics'));
    assert.ok(dtu.tags.includes('quantum'));
  });

  it('stores in dtus Map (not shadowDtus)', () => {
    const STATE = makeState();
    const result = forgeFromMessage(STATE, {
      messageContent: 'A promoted insight that lives in the main substrate.',
      sessionId: 's1',
    });
    assert.ok(STATE.dtus.has(result.dtuId));
    assert.ok(!STATE.shadowDtus.has(result.dtuId));
  });

  it('creates dtus map if missing', () => {
    const STATE = {};
    const result = forgeFromMessage(STATE, {
      messageContent: 'A promoted insight for testing map creation.',
      sessionId: 's1',
    });
    assert.strictEqual(result.ok, true);
    assert.ok(STATE.dtus instanceof Map);
  });
});

// ── isAcceleratedPromotionDue tests ─────────────────────────────────────────

describe('isAcceleratedPromotionDue', () => {
  it('returns false for null session', () => {
    assert.strictEqual(isAcceleratedPromotionDue(null), false);
  });

  it('returns false for session with no messages', () => {
    assert.strictEqual(isAcceleratedPromotionDue({}), false);
  });

  it('returns false for fewer than 10 messages (5 exchanges)', () => {
    const sess = { messages: Array(8).fill({}) };
    assert.strictEqual(isAcceleratedPromotionDue(sess), false);
  });

  it('returns true at 10 messages (5 exchanges)', () => {
    const sess = { messages: Array(10).fill({}) };
    assert.strictEqual(isAcceleratedPromotionDue(sess), true);
  });

  it('returns false when already checked at current interval', () => {
    const sess = { messages: Array(10).fill({}), _lastAcceleratedPromotionCheck: 5 };
    assert.strictEqual(isAcceleratedPromotionDue(sess), false);
  });

  it('returns true at next interval', () => {
    const sess = { messages: Array(20).fill({}), _lastAcceleratedPromotionCheck: 5 };
    assert.strictEqual(isAcceleratedPromotionDue(sess), true);
  });
});

// ── acceleratedChatPromotion tests ──────────────────────────────────────────

describe('acceleratedChatPromotion', () => {
  it('returns zero promotions for empty state', () => {
    const result = acceleratedChatPromotion({}, 's1');
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.promoted, 0);
    assert.strictEqual(result.megaCreated, false);
  });

  it('promotes high-confidence chat_output shadows to regular', () => {
    const STATE = makeState();
    STATE.shadowDtus.set('out1', {
      id: 'out1',
      tier: 'shadow',
      content: 'A response about quantum physics',
      tags: ['shadow', 'chat-output', 'session:s1'],
      machine: { kind: 'chat_output', sessionId: 's1', confidence: 0.85, workingSetDtuIds: [] },
      meta: { hidden: true },
    });
    const result = acceleratedChatPromotion(STATE, 's1');
    assert.strictEqual(result.promoted, 1);
    // Should be moved to dtus, removed from shadowDtus
    assert.ok(STATE.dtus.has('out1'));
    assert.ok(!STATE.shadowDtus.has('out1'));
    const dtu = STATE.dtus.get('out1');
    assert.strictEqual(dtu.tier, 'regular');
    assert.strictEqual(dtu.meta.promotedFrom, 'shadow');
    assert.strictEqual(dtu.meta.promotionReason, 'chat_accelerated');
    assert.ok(dtu.meta.promotedAt);
  });

  it('promotes shadows with 3+ working set refs', () => {
    const STATE = makeState();
    STATE.shadowDtus.set('out1', {
      id: 'out1',
      tier: 'shadow',
      content: 'Short',
      tags: ['shadow', 'chat-output', 'session:s1'],
      machine: { kind: 'chat_output', sessionId: 's1', confidence: 0.3, workingSetDtuIds: ['a', 'b', 'c'] },
      meta: {},
    });
    const result = acceleratedChatPromotion(STATE, 's1');
    assert.strictEqual(result.promoted, 1);
    assert.ok(STATE.dtus.has('out1'));
  });

  it('promotes shadows with substantive content (>200 chars)', () => {
    const STATE = makeState();
    STATE.shadowDtus.set('out1', {
      id: 'out1',
      tier: 'shadow',
      content: 'x'.repeat(250),
      tags: ['shadow', 'chat-output', 'session:s1'],
      machine: { kind: 'chat_output', sessionId: 's1', confidence: 0.2, workingSetDtuIds: [] },
      meta: {},
    });
    const result = acceleratedChatPromotion(STATE, 's1');
    assert.strictEqual(result.promoted, 1);
  });

  it('does not promote low-value shadows', () => {
    const STATE = makeState();
    STATE.shadowDtus.set('out1', {
      id: 'out1',
      tier: 'shadow',
      content: 'Short reply',
      tags: ['shadow', 'chat-output', 'session:s1'],
      machine: { kind: 'chat_output', sessionId: 's1', confidence: 0.3, workingSetDtuIds: [] },
      meta: {},
    });
    const result = acceleratedChatPromotion(STATE, 's1');
    assert.strictEqual(result.promoted, 0);
    assert.ok(STATE.shadowDtus.has('out1'));
    assert.ok(!STATE.dtus.has('out1'));
  });

  it('does not promote chat_input shadows (only chat_output)', () => {
    const STATE = makeState();
    STATE.shadowDtus.set('in1', {
      id: 'in1',
      tier: 'shadow',
      content: 'x'.repeat(300),
      tags: ['shadow', 'chat-input', 'session:s1'],
      machine: { kind: 'chat_input', sessionId: 's1', confidence: 0.9 },
      meta: {},
    });
    const result = acceleratedChatPromotion(STATE, 's1');
    assert.strictEqual(result.promoted, 0);
  });

  it('ignores shadows from other sessions', () => {
    const STATE = makeState();
    STATE.shadowDtus.set('out1', {
      id: 'out1',
      tier: 'shadow',
      content: 'x'.repeat(300),
      tags: ['shadow', 'chat-output', 'session:other'],
      machine: { kind: 'chat_output', sessionId: 'other', confidence: 0.9 },
      meta: {},
    });
    const result = acceleratedChatPromotion(STATE, 's1');
    assert.strictEqual(result.promoted, 0);
  });

  it('creates mega DTU when 5+ promoted regulars exist', () => {
    const STATE = makeState();
    // Pre-populate with 5 promoted regular DTUs for session s1
    for (let i = 0; i < 5; i++) {
      STATE.dtus.set(`reg_${i}`, {
        id: `reg_${i}`,
        tier: 'regular',
        content: `Promoted content ${i} about physics and quantum mechanics`,
        title: `AI: Response ${i}`,
        tags: ['chat-output', 'session:s1', 'physics'],
        machine: { kind: 'chat_output', sessionId: 's1' },
        meta: { promotedFrom: 'shadow', promotionReason: 'chat_accelerated' },
        human: { summary: `Response ${i}` },
        lineage: { parents: [], children: [] },
      });
    }

    const result = acceleratedChatPromotion(STATE, 's1');
    assert.strictEqual(result.megaCreated, true);
    assert.ok(result.megaId);
    assert.ok(result.megaId.startsWith('mega_chat_s1_'));

    // Verify mega DTU exists in state
    const mega = STATE.dtus.get(result.megaId);
    assert.strictEqual(mega.tier, 'mega');
    assert.ok(mega.tags.includes('mega'));
    assert.ok(mega.tags.includes('chat-context'));
    assert.ok(mega.tags.includes('session:s1'));
    assert.strictEqual(mega.machine.kind, 'chat_mega');
    assert.strictEqual(mega.machine.sourceCount, 5);

    // Verify source DTUs are marked as consolidated
    for (let i = 0; i < 5; i++) {
      const src = STATE.dtus.get(`reg_${i}`);
      assert.strictEqual(src.meta.consolidatedInto, result.megaId);
      assert.ok(src.lineage.children.includes(result.megaId));
    }
  });

  it('does not create mega if fewer than 5 promoted regulars', () => {
    const STATE = makeState();
    for (let i = 0; i < 3; i++) {
      STATE.dtus.set(`reg_${i}`, {
        id: `reg_${i}`,
        tier: 'regular',
        content: `Content ${i}`,
        tags: ['chat-output', 'session:s1'],
        machine: { kind: 'chat_output', sessionId: 's1' },
        meta: { promotedFrom: 'shadow' },
        lineage: { parents: [], children: [] },
      });
    }
    const result = acceleratedChatPromotion(STATE, 's1');
    assert.strictEqual(result.megaCreated, false);
    assert.strictEqual(result.megaId, null);
  });

  it('skips already-consolidated regulars for mega', () => {
    const STATE = makeState();
    // 5 regulars but 3 already consolidated
    for (let i = 0; i < 5; i++) {
      STATE.dtus.set(`reg_${i}`, {
        id: `reg_${i}`,
        tier: 'regular',
        content: `Content ${i}`,
        tags: ['chat-output', 'session:s1'],
        machine: { kind: 'chat_output', sessionId: 's1' },
        meta: {
          promotedFrom: 'shadow',
          consolidatedInto: i < 3 ? 'mega_old' : undefined,
        },
        lineage: { parents: [], children: [] },
      });
    }
    const result = acceleratedChatPromotion(STATE, 's1');
    // Only 2 unconsolidated regulars, not enough for mega
    assert.strictEqual(result.megaCreated, false);
  });

  it('performs both promotion and mega creation in one call', () => {
    const STATE = makeState();
    // 4 already-promoted regulars
    for (let i = 0; i < 4; i++) {
      STATE.dtus.set(`reg_${i}`, {
        id: `reg_${i}`,
        tier: 'regular',
        content: `Existing content ${i}`,
        tags: ['chat-output', 'session:s1'],
        machine: { kind: 'chat_output', sessionId: 's1' },
        meta: { promotedFrom: 'shadow' },
        human: { summary: `Summary ${i}` },
        lineage: { parents: [], children: [] },
      });
    }
    // 1 shadow that qualifies for promotion (will push to 5 regulars)
    STATE.shadowDtus.set('out_new', {
      id: 'out_new',
      tier: 'shadow',
      content: 'x'.repeat(300),
      tags: ['shadow', 'chat-output', 'session:s1'],
      machine: { kind: 'chat_output', sessionId: 's1', confidence: 0.9, workingSetDtuIds: [] },
      meta: {},
    });

    const result = acceleratedChatPromotion(STATE, 's1');
    assert.strictEqual(result.promoted, 1);
    assert.strictEqual(result.megaCreated, true);
    assert.ok(result.megaId);
  });
});

// ── ENRICHMENT_CONSTANTS tests ──────────────────────────────────────────────

describe('ENRICHMENT_CONSTANTS', () => {
  it('has correct consolidation interval', () => {
    assert.strictEqual(ENRICHMENT_CONSTANTS.CONSOLIDATION_CHECK_INTERVAL, 10);
  });

  it('has correct accelerated promotion interval', () => {
    assert.strictEqual(ENRICHMENT_CONSTANTS.ACCELERATED_PROMOTION_INTERVAL, 5);
  });

  it('has correct mega consolidation threshold', () => {
    assert.strictEqual(ENRICHMENT_CONSTANTS.MEGA_CONSOLIDATION_THRESHOLD, 5);
  });

  it('has correct max age', () => {
    assert.strictEqual(ENRICHMENT_CONSTANTS.MAX_SHADOW_AGE_DAYS, 7);
  });

  it('has correct min message length', () => {
    assert.strictEqual(ENRICHMENT_CONSTANTS.MIN_MESSAGE_LENGTH, 20);
  });

  it('has correct max content length', () => {
    assert.strictEqual(ENRICHMENT_CONSTANTS.MAX_DTU_CONTENT, 500);
  });

  it('is frozen', () => {
    assert.ok(Object.isFrozen(ENRICHMENT_CONSTANTS));
  });
});

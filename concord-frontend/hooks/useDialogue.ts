'use client';

import { useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api/client';
import { SPECIALStats, DEFAULT_SPECIAL } from '@/lib/concordia/player-stats';

// ── Types ────────────────────────────────────────────────────────────

export interface DialogueMessage {
  id: string;
  role: 'player' | 'npc';
  text: string;
  timestamp: number;
  skillCheckResult?: SkillCheckResult;
}

// Fallout-style skill check — NPC responds differently based on player Charisma/Intelligence
export interface SkillCheckOption {
  id: string;
  text: string;
  stat: keyof SPECIALStats;
  minValue: number;       // stat must be >= this to unlock
  successBonus?: string;  // extra text shown on success
}

export interface SkillCheckResult {
  option: SkillCheckOption;
  passed: boolean;
  playerStatValue: number;
}

// Shadow of Mordor style NPC memory — what the NPC knows about the player
export interface NPCRelationship {
  npcId: string;
  npcName: string;
  opinion: number;        // -100 to 100 (Sims relationship score)
  familiarity: number;    // 0-100 (how well they know you)
  memories: string[];     // key events remembered
  standing: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'ally';
}

export interface DialogueState {
  active: boolean;
  npcId: string | null;
  npcName: string;
  messages: DialogueMessage[];
  suggestedResponses: string[];
  relationship: NPCRelationship | null;
  skillCheckOptions: SkillCheckOption[];
  loading: boolean;
  error: string | null;
}

function opinionToStanding(opinion: number): NPCRelationship['standing'] {
  if (opinion >= 60)  return 'ally';
  if (opinion >= 20)  return 'friendly';
  if (opinion >= -20) return 'neutral';
  if (opinion >= -60) return 'unfriendly';
  return 'hostile';
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useDialogue(special: SPECIALStats = DEFAULT_SPECIAL) {
  const [state, setState] = useState<DialogueState>({
    active: false,
    npcId: null,
    npcName: '',
    messages: [],
    suggestedResponses: [],
    relationship: null,
    skillCheckOptions: [],
    loading: false,
    error: null,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const startDialogue = useCallback(async (
    npcId: string,
    npcName: string,
    npcProfile: Record<string, unknown>,
    priorOpinion = 0,
    priorMemories: string[] = [],
  ) => {
    const relationship: NPCRelationship = {
      npcId,
      npcName,
      opinion: priorOpinion,
      familiarity: Math.min(100, priorMemories.length * 10),
      memories: priorMemories,
      standing: opinionToStanding(priorOpinion),
    };

    setState(s => ({
      ...s,
      active: true,
      npcId,
      npcName,
      messages: [],
      relationship,
      loading: true,
      error: null,
      skillCheckOptions: [],
    }));

    try {
      // Ask conscious brain to open the conversation with NPC context
      const res = await api.post('/api/chat', {
        message: `[CONCORDIA NPC DIALOGUE INIT] You are ${npcName}. Begin a conversation with the player. Prior relationship: opinion=${priorOpinion} (${opinionToStanding(priorOpinion)}). Memories: ${priorMemories.join('; ') || 'none'}. Player Charisma: ${special.charisma}. Respond in character. Also return a JSON block with suggestedResponses (array of 3 short player reply options) and any skillCheckOptions (array of {id, text, stat, minValue}).`,
        lensContext: { lens: 'game', intent: 'npc-dialogue', npc: npcProfile },
        brainOverride: 'conscious',
      });

      const raw: string = res.data?.response ?? res.data?.text ?? '';
      const [npcText, suggestedResponses, skillCheckOptions] = parseNPCResponse(raw);

      const openMsg: DialogueMessage = {
        id: `${Date.now()}-npc`,
        role: 'npc',
        text: npcText,
        timestamp: Date.now(),
      };

      setState(s => ({
        ...s,
        messages: [openMsg],
        suggestedResponses,
        skillCheckOptions,
        loading: false,
      }));
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: String(err) }));
    }
  }, [special]);

  const send = useCallback(async (
    text: string,
    skillCheck?: SkillCheckOption,
  ) => {
    if (!stateRef.current.npcId || !text.trim()) return;

    let checkResult: SkillCheckResult | undefined;
    if (skillCheck) {
      const statVal = special[skillCheck.stat] as number;
      checkResult = {
        option: skillCheck,
        passed: statVal >= skillCheck.minValue,
        playerStatValue: statVal,
      };
    }

    const playerMsg: DialogueMessage = {
      id: `${Date.now()}-player`,
      role: 'player',
      text,
      timestamp: Date.now(),
      skillCheckResult: checkResult,
    };

    setState(s => ({ ...s, messages: [...s.messages, playerMsg], loading: true, error: null }));

    try {
      const history = stateRef.current.messages.slice(-6).map(m => ({
        role: m.role === 'player' ? 'user' : 'assistant',
        content: m.text,
      }));

      const skillContext = checkResult
        ? ` [Skill check: ${checkResult.option.stat} ${checkResult.passed ? 'PASSED' : 'FAILED'} (${checkResult.playerStatValue}/${checkResult.option.minValue})]`
        : '';

      const res = await api.post('/api/chat', {
        message: text + skillContext,
        history,
        lensContext: {
          lens: 'game',
          intent: 'npc-dialogue',
          npcId: stateRef.current.npcId,
          relationship: stateRef.current.relationship,
        },
        brainOverride: 'conscious',
      });

      const raw: string = res.data?.response ?? res.data?.text ?? '';
      const [npcText, suggestedResponses, skillCheckOptions] = parseNPCResponse(raw);

      const npcMsg: DialogueMessage = {
        id: `${Date.now()}-npc`,
        role: 'npc',
        text: npcText,
        timestamp: Date.now(),
      };

      // Update Sims-style relationship: positive interaction shifts opinion +5
      setState(s => {
        const rel = s.relationship;
        const opinionDelta = checkResult?.passed ? 10 : checkResult ? -5 : 3;
        const newOpinion = rel
          ? Math.max(-100, Math.min(100, rel.opinion + opinionDelta))
          : 0;
        const newRel = rel
          ? {
              ...rel,
              opinion: newOpinion,
              familiarity: Math.min(100, rel.familiarity + 2),
              standing: opinionToStanding(newOpinion),
            }
          : rel;
        return {
          ...s,
          messages: [...s.messages, npcMsg],
          suggestedResponses,
          skillCheckOptions,
          relationship: newRel,
          loading: false,
        };
      });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: String(err) }));
    }
  }, [special]);

  const endDialogue = useCallback(() => {
    setState(s => ({ ...s, active: false }));
  }, []);

  return { state, startDialogue, send, endDialogue };
}

// ── Response parser ──────────────────────────────────────────────────

function parseNPCResponse(raw: string): [string, string[], SkillCheckOption[]] {
  // Extract JSON block if present, separate it from the narrative text
  const jsonMatch = raw.match(/```json([\s\S]*?)```|(\{[\s\S]*?"suggestedResponses"[\s\S]*?\})/);
  let npcText = raw;
  let suggestedResponses: string[] = [];
  let skillCheckOptions: SkillCheckOption[] = [];

  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1] ?? jsonMatch[2] ?? '';
      const parsed = JSON.parse(jsonStr.trim()) as {
        suggestedResponses?: string[];
        skillCheckOptions?: SkillCheckOption[];
      };
      suggestedResponses = parsed.suggestedResponses ?? [];
      skillCheckOptions = parsed.skillCheckOptions ?? [];
      // Remove json block from displayed text
      npcText = raw.replace(jsonMatch[0], '').trim();
    } catch {
      // If parse fails, fall through with raw text
    }
  }

  if (suggestedResponses.length === 0) {
    suggestedResponses = ['Tell me more.', 'I understand.', 'Goodbye.'];
  }

  return [npcText || raw, suggestedResponses, skillCheckOptions];
}

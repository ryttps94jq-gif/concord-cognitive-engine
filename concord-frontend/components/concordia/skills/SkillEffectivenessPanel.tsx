'use client';

import React, { useEffect, useState } from 'react';
import { computeEffectivenessPreview, getResistanceForWorld } from '@/lib/concordia/skill-portability';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SkillSlot {
  id: string;
  title: string;
  skillType: string;
  skill_level: number;
}

interface SkillEffectivenessPanelProps {
  skills: SkillSlot[];
  currentWorldId: string;
  currentWorldName?: string;
  onLearnFromMaster?: (skillId: string) => void;
  className?: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EffBadge({ pct }: { pct: number }) {
  if (pct === 0)   return <span className="text-xs text-red-400 font-mono">0% — Inactive</span>;
  if (pct >= 90)   return <span className="text-xs text-emerald-400 font-mono">{pct}% — Mastered</span>;
  if (pct >= 50)   return <span className="text-xs text-yellow-400 font-mono">{pct}% — Functional</span>;
  return             <span className="text-xs text-orange-400 font-mono">{pct}% — Limited</span>;
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function SkillEffectivenessPanel({
  skills,
  currentWorldId,
  currentWorldName,
  onLearnFromMaster,
  className = '',
}: SkillEffectivenessPanelProps) {
  const [nearMaster, setNearMaster] = useState<string | null>(null);

  useEffect(() => {
    // Poll for nearby masters every 30s (in a real client, this would be socket-driven)
    const check = async () => {
      try {
        const res = await fetch(`/api/worlds/${currentWorldId}/quests?status=all`);
        if (res.ok) {
          // NPC master presence would come from a dedicated endpoint;
          // for now seed with null (no master nearby)
          setNearMaster(null);
        }
      } catch (_e) { /* ignore */ }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [currentWorldId]);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="text-xs text-white/40 font-mono uppercase tracking-wider mb-1">
        Skills in {currentWorldName || currentWorldId}
      </div>

      {skills.map(skill => {
        const resistance = getResistanceForWorld(currentWorldId, skill.skillType);
        const result     = computeEffectivenessPreview(skill.skill_level, resistance);
        const pct        = Math.round(result.effectiveness * 100);
        const inactive   = pct === 0;

        return (
          <div
            key={skill.id}
            className={[
              'flex items-center gap-3 rounded-lg px-3 py-2 border transition',
              inactive
                ? 'border-red-900/40 bg-red-950/20 opacity-60'
                : 'border-white/10 bg-white/5',
            ].join(' ')}
          >
            {/* Effectiveness bar */}
            <div className="relative w-10 h-10 shrink-0">
              <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={pct >= 70 ? '#22c55e' : pct >= 30 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="3"
                  strokeDasharray={`${pct} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold">
                {pct}
              </span>
            </div>

            {/* Skill info */}
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold truncate ${inactive ? 'text-white/30' : 'text-white'}`}>
                {skill.title}
              </div>
              <EffBadge pct={pct} />
              {result.status === 'below_threshold' && (
                <div className="text-xs text-white/30 font-mono mt-0.5">
                  Needs level {result.threshold} (you: {skill.skill_level.toFixed(1)})
                </div>
              )}
            </div>

            {/* Learn from Master button */}
            {nearMaster && onLearnFromMaster && (
              <button
                onClick={() => onLearnFromMaster(skill.id)}
                className="shrink-0 text-xs text-amber-400 border border-amber-400/40 rounded px-2 py-1 hover:bg-amber-400/10 transition"
              >
                Learn
              </button>
            )}
          </div>
        );
      })}

      {skills.length === 0 && (
        <div className="text-white/30 text-sm font-mono">No skills in hotbar</div>
      )}
    </div>
  );
}

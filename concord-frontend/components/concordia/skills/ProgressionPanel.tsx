'use client';

import React from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SkillProgressionData {
  id: string;
  title: string;
  skill_level: number;
  total_experience: number;
  practice_count: number;
  teaching_count: number;
  cross_world_uses: number;
  hybrid_contributions: number;
  /** 0–1 effectiveness in the current world */
  effectivenessInCurrentWorld?: number;
  mastery: {
    badge: string;
    title: string;
    aura: string | null;
    npcRecognition: boolean;
    teacherEligible: boolean;
    legendaryStatus?: boolean;
    mythicStatus?: boolean;
    level: number;
    nextThreshold: number | null;
  };
  worldLeaderboardPosition?: number;
}

interface ProgressionPanelProps {
  skills: SkillProgressionData[];
  className?: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function XPBar({ current, next }: { current: number; next: number | null }) {
  if (!next) return (
    <div className="text-xs text-amber-400 font-mono mt-1">Transcendent — no further threshold</div>
  );
  const expNeededForNext = (next - 1) * 10; // inverse of computeLevelFromExperience
  const pct = Math.min(100, (current / expNeededForNext) * 100);
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs text-white/50 font-mono mb-0.5">
        <span>{Math.round(current).toLocaleString()} XP</span>
        <span>→ Level {next}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MasteryBadge({ mastery }: { mastery: SkillProgressionData['mastery'] }) {
  const colourMap: Record<string, string> = {
    novice: 'bg-slate-600',
    adept: 'bg-emerald-700',
    skilled: 'bg-blue-600',
    expert: 'bg-yellow-600',
    master: 'bg-purple-600',
    legendary: 'bg-gradient-to-r from-pink-600 to-orange-500',
    mythic: 'bg-gradient-to-r from-violet-600 to-cyan-500',
    transcendent: 'bg-gradient-to-r from-black via-indigo-500 to-black',
    unranked: 'bg-slate-800',
  };

  const cls = colourMap[mastery.badge] || 'bg-slate-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs text-white font-semibold ${cls}`}>
      {mastery.title}
    </span>
  );
}

function EffectivenessBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const colour = pct >= 70 ? 'bg-green-500' : pct >= 30 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-xs text-white/50 font-mono w-28 shrink-0">World effectiveness</span>
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-white/60 font-mono w-8 text-right">{pct}%</span>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center bg-white/5 rounded px-2 py-1 min-w-[52px]">
      <span className="text-xs text-white/40 font-mono leading-none">{label}</span>
      <span className="text-sm text-white font-semibold font-mono">{value.toLocaleString()}</span>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ProgressionPanel({ skills, className = '' }: ProgressionPanelProps) {
  if (!skills.length) {
    return (
      <div className={`text-white/40 text-sm font-mono p-4 ${className}`}>
        No skills yet — practice in a world to begin levelling.
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {skills.map(skill => (
        <div
          key={skill.id}
          className="bg-black/60 border border-white/10 rounded-lg p-3 flex flex-col gap-2"
        >
          {/* Title row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-white font-semibold truncate">{skill.title}</span>
            <div className="flex items-center gap-2 shrink-0">
              <MasteryBadge mastery={skill.mastery} />
              {skill.worldLeaderboardPosition && (
                <span className="text-xs text-amber-400 font-mono">#{skill.worldLeaderboardPosition}</span>
              )}
            </div>
          </div>

          {/* Level */}
          <div className="text-xs text-white/60 font-mono">
            Level <span className="text-white font-bold text-sm">{skill.skill_level.toFixed(1)}</span>
          </div>

          {/* XP bar */}
          <XPBar current={skill.total_experience} next={skill.mastery.nextThreshold} />

          {/* World effectiveness */}
          {skill.effectivenessInCurrentWorld !== undefined && (
            <EffectivenessBar value={skill.effectivenessInCurrentWorld} />
          )}

          {/* Stat chips */}
          <div className="flex gap-1.5 flex-wrap mt-1">
            <StatChip label="Practice" value={skill.practice_count} />
            <StatChip label="Taught"   value={skill.teaching_count} />
            <StatChip label="Worlds"   value={skill.cross_world_uses} />
            <StatChip label="Hybrids"  value={skill.hybrid_contributions} />
          </div>

          {/* NPC recognition / teacher eligibility */}
          {(skill.mastery.npcRecognition || skill.mastery.teacherEligible) && (
            <div className="flex gap-2 flex-wrap mt-0.5">
              {skill.mastery.npcRecognition && (
                <span className="text-xs bg-emerald-900/60 text-emerald-300 rounded px-1.5 py-0.5">
                  NPC recognised
                </span>
              )}
              {skill.mastery.teacherEligible && (
                <span className="text-xs bg-blue-900/60 text-blue-300 rounded px-1.5 py-0.5">
                  Can teach
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

'use client';

/**
 * ProvenanceBadge — small pill indicating content provenance (Human / AI / AI-Assisted).
 * Derives classification from DTU source, model, and authority metadata fields.
 */

interface ProvenanceBadgeProps {
  source?: string;
  model?: string;
  authority?: string;
}

type Provenance = 'human' | 'ai' | 'ai-assisted';

function classify(source?: string, model?: string, authority?: string): Provenance {
  const s = (source || '').toLowerCase();
  const m = (model || '').toLowerCase();
  const a = (authority || '').toLowerCase();

  const isHuman = s.includes('user') || s.includes('manual') || a === 'human';
  const isAI = s.includes('autogen') || s.includes('meta-derivation') || /brain|llama|mistral|phi|gemma/.test(m);

  if (isHuman && isAI) return 'ai-assisted';
  if (isHuman) return 'human';
  if (isAI) return 'ai';
  return 'ai-assisted';
}

const PILL: Record<Provenance, { label: string; classes: string }> = {
  human:       { label: 'Human Created', classes: 'bg-green-500/15 text-green-400 border-green-500/30' },
  ai:          { label: 'AI Generated',  classes: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  'ai-assisted': { label: 'AI Assisted', classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
};

export function ProvenanceBadge({ source, model, authority }: ProvenanceBadgeProps) {
  const p = classify(source, model, authority);
  const { label, classes } = PILL[p];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${classes}`}>
      {label}
    </span>
  );
}

import { GameMode, registerGameMode } from '../game-mode-orchestrator';

const mentorMode: GameMode = {
  id: 'mentor',
  name: 'Mentor Session',
  description: 'Teach a skill to a nearby player. Earn teaching XP and preview your royalty stream.',
  icon: '◈',
  stages: [
    {
      id: 'select',
      name: 'Select Student',
      description: 'Pick a nearby player to teach.',
      inputMode: 'social',
      advanceWhen: { type: 'action', action: 'mentor_select_student' },
    },
    {
      id: 'intro',
      name: 'Introduction',
      description: 'Explain the skill via dialogue.',
      inputMode: 'conversation',
      advanceWhen: {
        type: 'any',
        triggers: [
          { type: 'action', action: 'mentor_intro_done' },
          { type: 'time', ms: 60_000 },
        ],
      },
    },
    {
      id: 'demo',
      name: 'Demonstration',
      description: 'Use the skill while your student watches.',
      inputMode: 'combat',
      advanceWhen: { type: 'event', event: 'skill:xp-awarded' },
    },
    {
      id: 'practice',
      name: 'Student Practice',
      description: 'Your student uses the skill. Teaching XP awarded to both.',
      inputMode: 'exploration',
      advanceWhen: {
        type: 'any',
        triggers: [
          { type: 'event', event: 'world:teaching-session:practiced' },
          { type: 'time', ms: 120_000 },
        ],
      },
    },
    {
      id: 'royalty',
      name: 'Royalty Preview',
      description: 'See the projected royalty stream from your lineage.',
      inputMode: 'lens_work',
      lensId: 'marketplace',
      advanceWhen: { type: 'time', ms: 15_000 },
    },
  ],
};

registerGameMode(mentorMode);
export default mentorMode;

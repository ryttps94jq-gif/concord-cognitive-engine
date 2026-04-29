import { GameMode, registerGameMode } from '../game-mode-orchestrator';

const architectMode: GameMode = {
  id: 'architect',
  name: 'Architect Mode',
  description: 'Design something. The system auto-cycles through specialist lenses to make your creation as advanced as possible, then guides you to publish it.',
  icon: '◆',
  stages: [
    {
      id: 'spec',
      name: 'Describe',
      description: 'Open the creation workshop and describe what you want to build.',
      inputMode: 'creation',
      advanceWhen: { type: 'event', event: 'creation:preview-generated' },
    },
    {
      id: 'enrich',
      name: 'Enrich',
      description: 'Each lens adds specialized knowledge to your design.',
      inputMode: 'lens_work',
      lensSequence: ['studio', 'code', 'graph', 'research'],
      lensDwellMs: 8000,
      advanceWhen: {
        type: 'any',
        triggers: [
          { type: 'score', min: 80, scoreKey: 'creation.validationScore' },
          { type: 'time', ms: 35000 },
        ],
      },
    },
    {
      id: 'finalize',
      name: 'Place',
      description: 'Confirm placement with enriched suggestions applied.',
      inputMode: 'creation',
      advanceWhen: { type: 'event', event: 'creation:placed' },
    },
    {
      id: 'publish',
      name: 'Publish',
      description: 'List your creation on the marketplace.',
      inputMode: 'lens_work',
      lensId: 'marketplace',
      advanceWhen: { type: 'any', triggers: [
        { type: 'action', action: 'list_dtu' },
        { type: 'time', ms: 60000 },
      ]},
    },
  ],
};

registerGameMode(architectMode);
export default architectMode;

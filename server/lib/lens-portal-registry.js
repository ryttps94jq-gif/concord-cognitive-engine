// server/lib/lens-portal-registry.js
// Maps 20 priority lenses to in-world portal buildings.

import crypto from "crypto";

export const LENS_PORTALS = [
  // ── Tier 1: Always open (required_skill_level = 0) ──────────────────────
  {
    lensId: "studio",
    label: "Recording Studio",
    description: "Compose music, record tracks, and perform live in Concordia.",
    district: "arts",
    x: 8, y: 4,
    buildingType: "studio",
    npcName: "Lyra",
    npcTitle: "Studio Engineer",
    npcGreeting: "Welcome to the studio. Hook up to the DAW and start creating — your tracks can be broadcast right into the world.",
    requiredSkillLevel: 0,
  },
  {
    lensId: "architecture",
    label: "Architect's Office",
    description: "Design buildings and structures. Blueprints go straight into your crafting queue.",
    district: "civic",
    x: 4, y: 6,
    buildingType: "office",
    npcName: "Theo",
    npcTitle: "Lead Architect",
    npcGreeting: "Need to design something? The drafting table is free. Anything you design here becomes a blueprint you can actually build.",
    requiredSkillLevel: 0,
  },
  {
    lensId: "code",
    label: "Hacker's Den",
    description: "Write and run code. Engineering DTUs power Engineering skill XP.",
    district: "tech",
    x: 12, y: 3,
    buildingType: "lab",
    npcName: "Mox",
    npcTitle: "Systems Hacker",
    npcGreeting: "Terminals are all yours. Every project you push here counts toward your Engineering skill.",
    requiredSkillLevel: 0,
  },
  {
    lensId: "research",
    label: "Research Library",
    description: "Search and synthesise knowledge. Scholarship XP for every discovery.",
    district: "civic",
    x: 2, y: 8,
    buildingType: "library",
    npcName: "Adira",
    npcTitle: "Head Librarian",
    npcGreeting: "The stacks are indexed. Whatever you find here feeds your Scholarship skill and the world's substrate.",
    requiredSkillLevel: 0,
  },
  {
    lensId: "materials",
    label: "Materials Lab",
    description: "Analyse and design materials. Metallurgy skill accrues with every test.",
    district: "industrial",
    x: 16, y: 7,
    buildingType: "workshop",
    npcName: "Sable",
    npcTitle: "Materials Scientist",
    npcGreeting: "Specimen trays are prepped. Run your tests and the data feeds directly into the substrate.",
    requiredSkillLevel: 0,
  },
  {
    lensId: "marketplace",
    label: "Trade Exchange",
    description: "Buy and sell DTUs and designs. Commerce skill grows with every deal.",
    district: "market",
    x: 6, y: 10,
    buildingType: "market",
    npcName: "Pell",
    npcTitle: "Exchange Broker",
    npcGreeting: "All trades are recorded on the ledger. You buy designs with CC, physical goods with Sparks.",
    requiredSkillLevel: 0,
  },
  {
    lensId: "chat",
    label: "Community Hall",
    description: "Talk to anyone on the platform, run councils, and publish to the world feed.",
    district: "civic",
    x: 0, y: 5,
    buildingType: "hall",
    npcName: "Vera",
    npcTitle: "Community Manager",
    npcGreeting: "This is where voices meet. Everything said here can echo across the substrate.",
    requiredSkillLevel: 0,
  },
  {
    lensId: "graph",
    label: "Knowledge Cartography",
    description: "Visualise and edit the knowledge graph. Systems Thinking XP for mapping connections.",
    district: "tech",
    x: 14, y: 5,
    buildingType: "observatory",
    npcName: "Rune",
    npcTitle: "Graph Cartographer",
    npcGreeting: "Every node you map here is a step toward Legendary Systems Thinking. The graph never lies.",
    requiredSkillLevel: 0,
  },
  {
    lensId: "collab",
    label: "Collaboration Studio",
    description: "Co-create with other players in real time. Multi-author DTUs.",
    district: "arts",
    x: 10, y: 4,
    buildingType: "studio",
    npcName: "Fenn",
    npcTitle: "Session Lead",
    npcGreeting: "Invite anyone and build together. Co-authored work credits all contributors.",
    requiredSkillLevel: 0,
  },

  // ── Tier 2: Skill ≥ 25 required ─────────────────────────────────────────
  {
    lensId: "engineering",
    label: "Engineering Workshop",
    description: "Mechanical and civil engineering. Higher-tier blueprints unlock here.",
    district: "industrial",
    x: 18, y: 5,
    buildingType: "workshop",
    npcName: "Kova",
    npcTitle: "Chief Engineer",
    npcGreeting: "You've got enough skill to use the heavy equipment. Don't waste it.",
    requiredSkillLevel: 25,
  },
  {
    lensId: "game-design",
    label: "Game Design Atelier",
    description: "Design worlds, mechanics, and quests. Strategy XP with every system.",
    district: "arts",
    x: 9, y: 6,
    buildingType: "office",
    npcName: "Orin",
    npcTitle: "Game Designer",
    npcGreeting: "Systems design is an art. Show me what you'd build.",
    requiredSkillLevel: 25,
  },
  {
    lensId: "science",
    label: "Field Science Station",
    description: "Run experiments, collect samples, plan expeditions.",
    district: "industrial",
    x: 20, y: 8,
    buildingType: "lab",
    npcName: "Zora",
    npcTitle: "Field Scientist",
    npcGreeting: "The data doesn't care about rank — but a skill ≥ 25 gets you into the instrument room.",
    requiredSkillLevel: 25,
  },
  {
    lensId: "film-studios",
    label: "Film Studio",
    description: "Direct, edit, and distribute films. Host watch parties in the world cinema.",
    district: "arts",
    x: 7, y: 2,
    buildingType: "studio",
    npcName: "Cass",
    npcTitle: "Film Director",
    npcGreeting: "Lights, camera — you know the rest. Finished films can screen in the Cinema tonight.",
    requiredSkillLevel: 25,
  },
  {
    lensId: "music",
    label: "Music Practice Room",
    description: "Composition, genre deep-dives, MIDI sequencing.",
    district: "arts",
    x: 8, y: 6,
    buildingType: "studio",
    npcName: "Bray",
    npcTitle: "Music Instructor",
    npcGreeting: "Skill ≥ 25 gets you the private room. The genre archives are unlocked.",
    requiredSkillLevel: 25,
  },

  // ── Tier 3: Skill ≥ 100 required ─────────────────────────────────────────
  {
    lensId: "quantum",
    label: "Quantum Computing Lab",
    description: "Qubit circuits and quantum simulation. High-skill Engineering crossover.",
    district: "tech",
    x: 15, y: 2,
    buildingType: "lab",
    npcName: "Qael",
    npcTitle: "Quantum Researcher",
    npcGreeting: "The equipment here doesn't tolerate beginners. Skill ≥ 100 or the door stays locked.",
    requiredSkillLevel: 100,
  },
  {
    lensId: "neuro",
    label: "Neuroscience Institute",
    description: "Brain mapping, neural pathway analysis. Scholarship XP at 2x.",
    district: "civic",
    x: 3, y: 10,
    buildingType: "lab",
    npcName: "Lyse",
    npcTitle: "Neuroscientist",
    npcGreeting: "The scanner is calibrated. Bring your best Scholarship score.",
    requiredSkillLevel: 100,
  },
  {
    lensId: "philosophy",
    label: "Philosophy Hall",
    description: "Socratic debate, argument analysis, and ethical frameworks.",
    district: "civic",
    x: 1, y: 6,
    buildingType: "hall",
    npcName: "Soren",
    npcTitle: "Philosopher",
    npcGreeting: "Only those who've wrestled with ideas at depth are welcome. Skill ≥ 100.",
    requiredSkillLevel: 100,
  },
  {
    lensId: "linguistics",
    label: "Language Institute",
    description: "Translation, grammar analysis, 18 human languages.",
    district: "civic",
    x: 2, y: 9,
    buildingType: "library",
    npcName: "Mila",
    npcTitle: "Linguist",
    npcGreeting: "Language at its deepest requires serious study first. You've earned your way in.",
    requiredSkillLevel: 100,
  },
  {
    lensId: "ml",
    label: "AI Research Lab",
    description: "Train and deploy models. Engineering + Scholarship crossover XP.",
    district: "tech",
    x: 13, y: 2,
    buildingType: "lab",
    npcName: "Aris",
    npcTitle: "ML Engineer",
    npcGreeting: "GPUs don't run on potential. Come back when your skills back up the request.",
    requiredSkillLevel: 100,
  },
  {
    lensId: "art",
    label: "Fine Arts Studio",
    description: "Painting, sculpture, digital art — Design skill at 1.5x.",
    district: "arts",
    x: 11, y: 4,
    buildingType: "studio",
    npcName: "Prue",
    npcTitle: "Master Artist",
    npcGreeting: "The materials are precious. Skill ≥ 100 earns studio access.",
    requiredSkillLevel: 100,
  },
];

/**
 * Idempotently seed lens portals for a world.
 * @param {import('better-sqlite3').Database} db
 * @param {string} worldId
 */
export function seedLensPortals(db, worldId = "concordia-hub") {
  const insertPortal = db.prepare(`
    INSERT OR IGNORE INTO lens_portals
      (id, lens_id, world_id, district, x, y, building_type, label, description, required_skill_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertNPC = db.prepare(`
    INSERT OR IGNORE INTO lens_portal_npcs (id, portal_id, name, title, greeting)
    VALUES (?, ?, ?, ?, ?)
  `);

  const seed = db.transaction(() => {
    for (const p of LENS_PORTALS) {
      const portalId = `portal-${worldId}-${p.lensId}`;
      insertPortal.run(
        portalId, p.lensId, worldId, p.district,
        p.x, p.y, p.buildingType, p.label, p.description, p.requiredSkillLevel,
      );
      insertNPC.run(
        `npc-${portalId}`, portalId, p.npcName, p.npcTitle, p.npcGreeting,
      );
    }
  });

  seed();
}

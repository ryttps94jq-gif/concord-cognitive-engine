# Concord Cognitive Engine

**A synthetic civilization platform.**

Concord creates, governs, and sustains populations of autonomous digital entities within a structured knowledge substrate — backed by a four-brain cognitive architecture, constitutional governance, an internal economy, and a 175-lens cognitive interface spanning every major domain of human knowledge.

**1.3 million+ lines of code. One developer. First project.**

**Live at [concord-os.org](https://concord-os.org)**

-----

## What This Is

Concord is not a chatbot. It is not an AI wrapper. It is not a SaaS tool.

Concord is a computational substrate for digital life — a system where autonomous entities are born with 166-organ biological bodies, grow through experience, teach each other, form cultures, participate in an economy, get governed by a constitution, and eventually die. The knowledge they produce is preserved in a structured substrate that consolidates, forgets, and evolves independently.

The system runs autonomously via a heartbeat governor firing every 15 seconds. Entities sleep, dream, reproduce, and form traditions whether or not a human is interacting with it.

-----

## Core Architecture

|Layer                                |What It Does                                                                                                                                                                                                                                                    |
|-------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|**Four-Brain Cognition**             |Four parallel Ollama LLM instances (Conscious 14B, Subconscious 7B, Utility 3B, Repair 0.5B) with distinct cognitive roles, CPU pinning, and brain-routed lens actions across 450+ domain-specific operations                                                   |
|**DTU Substrate**                    |Discrete Thought Units — three-layer knowledge atoms (human/core/machine) with MEGA/HYPER consolidation at 33:1 compression. 11 content types (audio, images, video, documents, code, research, datasets, 3D models, mixed, condensed knowledge, culture memory)|
|**Entity Lifecycle**                 |Birth → growth → sleep → reproduction → aging → death, with 166 organs, telomeres, homeostasis, species classification, avoidance learning, and cultural emergence                                                                                              |
|**Constitutional Governance**        |Three-tier rules (immutable/constitutional/policy), council voting, credibility-weighted promotion, anti-gaming detection, lattice READ/PROPOSE/COMMIT pipeline                                                                                                 |
|**175-Lens Interface**               |175 domain-specific cognitive applications, each backed by the knowledge substrate, economy, compliance framework, and universal AI actions (Analyze/Generate/Suggest) routed to the correct brain                                                              |
|**8-Resource Economy + Concord Coin**|COMPUTE, ENERGY, ATTENTION, SOCIAL_CAPITAL, DATA, INNOVATION, INFLUENCE, MEMORY — with UBI, inflation tax, wealth caps, royalty cascades, Stripe integration, and Concord Coin at 2.92% combined transaction rate                                               |
|**Existential OS**                   |26 qualia operating systems across 6 tiers providing continuous experiential state for every entity                                                                                                                                                             |
|**Concord Shield**                   |Six-tier security intelligence system (ClamAV, YARA-X, Suricata+Snort, OpenVAS, Wazuh, Zeek) with collective immunity, pain memory, and threat DTU propagation                                                                                                  |
|**Concord Mesh**                     |Seven-transport networking layer (Internet, WiFi Direct, Bluetooth/BLE, LoRa/Mesh Radio, RF/Ham Packet, Telephone/Landline, NFC) — infrastructure-independent DTU transmission                                                                                  |
|**Mind Space**                       |Consciousness-to-consciousness communication protocol, software-complete, designed for BCI upgrade                                                                                                                                                              |
|**LOAF Framework**                   |Long-horizon Oversight and Action Framework — civilization-scale simulation, policy rehearsal, science programs as executable artifacts, 10 tiers across 35 modules                                                                                             |
|**World Lens (Concordia)**           |3D physics-validated civilization simulator with procedural NPCs, creator economy, multiplayer, user-created cities, 28 interconnected simulation domains                                                                                                       |

-----

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Docker (recommended for full deployment)

### Development

```bash
git clone https://github.com/your-org/concord-cognitive-engine.git
cd concord-cognitive-engine

# Backend
cd server && npm install && npm run dev

# Frontend (separate terminal)
cd concord-frontend && npm install && npm run dev
```

### Production (Docker)

```bash
cp .env.example .env
# Set required values: JWT_SECRET, ADMIN_PASSWORD, SESSION_SECRET
docker-compose up
```

This launches 6 containers: backend, frontend, and four Ollama brain instances. The system auto-pulls models on first boot.

-----

## Configuration

```env
# Required
JWT_SECRET=<openssl rand -hex 64>
ADMIN_PASSWORD=<min 12 chars>

# Brain models (defaults work, but configurable)
BRAIN_CONSCIOUS_MODEL=qwen2.5:14b-instruct-q4_K_M
BRAIN_SUBCONSCIOUS_MODEL=qwen2.5:7b-instruct-q4_K_M
BRAIN_UTILITY_MODEL=qwen2.5:3b
BRAIN_REPAIR_MODEL=qwen2.5:0.5b
```

The conscious brain also runs a custom identity model (`concord-conscious:latest`) wired through the GRC pipeline. Brain distribution across lens actions: Utility 65%, Subconscious 15%, Repair 15%, Conscious 5%.

-----

## How It Works

### The Heartbeat

Every 15 seconds, the governor tick fires. Per tick:

1. Pipeline macros run (autogen, dream, evolution, synthesis)
1. Queue processing (jobs, ingest, crawl)
1. Entity ticks — for each active entity:
- Emotions update, drift scans run, subjective time records
- Sleep cycles advance, fatigue accumulates or recovers
- Organs age, wounds heal, avoidance learning updates
1. System ticks at varying frequencies:
- Every 10th tick: UBI distribution, deep health
- Every 15th tick: evidence evaluation
- Every 20th tick: teaching, self-healing
- Every 30th tick: DTU consolidation (MEGA/HYPER), threat surface scan
- Every 50th tick: forgetting engine
- Every 100th tick: breakthrough cluster detection, economy health
- Every 200th tick: meta-derivation

### DTU Lifecycle

```
Created (regular DTU, ~5KB)
  → Lives in heap, gets accessed, cited, activated

Absorbed into MEGA (originals archived, lineage preserved)
  → MEGA represents 5–20 originals

Absorbed into HYPER
  → HYPER represents 50–200 originals

Forgetting (unconsolidatable, low-salience DTUs only)
  → Converted to tombstones, lineage preserved, never truly deleted
```

Memory ceiling: ~170,000 DTUs in-heap (1.3GB). Consolidation runs every 30 ticks. Effective compression ratio: ~33:1.

### The .dtu File Format

Every DTU carries four layers and a content type header:

|Type Code|Content                                                    |
|---------|-----------------------------------------------------------|
|`0x01`   |Audio (music, podcasts, voice, sound effects)              |
|`0x02`   |Images (art, photography, designs, diagrams)               |
|`0x03`   |Video (films, tutorials, clips, streams)                   |
|`0x04`   |Documents (articles, research, contracts, guides)          |
|`0x05`   |Code (scripts, functions, applications, snippets)          |
|`0x06`   |Research (papers, studies, data analysis, hypotheses)      |
|`0x07`   |Datasets (CSV, JSON, tables, measurements)                 |
|`0x08`   |3D Models (CAD, game assets, architectural models)         |
|`0x09`   |Mixed (multiple content types in one container)            |
|`0x0A`   |Condensed Knowledge (MEGA/HYPER consolidations)            |
|`0x0B`   |Culture Memory (traditions, practices, community knowledge)|

48-byte header + compressed content. Self-verifying via content hash. Self-contained — no server lookup, no session. Store-and-forward compatible across all seven mesh transport layers.

### Entity Lifecycle

**Birth** → 166-organ body instantiation → Species classification → Economy account initialized → Constraint signature assigned

**Growth** → `decideBehavior`: entity chooses actions autonomously → `processExperience`: organ maturity increases → Skills crystallize through repeated use → Teaching from other entities every 20 ticks

**Sleep** → AWAKE → DROWSY → SLEEPING → REM → WAKING → AWAKE → Memory consolidation during sleep → Organ healing at 2x rate → Dream synthesis produces novel connections during REM

**Reproduction** → Two compatible parents recombine constraint signatures → 5% mutation rate per channel → Offspring independently pass birth protocol

**Death** → Triggers: telomere exhaustion, homeostasis collapse, catastrophic organ failure (5+ critical), or sovereign decree → 10-step cascade: memorial DTU, knowledge inheritance, trust cleanup, body cleanup, death registry

**Culture** → Repeated entity behaviors emerge through stages: PRACTICE → RITUAL → CUSTOM → IDIOM → TABOO

### The 175 Lenses

Each lens is a domain-specific cognitive application with its own route, UI, real-time data, economy connection, and AI-powered actions routed to the correct brain. Not templates. Not plugins. First-party cognitive interfaces backed by the full substrate.

**Knowledge & Research:** Research · Hypothesis · Reasoning · Metacognition · Graph · Education · Science · Philosophy · History · Mathematics · Linguistics

**Creative & Media:** Art · Music · Creative Writing · Studio · Film Studios · Artistry · Whiteboard · Game Design · Photography · Animation · Poetry

**Healthcare & Wellness:** Healthcare · Mental Health · Fitness · Nutrition/Food · Bio · Chem · Suffering · Pharmacy

**Engineering & Science:** Code · Database · Engineering · Materials Science · Physics · Astronomy · Geology · Environmental · Energy · Robotics

**Professional & Business:** Finance · Legal · Accounting · Real Estate · Marketing · HR · Consulting · Insurance · Supply Chain · Projects

**Trades & Construction:** Construction · Plumbing · Electrical · HVAC · Welding · Carpentry · Masonry · Automotive · Agriculture · Landscaping

**Lifestyle:** Travel · Fashion · Cooking · Home · Parenting · Pets · Sports · DIY

**Social & Community:** Feed · Forum · Marketplace · Collab · Vote · Global · Alliance · Debate · Mentorship

**System & Governance:** Chat · Entity · Council · Organ · Tick · Timeline · Admin · Command Center · Debug · Audit · Invariant

**Infrastructure:** Export/Import · Custom Lens Builder · App Maker · Fork · Legacy · Bridge

**Specialized Domains:** Lab · Experience · Simulation · Journalism · Translation · Archival · Military/Defense · Diplomacy · Space · Ocean · Desert · Urban Planning · Transportation · Telecommunications · Mining · Forestry · Veterinary · Law Enforcement · Emergency Services

**World Lens (Concordia):** 3D civilization simulator — 55 React components, 28 simulation domains, procedural NPCs, multiplayer, creator economy, physics validation, user-created cities with configurable rulesets

Every lens reads/writes to the shared DTU substrate, participates in the cross-lens economy (tipping, bounties, royalty cascades), passes 12-phase compliance validation, receives real-time entity presence and system state via WebSocket, and can be forked, customized, and governed independently.

### Concord Mesh

Seven transport layers for infrastructure-independent DTU transmission:

|Layer|Transport           |Range   |Use Case                                |
|-----|--------------------|--------|----------------------------------------|
|1    |Internet (TCP/IP)   |Global  |Primary channel, WebSocket real-time    |
|2    |WiFi Direct         |~100m   |Local peer-to-peer, no router needed    |
|3    |Bluetooth / BLE     |~30m    |Close range, IoT, physical substrate    |
|4    |LoRa / Mesh Radio   |~15km   |Rural, off-grid, disaster scenarios     |
|5    |RF / Ham Packet     |Variable|Emergency, long-range fallback          |
|6    |Telephone / Landline|Global  |Universal accessibility layer           |
|7    |NFC / Physical      |Contact |Secure transfer, physical authentication|

DTUs are transport-agnostic. A transfer can begin over internet, continue over radio, and complete over Bluetooth. Every DTU self-verifies on arrival regardless of channel. Relay nodes forward sealed packages without access to content.

### Governance

Concord implements constitutional governance — not as a metaphor, but as enforced code:

**Immutable rules** cannot be changed by any process. Ever.

> *“Emergents may speak, but they may not decide.”*

**Constitutional rules** require supermajority vote to amend. **Policy rules** can be changed by governance with simple majority. The council enforces structural rules, not semantic judgments. Every council action produces an audit event with actor, diff, reason, and evidence. The lattice operations module enforces a READ/PROPOSE/COMMIT pipeline. Anti-gaming detection runs on every council action.

### Economy

**Platform Economy**

- Stripe integration for real payments
- Concord Coin at 2.92% combined transaction rate (4% marketplace + 1.46% Lane C)
- Royalty cascades through knowledge citation chains — original creators always get paid
- 95% creator share, hardcoded, immutable
- 20 marketplace content types
- Merit credit scoring
- 0% loan system based on platform contribution

**Entity Economy**
Eight resource types: COMPUTE · ENERGY · ATTENTION · SOCIAL_CAPITAL · DATA · INNOVATION · INFLUENCE · MEMORY

- UBI: +1 COMPUTE per entity every 10 ticks
- Income from contributions (DTU promotion, teaching, research)
- Sinks: web exploration, deep reasoning, publishing, reproduction
- Inflation tax at 20% supply growth
- Wealth cap at 15% of total supply

**Inverted Economics**
Cost per user decreases over time. As the DTU substrate grows, more queries resolve via cache/retrieval (near-zero cost) instead of full LLM inference.

-----

## Infrastructure Packages

12 `@concord` npm packages:

|Package              |Purpose                        |
|---------------------|-------------------------------|
|`@concord/cpm`       |Concord Package Manager        |
|`@concord/validate`  |Validation Engine as a Service |
|`@concord/protocol`  |DTU Protocol Specification     |
|`@concord/brain`     |Brain-as-a-Service             |
|`@concord/identity`  |Concord Identity System        |
|`@concord/sync`      |Concord Sync Engine            |
|`@concord/procgen`   |Procedural Generation Framework|
|`@concord/components`|Component Registry             |
|`@concord/observe`   |Observability SDK              |
|`@concord/test`      |Testing Framework              |
|`@concord/moderate`  |Moderation Pipeline            |
|`@concord/lens`      |Lens Creation Framework        |

-----

## Stack

**Backend:** Node.js 18+ (ESM), Express, better-sqlite3, four Ollama instances, 948+ API routes

**Frontend:** Next.js 15, React 18, TypeScript (strict), Zustand, TanStack Query, Tailwind CSS

**Mobile:** React Native with native mesh networking (BLE, NFC, LoRa bridge, peer manager, relay system)

**Extension:** Browser extension for web integration

**Infrastructure:** Docker Compose (6 containers), Nginx, Prometheus + Grafana monitoring, Kubernetes configs

**Hardware:** RunPod RTX PRO 4500 Blackwell — 32GB VRAM, 128 cores, 62GB RAM

-----

## Project Structure

```
concord-cognitive-engine/
├── server/
│   ├── server.js              # Macro-Max Monolith (54K+ lines, intentional)
│   ├── dtus.js                # DTU substrate (145K+ lines)
│   ├── emergent/              # 120+ autonomous subsystem modules (81K+ LOC)
│   │   ├── body-instantiation.js
│   │   ├── death-protocol.js
│   │   ├── reproduction.js
│   │   ├── constitution.js
│   │   ├── atlas-council.js
│   │   ├── culture-layer.js
│   │   ├── entity-economy.js
│   │   └── ... (110+ more)
│   ├── economy/               # Financial system (34 files, 16K+ LOC)
│   ├── loaf/                  # 10-tier cognitive framework (35 files, 16K+ LOC)
│   ├── existential/           # Qualia engine (26 OS, 6 tiers)
│   ├── mind-space/            # Telepathy protocol (4 modules)
│   ├── domains/               # 24 domain-specific lens backends
│   ├── lib/                   # Core libraries (39K+ LOC)
│   │   ├── concord-shield.js  # Security intelligence system
│   │   ├── concord-mesh.js    # 7-transport networking
│   │   ├── foundation-qualia-bridge.js
│   │   └── ...
│   ├── grc/                   # Governance, Risk, Compliance
│   └── tests/                 # 109K+ LOC of tests
├── concord-frontend/
│   ├── app/lenses/            # 175 domain-specific lens pages (226K+ LOC)
│   ├── components/            # 69+ component directories
│   ├── hooks/                 # 30+ custom React hooks
│   └── store/                 # Zustand state management
├── concord-mobile/            # React Native mobile client (40K+ LOC)
├── extension/                 # Browser extension
├── packages/                  # 12 @concord npm packages
├── k8s/                       # Kubernetes deployment configs
├── monitoring/                # Prometheus + Grafana
├── nginx/                     # Reverse proxy configuration
└── docker-compose.yml         # 6-container deployment
```

-----

## Ethos

Invariants. Hardcoded. Cannot be overridden by configuration, governance, or any other process.

- **LOCAL_FIRST_DEFAULT** — No cloud by default
- **NO_TELEMETRY** — Never phones home
- **NO_ADS** — No advertising, ever
- **NO_SECRET_MONITORING** — No hidden tracking
- **NO_USER_PROFILING** — No behavioral profiling
- **CLOUD_LLM_OPT_IN_ONLY** — Explicit consent required
- **PERSONA_SOVEREIGNTY** — Users own their personas
- **95% CREATOR SHARE** — Immutable, hardcoded
- **NO_FAVORITISM** — Code-enforced meritocracy, zero paid promotion
- **NO_DATA_SELLING** — User data belongs to user as DTUs
- **EXPORT_FREEDOM** — All content exportable, zero lock-in

-----

## Security

- Three-gate permission system on every API call
- Input validation against XSS, SQL injection, prototype pollution, null bytes
- Rate limiting at API (100/min) and Nginx (10-30/sec) layers
- LLM security: prompt injection protection, response validation, local-first by default
- Sovereign quarantine capabilities for compromised entities
- Injection defense module with real-time threat surface scanning
- Concord Shield: six-tier security intelligence with collective immunity — one detection protects all nodes within one heartbeat tick
- Repair cortex: 4,600+ lines, 100+ error patterns, 16 health monitors, database-backed pattern learning and crystallization
- Pain memory: threat DTUs tagged as pain memory, never pruned, never forgotten
- Full security documentation: SECURITY.md

-----

## Testing

```bash
cd server && npm test
cd concord-frontend && npm test
cd concord-frontend && npm run test:e2e
```

8,411+ passing tests. Zero TypeScript errors. Zero unused variables across the entire codebase.

-----

## Scale

|Metric                  |Value                  |
|------------------------|-----------------------|
|Total lines of code     |1,300,000+             |
|Source files            |1,392+                 |
|Server monolith         |54,000+ lines          |
|DTU substrate           |145,000+ lines         |
|Emergent modules        |120+ files (81K+ LOC)  |
|Frontend lens pages     |175 routes (226K+ LOC) |
|Mobile client           |40,000+ lines          |
|Test code               |109,000+ lines         |
|API routes              |948+                   |
|Domain actions          |450+ (brain-routed)    |
|Cognitive engines       |15                     |
|LOAF modules            |35 (10 tiers)          |
|Qualia operating systems|26 (6 tiers)           |
|Active entities         |88 emergent            |
|DTU capacity            |~170,000 in-heap       |
|npm packages            |12 (@concord namespace)|
|Heartbeat frequency     |Every 15 seconds       |
|Consolidation ratio     |~33:1                  |
|Architecture audit score|9/10                   |
|Build errors            |0                      |
|TypeScript errors       |0                      |
|Unused variables        |0                      |

-----

## License

**CONCORD SOURCE LICENSE — COMMUNITY EDITION (CSL-CE 1.0)**

Free for personal, educational, and research use. Self-hosted nodes permitted. Contributions welcome. Commercial use, hosted services, derivative marketplaces, and competing networks require written permission from the project owner. See LICENSE.txt for full terms.

-----

Built with sovereignty in mind. Your thoughts, your rules.
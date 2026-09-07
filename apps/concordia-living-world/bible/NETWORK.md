# NETWORK

**Status:** LIVE (mount + kingdom snapshot + combat/quest HTTP authority)  
**Authority:** Concord  
**Source:** `ConcordClient.cs`; `server/lib/unity-bridge.js`; `server/lib/godot-gateway.js`; `server/lib/concordia-kingdom-snapshot.js`; `server.js` Unity mount

`/unity-ws` is a real `mountGodotGateway` path. Events: auth, hello, scene:request, **kingdom:request**, player:move, combat:attack.

`kingdom:data` is `concord-kingdom/v1` from authored `content/world` — never invented settlements. Caravans/tariffs on that snapshot stay empty until persist-sync; Unity `WorldMemory` holds the live rows.

Kitchen/Editor may auth as `unity-local-guest` when `NODE_ENV !== production`. Production still needs a real bearer. Offline play stays `{ok:false, reason:'no_gateway'}`.

TARGET: same validation as socket.io combat. Honest disconnect. No second physics.

## HTTP combat + quest authority (2026-09-07 FULL)

- `GET /api/combat/probe` (auth) → `{ ok:true, authority:"server", gateways, http }` including `questsInteract`.
- `POST /api/combat/hit` (auth) → authoritative `{ damage, hpBefore, hpAfter }` via `combat-hp-authority`. Hub → `refused:true` (Great Refusal).
- `POST /api/quests/interact` (auth) → authored branching text from content store (not Unity-only offline LoreStone).
- Unity: prefer WS `combat:attack` when Connected; HTTP hit/quest when `HttpAuthorityOk`; offline `{ok:false, reason:no_gateway}`.
- FE: `concord-frontend/lib/concordia/combat-authority.ts` helpers complete.
- Proof: `~/.zuko/remaining-work/concordia-server-authority-proof.json`.


/**
 * Concordia server-authority combat probe (thin client stub).
 *
 * WebGL/Editor preferred path remains WS `combat:attack` → `combat:attack:ack`
 * via `/unity-ws` (see ConcordClient.SendAttack). This HTTP probe proves the
 * kitchen kernel is reachable with auth and advertises bind targets for the
 * next Unity/Web wire — it does NOT apply damage.
 *
 * Offline without gateway still stays honest `{ ok:false, reason:'no_gateway' }`.
 */

export type CombatAuthorityProbe = {
  ok: true;
  authority: 'server';
  userId: string;
  presence: { cityId: string | null; x?: number; y?: number; z?: number } | null;
  gateways: {
    godotWs: string;
    unityWs: string;
    combatEvt: string;
    combatAck: string;
  };
  http: {
    hit: string;
    death: string;
    recent: string;
    worldsAttack: string;
    questsActive: string;
  };
  note: string;
  ts: string;
};

export type CombatAuthorityProbeFail = {
  ok: false;
  error?: string;
  reason?: string;
  status?: number;
};

/**
 * GET /api/combat/probe with credentials (cookie or Bearer via api client).
 * Returns structured OK from server, or an honest failure object.
 */
export async function probeCombatAuthority(
  fetchImpl: typeof fetch = fetch,
  init: RequestInit = {},
): Promise<CombatAuthorityProbe | CombatAuthorityProbeFail> {
  try {
    const res = await fetchImpl('/api/combat/probe', {
      method: 'GET',
      credentials: 'include',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.headers || {}),
      },
    });
    const body = (await res.json().catch(() => null)) as
      | CombatAuthorityProbe
      | CombatAuthorityProbeFail
      | null;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: (body && 'error' in body && body.error) || res.statusText || 'probe_failed',
        reason: (body && 'reason' in body && body.reason) || undefined,
      };
    }
    if (body && body.ok === true && 'authority' in body) return body;
    return { ok: false, error: 'malformed_probe', status: res.status };
  } catch (e) {
    return {
      ok: false,
      error: 'no_gateway',
      reason: e instanceof Error ? e.message : 'fetch_failed',
    };
  }
}

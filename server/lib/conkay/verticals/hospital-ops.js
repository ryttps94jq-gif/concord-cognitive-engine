// server/lib/conkay/verticals/hospital-ops.js
// Real-Time Hospital Ops & Predictive Triage — SYNTHETIC patient data ONLY.
// Honesty: NOT clinical advice, NOT FDA, NOT a deployed clinical system.

import { applyDHTP } from '../../dhtp.js';
import { createHash, randomUUID } from 'crypto';

const CHIEFS = [
  'chest_pain', 'shortness_of_breath', 'abdominal_pain', 'fever', 'fall',
  'laceration', 'headache', 'syncope', 'nausea', 'back_pain', 'ankle_sprain',
  'allergic_reaction', 'palpitations', 'confusion', 'wound_check',
];
const ESI = [1, 2, 3, 4, 5];

function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Generate N≥200 synthetic EHR-like intake records. */
export function generateSyntheticIntakeBatch({ n = 200, seed = 42 } = {}) {
  const N = Math.max(200, Math.min(5000, Number(n) || 200));
  const rnd = seededRng(Number(seed) || 42);
  const patients = [];
  for (let i = 0; i < N; i++) {
    const age = 1 + Math.floor(rnd() * 98);
    const sex = rnd() < 0.5 ? 'F' : 'M';
    const chief = CHIEFS[Math.floor(rnd() * CHIEFS.length)];
    const hr = 50 + Math.floor(rnd() * 80);
    const sbp = 90 + Math.floor(rnd() * 80);
    const spo2 = 88 + Math.floor(rnd() * 12);
    const tempC = 36 + rnd() * 3.2;
    const esiHint = ESI[Math.floor(rnd() * ESI.length)];
    patients.push({
      id: `SYN-${String(i + 1).padStart(5, '0')}`,
      synthetic: true,
      age,
      sex,
      chiefComplaint: chief,
      vitals: { hr, sbp, spo2, tempC: Number(tempC.toFixed(1)) },
      arrivalMinAgo: Math.floor(rnd() * 240),
      esiHint,
      comorbidities: rnd() < 0.35 ? ['htn'] : rnd() < 0.5 ? ['dm2'] : [],
    });
  }
  return {
    ok: true,
    n: patients.length,
    patients,
    honesty: {
      syntheticOnly: true,
      clinicalAdvice: false,
      fda: false,
      note: 'SYNTHETIC ONLY — fake EHR-like intake; not real PHI; not clinical advice',
    },
  };
}

/**
 * DHTP-style packetize: prefer live applyDHTP; always also emit a local
 * structural packet (JSON → refs + brotli-ish size via JSON fingerprint).
 */
export function compressHospitalPackets(batch, { preferDhtp = true } = {}) {
  const t0 = Date.now();
  const patients = batch?.patients || [];
  const rawJson = JSON.stringify(patients);
  const originalBytes = Buffer.byteLength(rawJson, 'utf8');

  // Local DHTP-style packetizer: keep risk features + ids, drop verbose vitals dump
  const packets = patients.map((p) => ({
    id: p.id,
    a: p.age,
    s: p.sex,
    cc: p.chiefComplaint,
    esi: p.esiHint,
    hr: p.vitals?.hr,
    sbp: p.vitals?.sbp,
    spo2: p.vitals?.spo2,
    t: p.vitals?.tempC,
    wait: p.arrivalMinAgo,
    cx: (p.comorbidities || []).join(','),
  }));
  const packetJson = JSON.stringify(packets);
  const packetBytes = Buffer.byteLength(packetJson, 'utf8');
  const localRatio = originalBytes / Math.max(packetBytes, 1);

  let dhtp = null;
  if (preferDhtp) {
    try {
      const workingSet = patients.slice(0, 64).map((p, i) => ({
        id: p.id,
        title: `${p.chiefComplaint} age=${p.age} esi=${p.esiHint}`,
        tier: p.esiHint <= 2 ? 'mega' : 'regular',
        updatedAt: String(1_700_000_000 + i),
      }));
      const prompt = 'summarize these hospital intake DTUs for triage board';
      const base = ('Hospital ops synthetic context. '.repeat(40));
      const r = applyDHTP({ prompt, workingSetDtus: workingSet, baseSystemPrompt: base });
      dhtp = {
        ok: true,
        presetId: r.presetId,
        compressed: r.compressed,
        originalChars: r.originalChars,
        compressedChars: r.compressedChars,
        ratio: r.ratio,
        matchTimeMs: r.matchTimeMs,
        dtuHash: r.dtuHash,
        path: 'server/lib/dhtp.js applyDHTP',
      };
    } catch (e) {
      dhtp = { ok: false, error: e?.message || String(e), path: 'applyDHTP' };
    }
  }

  const ms = Date.now() - t0;
  return {
    ok: true,
    originalBytes,
    packetBytes,
    localCompressionRatio: localRatio,
    packets,
    packetFingerprint: createHash('sha256').update(packetJson).digest('hex').slice(0, 16),
    dhtp,
    // Prefer measured local ratio for hospital payload; DHTP ratio is HASH-DTU path (different denominator)
    reportedCompressionRatio: localRatio,
    compressionPath: dhtp?.ok ? 'local_packetizer+dhtp_hash_refs' : 'local_packetizer',
    ms,
    honesty: {
      syntheticOnly: true,
      note: 'Compression measured on synthetic intake JSON→feature packets; DHTP HASH refs reported separately — do not conflate with 10×–129× marketing claims',
    },
  };
}

/** Predictive triage score (risk + bed sim) on compressed packets. */
export function predictiveTriage(packetsOrBatch, { beds = 40 } = {}) {
  const t0 = Date.now();
  const packets = Array.isArray(packetsOrBatch)
    ? packetsOrBatch
    : packetsOrBatch?.packets || packetsOrBatch?.patients || [];
  const bedCount = Math.max(1, Number(beds) || 40);

  const scored = packets.map((p) => {
    const hr = Number(p.hr ?? p.vitals?.hr ?? 80);
    const sbp = Number(p.sbp ?? p.vitals?.sbp ?? 120);
    const spo2 = Number(p.spo2 ?? p.vitals?.spo2 ?? 98);
    const age = Number(p.a ?? p.age ?? 40);
    const esi = Number(p.esi ?? p.esiHint ?? 3);
    const wait = Number(p.wait ?? p.arrivalMinAgo ?? 0);
    // PROXY risk 0..1 — not a clinical model
    let risk = 0;
    risk += (6 - esi) * 0.12;
    if (spo2 < 92) risk += 0.25;
    if (sbp < 100) risk += 0.15;
    if (hr > 110 || hr < 50) risk += 0.12;
    if (age >= 75) risk += 0.1;
    if (wait > 120) risk += 0.05;
    risk = Math.max(0, Math.min(1, risk));
    const priority = risk >= 0.75 ? 'immediate' : risk >= 0.45 ? 'urgent' : risk >= 0.25 ? 'semi_urgent' : 'non_urgent';
    return {
      id: p.id,
      risk: Number(risk.toFixed(4)),
      priority,
      esi,
      wait,
    };
  });

  scored.sort((a, b) => b.risk - a.risk);

  // Simple bed sim: assign top risk to available beds; rest queue
  const assigned = scored.slice(0, bedCount).map((s, i) => ({ ...s, bed: `B${i + 1}` }));
  const queue = scored.slice(bedCount);
  const occ = assigned.length / bedCount;
  const ms = Date.now() - t0;

  return {
    ok: true,
    n: scored.length,
    beds: bedCount,
    occupancy: Number(occ.toFixed(4)),
    assignedCount: assigned.length,
    queueCount: queue.length,
    p50Risk: percentile(scored.map((s) => s.risk), 0.5),
    p95Risk: percentile(scored.map((s) => s.risk), 0.95),
    top5: assigned.slice(0, 5),
    ms,
    honesty: {
      syntheticOnly: true,
      clinicalAdvice: false,
      label: 'PROXY triage — not clinical decision support / not FDA cleared',
    },
  };
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const idx = Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1))));
  return a[idx];
}

/** End-to-end hospital ops slice with latency samples for p50/p95. */
export function runHospitalOpsCert({ n = 200, beds = 40, samples = 7 } = {}) {
  const batch = generateSyntheticIntakeBatch({ n });
  const latencies = [];
  let last = null;
  const S = Math.max(3, Math.min(21, Number(samples) || 7));
  for (let i = 0; i < S; i++) {
    const t0 = Date.now();
    const compressed = compressHospitalPackets(batch);
    const triage = predictiveTriage(compressed.packets, { beds });
    const ms = Date.now() - t0;
    latencies.push(ms);
    last = { compressed, triage, e2eMs: ms };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    ok: true,
    n: batch.n,
    compressionRatio: last.compressed.reportedCompressionRatio,
    dhtpRatio: last.compressed.dhtp?.ratio ?? null,
    dhtpOk: !!last.compressed.dhtp?.ok,
    originalBytes: last.compressed.originalBytes,
    packetBytes: last.compressed.packetBytes,
    triage: {
      occupancy: last.triage.occupancy,
      assignedCount: last.triage.assignedCount,
      queueCount: last.triage.queueCount,
      p50Risk: last.triage.p50Risk,
      p95Risk: last.triage.p95Risk,
    },
    latencyMs: {
      samples: latencies,
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      mean: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    },
    honesty: batch.honesty,
    runId: randomUUID(),
  };
}

export default {
  generateSyntheticIntakeBatch,
  compressHospitalPackets,
  predictiveTriage,
  runHospitalOpsCert,
};

/**
 * Credential Genome — Portable Proof of Understanding
 *
 * Not diplomas. Not certificates. A LIVING credential backed
 * by the actual DTU substrate. Anyone can verify by checking
 * the DTUs exist and the student is credited.
 *
 * A credential is not a claim — it is a verifiable slice of the
 * student's knowledge genome. The proof section contains concrete
 * DTU ids that a verifier can independently re-fetch from the DTU
 * substrate. If the DTUs exist and the hash matches, the credential
 * is valid. No central authority is required.
 */

import crypto from "crypto";

/**
 * CredentialGenome — generates and verifies portable credentials
 * derived from a student's DTU activity (mastery, creation, teaching).
 *
 * Dependencies are all optional. Every method degrades gracefully:
 *   - dtuStore: used to look up DTU metadata (lineage, domain, creator)
 *   - knowledgeGenome: async function (studentId) -> genome object
 *   - db: optional persistence layer (falls back to in-memory map)
 */
export class CredentialGenome {
  constructor({ dtuStore, knowledgeGenome, db } = {}) {
    this.dtuStore = dtuStore || null;
    this.knowledgeGenome = typeof knowledgeGenome === "function" ? knowledgeGenome : null;
    this.db = db || null;
    // In-memory fallback keyed by studentId -> [credential...]
    this._store = new Map();
  }

  // ---------------------------------------------------------------------
  // Public: generate a credential for (studentId, domain)
  // ---------------------------------------------------------------------
  async generateCredential(studentId, domain) {
    const safeStudent = String(studentId || "").trim() || "unknown";
    const safeDomain = String(domain || "").trim() || "general";

    let genome = null;
    try {
      if (this.knowledgeGenome) genome = await this.knowledgeGenome(safeStudent);
    } catch (_err) {
      genome = null;
    }
    if (!genome || typeof genome !== "object") genome = {};

    const domainDTUs = this.getDomainDTUs(genome, safeDomain);
    const mastered = domainDTUs.filter(([, m]) => Number(m) > 0.7);

    let created = [];
    try {
      created = await this.getCreatedDTUs(safeStudent, safeDomain);
    } catch (_err) {
      created = [];
    }

    const taught = this.getTeachingLog(genome, safeDomain);

    const metrics = {
      dtusStudied: domainDTUs.length,
      dtusMastered: mastered.length,
      dtusCreated: created.length,
      timesTaught: taught.length,
      averageMastery: this.calculateAvgMastery(domainDTUs),
      deepestLineageTraced: await this.getMaxLineageDepth(mastered).catch(() => 0),
      crossDomainConnections: await this.getCrossDomainCount(genome, safeDomain).catch(() => 0),
      citationsReceived: await this.getCitationCount(created).catch(() => 0),
    };

    const credential = {
      credentialId: `cred_${crypto.randomBytes(10).toString("hex")}`,
      studentId: safeStudent,
      domain: safeDomain,
      issuedAt: Date.now(),
      metrics,
      proof: {
        masteredDTUIds: mastered.map(([id]) => id),
        createdDTUIds: created.map((d) => d.id),
        teachingLog: taught.map((t) => t.dtuId),
        hash: this.hashProof(mastered, created, taught),
      },
      verificationUrl: `/api/learning/verify/${safeStudent}/${safeDomain}`,
    };

    try {
      await this.persistCredential(credential);
    } catch (_err) {
      /* persistence is best-effort */
    }

    return credential;
  }

  // ---------------------------------------------------------------------
  // Public: verify a credential
  // ---------------------------------------------------------------------
  async verify(studentId, domain, credential) {
    const reasons = [];
    if (!credential || typeof credential !== "object") {
      return { valid: false, reasons: ["credential_missing"] };
    }
    if (!credential.proof || typeof credential.proof !== "object") {
      return { valid: false, reasons: ["proof_missing"] };
    }
    if (credential.studentId && credential.studentId !== studentId) {
      reasons.push("student_mismatch");
    }
    if (credential.domain && domain && credential.domain !== domain) {
      reasons.push("domain_mismatch");
    }

    const mastered = (credential.proof.masteredDTUIds || []).map((id) => [id, 1]);
    const created = (credential.proof.createdDTUIds || []).map((id) => ({ id }));
    const taught = (credential.proof.teachingLog || []).map((dtuId) => ({ dtuId }));

    const recomputedHash = this.hashProof(mastered, created, taught);
    if (recomputedHash !== credential.proof.hash) {
      reasons.push("hash_mismatch");
    }

    // Check DTUs still exist in the substrate, if dtuStore is available
    if (this.dtuStore && typeof this.dtuStore.get === "function") {
      const allIds = [
        ...(credential.proof.masteredDTUIds || []),
        ...(credential.proof.createdDTUIds || []),
        ...(credential.proof.teachingLog || []),
      ];
      let missing = 0;
      for (const id of allIds) {
        try {
          const dtu = await this.dtuStore.get(id);
          if (!dtu) missing += 1;
        } catch (_err) {
          missing += 1;
        }
      }
      if (missing > 0) reasons.push(`missing_dtus:${missing}`);

      // Verify student is creator of the createdDTUIds
      let uncredited = 0;
      for (const id of credential.proof.createdDTUIds || []) {
        try {
          const dtu = await this.dtuStore.get(id);
          if (!dtu) continue;
          const creator = dtu.creator || dtu.createdBy || dtu.authorId || null;
          if (creator && creator !== studentId) uncredited += 1;
        } catch (_err) {
          /* ignore */
        }
      }
      if (uncredited > 0) reasons.push(`uncredited_creations:${uncredited}`);
    }

    return { valid: reasons.length === 0, reasons };
  }

  // ---------------------------------------------------------------------
  // Filters & extractors over the knowledge genome
  // ---------------------------------------------------------------------
  getDomainDTUs(genome, domain) {
    if (!genome) return [];
    // Accept multiple possible shapes: Map, plain object, or array
    let entries = [];
    if (genome.mastery instanceof Map) {
      entries = Array.from(genome.mastery.entries());
    } else if (genome.mastery && typeof genome.mastery === "object") {
      entries = Object.entries(genome.mastery);
    } else if (Array.isArray(genome.dtus)) {
      entries = genome.dtus.map((d) => [d.id, d.mastery ?? 0]);
    }

    // Attempt to filter by domain using dtuStore metadata or genome-embedded info
    const domainIndex = genome.domains && typeof genome.domains === "object" ? genome.domains : null;
    return entries.filter(([id]) => {
      if (!domain || domain === "general") return true;
      if (domainIndex) {
        const d = domainIndex[id];
        if (d) return d === domain || (Array.isArray(d) && d.includes(domain));
      }
      // If no index, include all; caller may still compute metrics meaningfully.
      return true;
    });
  }

  async getCreatedDTUs(studentId, domain) {
    if (!this.dtuStore) return [];
    try {
      if (typeof this.dtuStore.listByCreator === "function") {
        const list = await this.dtuStore.listByCreator(studentId);
        return (list || []).filter((d) => !domain || domain === "general" || d.domain === domain);
      }
      if (typeof this.dtuStore.query === "function") {
        const list = await this.dtuStore.query({ creator: studentId, domain });
        return list || [];
      }
    } catch (_err) {
      return [];
    }
    return [];
  }

  getTeachingLog(genome, domain) {
    if (!genome) return [];
    const log = Array.isArray(genome.teachingLog) ? genome.teachingLog : [];
    if (!domain || domain === "general") return log;
    return log.filter((t) => !t.domain || t.domain === domain);
  }

  calculateAvgMastery(domainDTUs) {
    if (!domainDTUs || domainDTUs.length === 0) return 0;
    const sum = domainDTUs.reduce((acc, [, m]) => acc + (Number(m) || 0), 0);
    return Number((sum / domainDTUs.length).toFixed(4));
  }

  async getMaxLineageDepth(mastered) {
    if (!this.dtuStore || !mastered || mastered.length === 0) return 0;
    let deepest = 0;
    for (const [id] of mastered) {
      try {
        const depth = typeof this.dtuStore.lineageDepth === "function"
          ? await this.dtuStore.lineageDepth(id)
          : 0;
        if (Number(depth) > deepest) deepest = Number(depth);
      } catch (_err) {
        /* skip */
      }
    }
    return deepest;
  }

  async getCrossDomainCount(genome, domain) {
    if (!genome) return 0;
    const links = Array.isArray(genome.hybridLinks) ? genome.hybridLinks : [];
    return links.filter((l) => l && (l.from === domain || l.to === domain) && l.from !== l.to).length;
  }

  async getCitationCount(created) {
    if (!this.dtuStore || !created || created.length === 0) return 0;
    let total = 0;
    for (const d of created) {
      try {
        if (typeof this.dtuStore.citationCount === "function") {
          total += Number(await this.dtuStore.citationCount(d.id)) || 0;
        } else if (typeof d.citations === "number") {
          total += d.citations;
        }
      } catch (_err) {
        /* skip */
      }
    }
    return total;
  }

  hashProof(mastered, created, taught) {
    const data = JSON.stringify({
      mastered: (mastered || []).map(([id]) => id).sort(),
      created: (created || []).map((d) => d.id).sort(),
      taught: (taught || []).map((t) => t.dtuId).sort(),
    });
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  // ---------------------------------------------------------------------
  // Persistence (db if available, else in-memory)
  // ---------------------------------------------------------------------
  async persistCredential(credential) {
    if (this.db && typeof this.db.insertCredential === "function") {
      try {
        await this.db.insertCredential(credential);
        return true;
      } catch (_err) {
        /* fall through to memory */
      }
    }
    const key = credential.studentId;
    if (!this._store.has(key)) this._store.set(key, []);
    this._store.get(key).push(credential);
    return true;
  }

  async listCredentials(studentId) {
    if (this.db && typeof this.db.listCredentials === "function") {
      try {
        const list = await this.db.listCredentials(studentId);
        if (Array.isArray(list)) return list;
      } catch (_err) {
        /* fall through to memory */
      }
    }
    return this._store.get(studentId) || [];
  }
}

export function createCredentialGenome(deps) {
  return new CredentialGenome(deps || {});
}

export default CredentialGenome;

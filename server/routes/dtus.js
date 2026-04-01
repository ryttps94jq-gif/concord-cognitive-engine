/**
 * DTU routes — extracted from server.js
 * Registered directly on app (mixed prefixes)
 */
import { asyncHandler } from "../lib/async-handler.js";
import {
  encodeDTU, decodeDTU, verifyDTU, determinePrimaryType,
} from "../economy/dtu-format.js";
import { DTU_FORMAT_CONSTANTS } from "../lib/dtu-format-constants.js";
import { randomUUID } from "crypto";

export default function registerDtuRoutes(app, { STATE, makeCtx, runMacro, dtuForClient, dtusArray, _withAck, _saveStateDebounced, validate }) {

  // CRETI-first DTU view (no raw JSON by default)
  app.get("/api/dtu_view/:id", (req, res) => {
    const id = req.params.id;
    const d = STATE.dtus.get(id);
    if (!d) return res.status(404).json({ ok:false, error:"DTU not found" });
    return res.json({ ok:true, dtu: dtuForClient(d, { raw: req.query.raw === "1" }) });
  });


  // DTUs
  app.get("/api/dtus", asyncHandler(async (req, res) => {
    try {
      const ctx = makeCtx(req);
      const out = await runMacro("dtu","list",{ q:req.query.q, tier:req.query.tier || "any", limit:req.query.limit, offset:req.query.offset, scope: req.query.scope || null }, ctx);
      res.json(out);
    } catch (e) {
      const msg = String(e?.message || e);
      res.status(msg.startsWith("forbidden") ? 403 : 500).json({ ok: false, error: msg });
    }
  }));
  app.get("/api/dtus/:id", asyncHandler(async (req, res) => {
    try {
      const ctx = makeCtx(req);
      const out = await runMacro("dtu","get",{ id:req.params.id }, ctx);
      if (!out.ok) return res.status(404).json(out);
      res.json(out);
    } catch (e) {
      const msg = String(e?.message || e);
      res.status(msg.startsWith("forbidden") ? 403 : 500).json({ ok: false, error: msg });
    }
  }));
  app.post("/api/dtus", validate("dtuCreate"), asyncHandler(async (req, res) => {
    try {
      const ctx = makeCtx(req);
      const out = await runMacro("dtu","create", req.body || {}, ctx);
      res.json(out);
    } catch (e) {
      const msg = String(e?.message || e);
      res.status(msg.startsWith("forbidden") ? 403 : 500).json({ ok: false, error: msg });
    }
  }));
  app.post("/api/dtus/saveSuggested", asyncHandler(async (req, res) => {
    try {
      const ctx = makeCtx(req);
      const out = await runMacro("dtu","saveSuggested", req.body || {}, ctx);
      res.json(out);
    } catch (e) {
      const msg = String(e?.message || e);
      res.status(msg.startsWith("forbidden") ? 403 : 500).json({ ok: false, error: msg });
    }
  }));

  // DTU maintenance
  app.post("/api/dtus/dedupe", asyncHandler(async (req,res)=> {
    const out = await runMacro("dtu","dedupeSweep", req.body||{}, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus","state","logs"], ["/api/dtus","/api/state/latest","/api/logs"], null, { panel: "dtus_dedupe" }));
  }));
  app.get("/api/megas", (req,res)=> {
    const tier = "mega";
    const out = dtusArray().filter(d => d.tier===tier).sort((a,b)=> (b.updatedAt||b.createdAt||"").localeCompare(a.updatedAt||a.createdAt||""));
    res.json({ ok:true, megas: out });
  });
  app.get("/api/hypers", (req,res)=> {
    const out = dtusArray().filter(d => d.tier==="hyper").sort((a,b)=> (b.updatedAt||b.createdAt||"").localeCompare(a.updatedAt||a.createdAt||""));
    res.json({ ok:true, hypers: out });
  });

  // Extended DTU endpoints
  app.put("/api/dtus/:id", validate("dtuUpdate"), asyncHandler(async (req, res) => {
    const out = await runMacro("dtu", "update", { id: req.params.id, ...req.body }, makeCtx(req));
    return res.json(out);
  }));

  // PATCH is an alias for PUT — frontend client.ts sends PATCH for partial updates
  app.patch("/api/dtus/:id", asyncHandler(async (req, res) => {
    const out = await runMacro("dtu", "update", { id: req.params.id, ...req.body }, makeCtx(req));
    return res.json(out);
  }));

  app.delete("/api/dtus/:id", asyncHandler(async (req, res) => {
    // Note: You may need to create a dtu.delete macro first
    const out = await runMacro("dtu", "delete", { id: req.params.id }, makeCtx(req));
    return res.json(out);
  }));

  app.post("/api/dtus/cluster", asyncHandler(async (req, res) => {
    const out = await runMacro("dtu", "cluster", req.body, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus"], ["/api/dtus"], null, { panel: "cluster" }));
  }));

  app.post("/api/dtus/reconcile", asyncHandler(async (req, res) => {
    const out = await runMacro("dtu", "reconcile", req.body, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus", "state"], ["/api/dtus", "/api/state/latest"], null, { panel: "reconcile" }));
  }));

  app.post("/api/dtus/define", asyncHandler(async (req, res) => {
    const out = await runMacro("dtu", "define", req.body, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus"], ["/api/dtus"], null, { panel: "define" }));
  }));

  app.get("/api/dtus/shadow", asyncHandler(async (req, res) => {
    const out = await runMacro("dtu", "listShadow", { limit: req.query.limit, q: req.query.q }, makeCtx(req));
    return res.json(out);
  }));

  app.post("/api/dtus/gap-promote", asyncHandler(async (req, res) => {
    const out = await runMacro("dtu", "gapPromote", req.body, makeCtx(req));
    return res.json(_withAck(out, req, ["dtus", "state"], ["/api/dtus", "/api/state/latest"], null, { panel: "gap_promote" }));
  }));

  // Sync a global DTU into the user's local inventory
  app.post("/api/dtus/sync-from-global", asyncHandler(async (req, res) => {
    try {
      const ctx = makeCtx(req);
      const out = await runMacro("dtu", "syncFromGlobal", req.body || {}, ctx);
      if (!out.ok) return res.status(out.error === "Authentication required to sync DTUs" ? 401 : 400).json(out);
      res.json(out);
    } catch (e) {
      const msg = String(e?.message || e);
      res.status(500).json({ ok: false, error: msg });
    }
  }));

  // GET /api/dtus/:id/lineage — return parent/child lineage chains for a DTU
  app.get("/api/dtus/:id/lineage", (req, res) => {
    const id = req.params.id;
    const dtu = STATE.dtus.get(id);
    if (!dtu) return res.status(404).json({ ok: false, error: "DTU not found" });

    const parentIds = dtu.lineage?.parents || dtu.parents || [];
    const childIds = dtu.lineage?.children || dtu.children || [];

    const resolve = (ids) => (Array.isArray(ids) ? ids : []).map(pid => {
      const p = STATE.dtus.get(pid);
      return p
        ? { id: pid, title: p.title || p.human?.summary || pid, summary: p.human?.summary, tier: p.tier }
        : { id: pid, title: pid };
    });

    return res.json({
      ok: true,
      dtuId: id,
      parents: resolve(parentIds),
      children: resolve(childIds),
    });
  });

  app.get("/api/definitions", (req, res) => {
    const dtus = dtusArray().filter(d =>
      (d.tags || []).includes("definition") ||
      /^def(inition)?:/i.test(d.title || "")
    );
    return res.json({ ok: true, definitions: dtus });
  });

  app.get("/api/definitions/:term", (req, res) => {
    const term = String(req.params.term || "").toLowerCase();
    const dtu = dtusArray().find(d =>
      ((d.tags || []).includes("definition") || /^def(inition)?:/i.test(d.title || "")) &&
      (d.meta?.term || "").toLowerCase() === term
    );
    if (!dtu) return res.status(404).json({ ok: false, error: "Definition not found" });
    return res.json({ ok: true, definition: dtu });
  });

  // ── .dtu File Format Export ─────────────────────────────────────────
  // GET /api/dtus/:id/export.dtu — Package DTU into binary .dtu format
  app.get("/api/dtus/:id/export.dtu", asyncHandler(async (req, res) => {
    const id = req.params.id;
    const dtu = STATE.dtus.get(id);
    if (!dtu) return res.status(404).json({ ok: false, error: "DTU not found" });

    // Determine format type from tier
    const C = DTU_FORMAT_CONSTANTS;
    const formatType = dtu.tier === "hyper" ? C.TYPE_HYPER
      : dtu.tier === "mega" ? C.TYPE_MEGA
      : C.TYPE_DTU;

    // Build layers from DTU data
    const humanLayer = {
      title: dtu.title || dtu.human?.title || "",
      summary: dtu.summary || dtu.human?.summary || "",
      content: dtu.content || dtu.human?.content || "",
      tags: dtu.tags || [],
    };

    const coreLayer = dtu.core || {
      id: dtu.id,
      tier: dtu.tier,
      domain: dtu.domain,
      source: dtu.source,
      resonance: dtu.resonance,
      coherence: dtu.coherence,
      stability: dtu.stability,
      parents: dtu.parents || [],
      children: dtu.children || [],
    };

    const machineLayer = dtu.machine || {
      embedding: dtu.embedding ? "[redacted]" : null,
      integrityStatus: dtu.meta?.integrityStatus,
      contentHash: dtu.meta?.contentHash,
    };

    // Resolve artifact data if present
    let artifactData = null;
    let artifactMimeType = null;
    if (dtu.artifactRef || dtu.meta?.artifactId) {
      const mediaId = dtu.artifactRef || dtu.meta?.artifactId;
      const mediaDtu = STATE.dtus.get(mediaId) || (STATE._media && STATE._media.items?.get(mediaId));
      if (mediaDtu) {
        artifactMimeType = mediaDtu.mimeType || mediaDtu.meta?.mimeType || "";
      }
    }

    const result = encodeDTU({
      id: dtu.id,
      creatorId: dtu.ownerId || dtu.creatorId,
      createdAt: dtu.timestamp || dtu.createdAt,
      lineage: { parents: dtu.parents || [], children: dtu.children || [] },
      humanLayer,
      coreLayer,
      machineLayer,
      artifactData,
      artifactMimeType,
      artifactType: dtu.meta?.artifactType || null,
      contentType: dtu.primaryType || dtu.meta?.primaryType || null,
      formatType,
    });

    if (!result.ok) {
      return res.status(500).json({ ok: false, error: "encode_failed", detail: result.error });
    }

    // Determine file extension based on tier
    const ext = dtu.tier === "hyper" ? ".hyper.dtu"
      : dtu.tier === "mega" ? ".mega.dtu"
      : ".dtu";
    const filename = `${(dtu.title || dtu.id).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60)}${ext}`;

    res.set({
      "Content-Type": "application/vnd.concord.dtu",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": result.buffer.length,
      "X-DTU-Content-Hash": result.contentHash,
      "X-DTU-Signature": result.signature,
    });
    res.send(result.buffer);
  }));

  // ── .dtu File Format Import ─────────────────────────────────────────
  // POST /api/dtus/import — Accept .dtu file upload, parse, create DTU
  app.post("/api/dtus/import", asyncHandler(async (req, res) => {
    // Accept raw binary body or base64 JSON
    let buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (req.body?.dtuBase64) {
      buffer = Buffer.from(req.body.dtuBase64, "base64");
    } else if (req.headers["content-type"]?.includes("octet-stream")) {
      // Collect raw body
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      buffer = Buffer.concat(chunks);
    } else {
      return res.status(400).json({ ok: false, error: "missing_dtu_data", hint: "Send binary body or { dtuBase64: '...' }" });
    }

    // Verify the file
    const verification = verifyDTU(buffer);
    if (!verification.ok || verification.tampered) {
      return res.status(400).json({ ok: false, error: "verification_failed", detail: verification });
    }

    // Decode the file
    const decoded = decodeDTU(buffer);
    if (!decoded.ok) {
      return res.status(400).json({ ok: false, error: "decode_failed", detail: decoded.error });
    }

    const { metadata, humanLayer, coreLayer, machineLayer, header } = decoded;

    // Create DTU via the macro system, preserving lineage
    const ctx = makeCtx(req);
    const createPayload = {
      title: humanLayer?.title || humanLayer?.summary || "Imported DTU",
      content: humanLayer?.content || humanLayer?.summary || "",
      summary: humanLayer?.summary || "",
      tags: [...(humanLayer?.tags || []), "reimport"],
      source: "dtu-import",
      parents: metadata?.lineage?.parents || [],
      meta: {
        reimport: true,
        originalId: metadata?.id,
        originalCreator: metadata?.creatorId,
        originalCreatedAt: metadata?.createdAt,
        importedAt: new Date().toISOString(),
        contentHash: verification.contentHash,
        primaryType: header.primaryTypeName,
        formatType: header.formatTypeName,
      },
    };

    try {
      const out = await runMacro("dtu", "create", createPayload, ctx);
      return res.status(201).json({
        ok: true,
        dtuId: out.dtu?.id || out.id,
        metadata: {
          title: humanLayer?.title,
          originalId: metadata?.id,
          primaryType: header.primaryTypeName,
          formatType: header.formatTypeName,
          verified: !verification.tampered,
        },
        header: {
          version: header.version,
          formatType: header.formatTypeName,
          primaryType: header.primaryTypeName,
          artifactPresent: header.artifactPresent,
          layers: header.layers,
        },
      });
    } catch (e) {
      const msg = String(e?.message || e);
      return res.status(500).json({ ok: false, error: "import_create_failed", detail: msg });
    }
  }));
}

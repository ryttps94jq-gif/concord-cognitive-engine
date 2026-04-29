// server/domains/whiteboard.js
import { callVision, callVisionUrl, visionPromptForDomain } from "../lib/vision-inference.js";

export default function registerWhiteboardActions(registerLensAction) {
  registerLensAction("whiteboard", "vision", async (ctx, artifact, _params) => {
    const { imageB64, imageUrl } = artifact.data || {};
    if (!imageB64 && !imageUrl) return { ok: false, error: "imageB64 or imageUrl required" };
    const prompt = visionPromptForDomain("whiteboard");
    return imageUrl ? callVisionUrl(imageUrl, prompt) : callVision(imageB64, prompt);
  });
  registerLensAction("whiteboard", "shapeDetect", (ctx, artifact, _params) => {
    const elements = artifact.data?.elements || [];
    if (elements.length === 0) return { ok: true, result: { message: "Add whiteboard elements to analyze shapes." } };
    const classified = elements.map((el, i) => {
      const x = parseFloat(el.x) || 0, y = parseFloat(el.y) || 0;
      const w = parseFloat(el.width) || parseFloat(el.w) || 0;
      const h = parseFloat(el.height) || parseFloat(el.h) || 0;
      const type = el.type || (w === h && w > 0 ? "square" : w > 0 && h > 0 ? "rectangle" : el.radius ? "circle" : el.points ? "polygon" : "unknown");
      const area = type === "circle" ? Math.round(Math.PI * Math.pow(parseFloat(el.radius) || w / 2, 2)) : Math.round(w * h);
      return { id: el.id || `el-${i}`, type, x, y, width: w, height: h, area, boundingBox: { minX: x, minY: y, maxX: x + w, maxY: y + h } };
    });
    const byType = {};
    classified.forEach(c => { byType[c.type] = (byType[c.type] || 0) + 1; });
    const totalArea = classified.reduce((s, c) => s + c.area, 0);
    return { ok: true, result: { totalElements: elements.length, shapeDistribution: byType, elements: classified, totalArea, avgArea: Math.round(totalArea / elements.length), canvasBounds: { minX: Math.min(...classified.map(c => c.boundingBox.minX)), minY: Math.min(...classified.map(c => c.boundingBox.minY)), maxX: Math.max(...classified.map(c => c.boundingBox.maxX)), maxY: Math.max(...classified.map(c => c.boundingBox.maxY)) } } };
  });

  registerLensAction("whiteboard", "layoutOptimize", (ctx, artifact, _params) => {
    const elements = artifact.data?.elements || [];
    const gridSize = parseInt(artifact.data?.gridSize) || 20;
    if (elements.length === 0) return { ok: true, result: { message: "Add elements to optimize layout." } };
    const overlaps = [];
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const a = elements[i], b = elements[j];
        const ax = parseFloat(a.x) || 0, ay = parseFloat(a.y) || 0, aw = parseFloat(a.width || a.w) || 50, ah = parseFloat(a.height || a.h) || 50;
        const bx = parseFloat(b.x) || 0, by = parseFloat(b.y) || 0, bw = parseFloat(b.width || b.w) || 50, bh = parseFloat(b.height || b.h) || 50;
        if (ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by) {
          overlaps.push({ element1: a.id || `el-${i}`, element2: b.id || `el-${j}` });
        }
      }
    }
    const snapped = elements.map((el, i) => {
      const x = parseFloat(el.x) || 0;
      const y = parseFloat(el.y) || 0;
      return { id: el.id || `el-${i}`, originalX: x, originalY: y, snappedX: Math.round(x / gridSize) * gridSize, snappedY: Math.round(y / gridSize) * gridSize, moved: Math.round(x / gridSize) * gridSize !== x || Math.round(y / gridSize) * gridSize !== y };
    });
    const movedCount = snapped.filter(s => s.moved).length;
    return { ok: true, result: { totalElements: elements.length, overlaps: overlaps.length, overlapPairs: overlaps.slice(0, 20), gridSize, elementsSnapped: movedCount, suggestions: snapped.filter(s => s.moved), alignmentScore: Math.round(((elements.length - movedCount) / elements.length) * 100) } };
  });

  registerLensAction("whiteboard", "clusterGroup", (ctx, artifact, _params) => {
    const elements = artifact.data?.elements || [];
    const threshold = parseFloat(artifact.data?.threshold) || 100;
    if (elements.length === 0) return { ok: true, result: { message: "Add elements to detect clusters." } };
    const positions = elements.map((el, i) => ({
      id: el.id || `el-${i}`, x: parseFloat(el.x) || 0, y: parseFloat(el.y) || 0, cluster: -1,
    }));
    // Simple proximity-based clustering
    let clusterId = 0;
    positions.forEach(p => {
      if (p.cluster >= 0) return;
      p.cluster = clusterId;
      const queue = [p];
      while (queue.length > 0) {
        const current = queue.shift();
        positions.forEach(other => {
          if (other.cluster >= 0) return;
          const dist = Math.sqrt(Math.pow(current.x - other.x, 2) + Math.pow(current.y - other.y, 2));
          if (dist <= threshold) { other.cluster = clusterId; queue.push(other); }
        });
      }
      clusterId++;
    });
    const clusters = {};
    positions.forEach(p => {
      if (!clusters[p.cluster]) clusters[p.cluster] = { elements: [], centerX: 0, centerY: 0 };
      clusters[p.cluster].elements.push(p.id);
    });
    Object.values(clusters).forEach(c => {
      const els = positions.filter(p => c.elements.includes(p.id));
      c.centerX = Math.round(els.reduce((s, e) => s + e.x, 0) / els.length);
      c.centerY = Math.round(els.reduce((s, e) => s + e.y, 0) / els.length);
    });
    const clusterList = Object.entries(clusters).map(([id, data]) => ({
      clusterId: parseInt(id), elementCount: data.elements.length, center: { x: data.centerX, y: data.centerY }, elements: data.elements,
    })).sort((a, b) => b.elementCount - a.elementCount);
    return { ok: true, result: { totalElements: elements.length, clusterCount: clusterList.length, threshold, clusters: clusterList, singletons: clusterList.filter(c => c.elementCount === 1).length } };
  });

  registerLensAction("whiteboard", "exportPrep", (ctx, artifact, _params) => {
    const elements = artifact.data?.elements || [];
    const layers = artifact.data?.layers || [{ name: "default", elements: elements.map((_, i) => `el-${i}`) }];
    if (elements.length === 0) return { ok: true, result: { message: "Add elements to prepare for export." } };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const manifest = elements.map((el, i) => {
      const x = parseFloat(el.x) || 0, y = parseFloat(el.y) || 0;
      const w = parseFloat(el.width || el.w) || 50, h = parseFloat(el.height || el.h) || 50;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
      return { id: el.id || `el-${i}`, type: el.type || "shape", layer: el.layer || "default", position: { x, y }, size: { w, h } };
    });
    const canvasWidth = maxX - minX;
    const canvasHeight = maxY - minY;
    const byLayer = {};
    manifest.forEach(m => { byLayer[m.layer] = (byLayer[m.layer] || 0) + 1; });
    return { ok: true, result: { totalElements: elements.length, canvas: { x: minX, y: minY, width: Math.round(canvasWidth), height: Math.round(canvasHeight), aspectRatio: canvasHeight > 0 ? `${Math.round(canvasWidth / canvasHeight * 100) / 100}:1` : "N/A" }, layers: Object.entries(byLayer).map(([name, count]) => ({ name, elementCount: count })), exportFormats: ["PNG", "SVG", "PDF", "JSON"], manifest: manifest.slice(0, 50), recommendations: [canvasWidth > 4000 || canvasHeight > 4000 ? "Large canvas — consider splitting for high-res export" : null, elements.length > 200 ? "Many elements — SVG export recommended over raster" : null].filter(Boolean) } };
  });
}

// server/domains/ar.js
// Domain actions for augmented reality: spatial mapping, marker detection, scene graph analysis.

export default function registerArActions(registerLensAction) {
  /**
   * spatialMapping
   * Process spatial anchor data — compute bounding volumes, occlusion zones,
   * surface classification, spatial hash grid for proximity queries.
   * artifact.data.anchors: [{ id, position: {x,y,z}, rotation?: {x,y,z,w}, extent?: {width,height,depth}, surfaceType?, vertices?: [{x,y,z}] }]
   * params.gridCellSize — spatial hash grid cell size (default 1.0)
   * params.proximityRadius — radius for proximity queries (default 2.0)
   */
  registerLensAction("ar", "spatialMapping", (ctx, artifact, params) => {
    const anchors = artifact.data.anchors || [];
    if (anchors.length === 0) {
      return { ok: true, result: { message: "No spatial anchors provided." } };
    }

    const gridCellSize = params.gridCellSize || 1.0;
    const proximityRadius = params.proximityRadius || 2.0;

    // Compute AABB (axis-aligned bounding box) for each anchor
    const processed = anchors.map(anchor => {
      const pos = anchor.position || { x: 0, y: 0, z: 0 };
      const extent = anchor.extent || { width: 0.1, height: 0.1, depth: 0.1 };
      const halfW = extent.width / 2;
      const halfH = extent.height / 2;
      const halfD = extent.depth / 2;

      const aabb = {
        min: { x: pos.x - halfW, y: pos.y - halfH, z: pos.z - halfD },
        max: { x: pos.x + halfW, y: pos.y + halfH, z: pos.z + halfD },
      };

      // Volume
      const volume = Math.round(extent.width * extent.height * extent.depth * 10000) / 10000;

      // Surface area
      const surfaceArea = Math.round(2 * (
        extent.width * extent.height +
        extent.height * extent.depth +
        extent.width * extent.depth
      ) * 10000) / 10000;

      // Classify surface based on extent ratios
      let classification = anchor.surfaceType || "unknown";
      if (classification === "unknown") {
        const maxDim = Math.max(extent.width, extent.height, extent.depth);
        const minDim = Math.min(extent.width, extent.height, extent.depth);
        const ratio = maxDim > 0 ? minDim / maxDim : 1;

        if (extent.height < extent.width * 0.2 && extent.height < extent.depth * 0.2) {
          classification = "horizontal-plane";
        } else if (extent.width < extent.height * 0.2 || extent.depth < extent.height * 0.2) {
          classification = "vertical-plane";
        } else if (ratio > 0.6) {
          classification = "volumetric";
        } else {
          classification = "slab";
        }
      }

      return {
        id: anchor.id,
        position: pos,
        extent,
        aabb,
        volume,
        surfaceArea,
        classification,
      };
    });

    // Build spatial hash grid
    const grid = {};
    for (const anchor of processed) {
      const cellX = Math.floor(anchor.position.x / gridCellSize);
      const cellY = Math.floor(anchor.position.y / gridCellSize);
      const cellZ = Math.floor(anchor.position.z / gridCellSize);
      const cellKey = `${cellX}:${cellY}:${cellZ}`;
      if (!grid[cellKey]) grid[cellKey] = [];
      grid[cellKey].push(anchor.id);
    }

    // Compute distance between all pairs and find proximity clusters
    function dist3d(a, b) {
      return Math.sqrt(
        Math.pow(a.x - b.x, 2) +
        Math.pow(a.y - b.y, 2) +
        Math.pow(a.z - b.z, 2)
      );
    }

    const proximityPairs = [];
    for (let i = 0; i < processed.length; i++) {
      for (let j = i + 1; j < processed.length; j++) {
        const d = dist3d(processed[i].position, processed[j].position);
        if (d <= proximityRadius) {
          proximityPairs.push({
            anchorA: processed[i].id,
            anchorB: processed[j].id,
            distance: Math.round(d * 10000) / 10000,
          });
        }
      }
    }

    // Detect occlusion zones: overlapping AABBs
    function aabbOverlap(a, b) {
      return a.min.x <= b.max.x && a.max.x >= b.min.x &&
             a.min.y <= b.max.y && a.max.y >= b.min.y &&
             a.min.z <= b.max.z && a.max.z >= b.min.z;
    }

    const occlusionZones = [];
    for (let i = 0; i < processed.length; i++) {
      for (let j = i + 1; j < processed.length; j++) {
        if (aabbOverlap(processed[i].aabb, processed[j].aabb)) {
          // Compute overlap volume
          const overlapMin = {
            x: Math.max(processed[i].aabb.min.x, processed[j].aabb.min.x),
            y: Math.max(processed[i].aabb.min.y, processed[j].aabb.min.y),
            z: Math.max(processed[i].aabb.min.z, processed[j].aabb.min.z),
          };
          const overlapMax = {
            x: Math.min(processed[i].aabb.max.x, processed[j].aabb.max.x),
            y: Math.min(processed[i].aabb.max.y, processed[j].aabb.max.y),
            z: Math.min(processed[i].aabb.max.z, processed[j].aabb.max.z),
          };
          const overlapVolume = Math.round(
            Math.max(0, overlapMax.x - overlapMin.x) *
            Math.max(0, overlapMax.y - overlapMin.y) *
            Math.max(0, overlapMax.z - overlapMin.z) * 10000
          ) / 10000;

          occlusionZones.push({
            anchorA: processed[i].id,
            anchorB: processed[j].id,
            overlapVolume,
            overlapRegion: { min: overlapMin, max: overlapMax },
          });
        }
      }
    }

    // Surface classification summary
    const surfaceSummary = {};
    for (const a of processed) {
      surfaceSummary[a.classification] = (surfaceSummary[a.classification] || 0) + 1;
    }

    // Scene bounding box
    const sceneBounds = {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity },
    };
    for (const a of processed) {
      sceneBounds.min.x = Math.min(sceneBounds.min.x, a.aabb.min.x);
      sceneBounds.min.y = Math.min(sceneBounds.min.y, a.aabb.min.y);
      sceneBounds.min.z = Math.min(sceneBounds.min.z, a.aabb.min.z);
      sceneBounds.max.x = Math.max(sceneBounds.max.x, a.aabb.max.x);
      sceneBounds.max.y = Math.max(sceneBounds.max.y, a.aabb.max.y);
      sceneBounds.max.z = Math.max(sceneBounds.max.z, a.aabb.max.z);
    }

    const result = {
      analyzedAt: new Date().toISOString(),
      anchorCount: anchors.length,
      anchors: processed,
      spatialGrid: {
        cellSize: gridCellSize,
        occupiedCells: Object.keys(grid).length,
        grid,
      },
      proximityPairs,
      occlusionZones,
      surfaceClassification: surfaceSummary,
      sceneBounds,
      sceneVolume: Math.round(
        (sceneBounds.max.x - sceneBounds.min.x) *
        (sceneBounds.max.y - sceneBounds.min.y) *
        (sceneBounds.max.z - sceneBounds.min.z) * 10000
      ) / 10000,
    };

    artifact.data.spatialMapping = result;
    return { ok: true, result };
  });

  /**
   * markerDetection
   * Analyze marker patterns — compute Hamming distances between marker codes,
   * validate marker integrity, estimate pose from corner positions.
   * artifact.data.markers: [{ id, code: number|string (binary), corners?: [{x,y}], size? }]
   * params.codeLength — expected code bit length (default 16)
   * params.minHammingDistance — minimum Hamming distance for valid set (default 4)
   */
  registerLensAction("ar", "markerDetection", (ctx, artifact, params) => {
    const markers = artifact.data.markers || [];
    if (markers.length === 0) {
      return { ok: true, result: { message: "No markers provided for analysis." } };
    }

    const codeLength = params.codeLength || 16;
    const minHammingDist = params.minHammingDistance || 4;

    // Convert codes to binary strings
    const markerData = markers.map(m => {
      let binary;
      if (typeof m.code === "number") {
        binary = m.code.toString(2).padStart(codeLength, "0");
      } else {
        binary = String(m.code).padStart(codeLength, "0");
      }
      return { ...m, binary: binary.slice(0, codeLength) };
    });

    // Hamming distance computation
    function hamming(a, b) {
      let dist = 0;
      const len = Math.min(a.length, b.length);
      for (let i = 0; i < len; i++) {
        if (a[i] !== b[i]) dist++;
      }
      return dist;
    }

    // Compute all pairwise Hamming distances
    const hammingDistances = [];
    let minDist = Infinity;
    let maxDist = 0;

    for (let i = 0; i < markerData.length; i++) {
      for (let j = i + 1; j < markerData.length; j++) {
        const dist = hamming(markerData[i].binary, markerData[j].binary);
        minDist = Math.min(minDist, dist);
        maxDist = Math.max(maxDist, dist);
        hammingDistances.push({
          markerA: markerData[i].id,
          markerB: markerData[j].id,
          distance: dist,
          isDistinguishable: dist >= minHammingDist,
        });
      }
    }

    // Validate code integrity: check for balanced bit distribution, rotation uniqueness
    const validationResults = markerData.map(m => {
      const ones = m.binary.split("").filter(b => b === "1").length;
      const zeros = codeLength - ones;
      const bitBalance = Math.round((Math.min(ones, zeros) / Math.max(ones, zeros, 1)) * 1000) / 1000;

      // Check rotational uniqueness (90-degree rotations for square markers)
      // Treat code as sqrt(codeLength) x sqrt(codeLength) grid
      const gridSize = Math.round(Math.sqrt(codeLength));
      const rotations = new Set();
      if (gridSize * gridSize === codeLength) {
        let current = m.binary;
        for (let r = 0; r < 4; r++) {
          rotations.add(current);
          // Rotate 90 degrees clockwise
          let rotated = "";
          for (let col = 0; col < gridSize; col++) {
            for (let row = gridSize - 1; row >= 0; row--) {
              rotated += current[row * gridSize + col];
            }
          }
          current = rotated;
        }
      }

      return {
        id: m.id,
        code: m.binary,
        onesCount: ones,
        zerosCount: zeros,
        bitBalance,
        isBalanced: bitBalance >= 0.3,
        rotationallyUnique: rotations.size === 4,
        rotationCount: rotations.size,
      };
    });

    // Pose estimation from corners (if provided)
    const poseEstimates = markerData
      .filter(m => m.corners && m.corners.length === 4)
      .map(m => {
        const corners = m.corners;
        const markerSize = m.size || 1.0;

        // Compute perimeter
        let perimeter = 0;
        for (let i = 0; i < 4; i++) {
          const next = (i + 1) % 4;
          const dx = corners[next].x - corners[i].x;
          const dy = corners[next].y - corners[i].y;
          perimeter += Math.sqrt(dx * dx + dy * dy);
        }

        // Compute area using Shoelace formula
        let area = 0;
        for (let i = 0; i < 4; i++) {
          const next = (i + 1) % 4;
          area += corners[i].x * corners[next].y;
          area -= corners[next].x * corners[i].y;
        }
        area = Math.abs(area) / 2;

        // Estimate distance from apparent size (pinhole camera model approximation)
        const apparentSize = Math.sqrt(area);
        const estimatedDistance = apparentSize > 0 ? Math.round((markerSize / apparentSize) * 100 * 1000) / 1000 : null;

        // Center point
        const center = {
          x: Math.round((corners.reduce((s, c) => s + c.x, 0) / 4) * 1000) / 1000,
          y: Math.round((corners.reduce((s, c) => s + c.y, 0) / 4) * 1000) / 1000,
        };

        // Estimate rotation from corner arrangement
        const dx = corners[1].x - corners[0].x;
        const dy = corners[1].y - corners[0].y;
        const angle = Math.round((Math.atan2(dy, dx) * 180 / Math.PI) * 100) / 100;

        // Compute aspect ratio of projected quad (perspective distortion indicator)
        const side1 = Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2));
        const side2 = Math.sqrt(Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2));
        const aspectRatio = side2 > 0 ? Math.round((side1 / side2) * 1000) / 1000 : 0;
        const perspectiveDistortion = Math.round(Math.abs(1 - aspectRatio) * 1000) / 1000;

        return {
          id: m.id,
          center,
          area: Math.round(area * 1000) / 1000,
          perimeter: Math.round(perimeter * 1000) / 1000,
          estimatedDistance,
          rotationDeg: angle,
          aspectRatio,
          perspectiveDistortion,
        };
      });

    const confusablePairs = hammingDistances.filter(h => !h.isDistinguishable);
    const setValid = confusablePairs.length === 0;

    const result = {
      analyzedAt: new Date().toISOString(),
      markerCount: markers.length,
      codeLength,
      minHammingDistance: minDist === Infinity ? 0 : minDist,
      maxHammingDistance: maxDist,
      requiredMinDistance: minHammingDist,
      setIsValid: setValid,
      confusablePairs,
      hammingDistances,
      validation: validationResults,
      poseEstimates,
    };

    artifact.data.markerDetection = result;
    return { ok: true, result };
  });

  /**
   * sceneGraph
   * Build and analyze a 3D scene graph — compute transform hierarchies,
   * detect overlapping objects, measure scene complexity.
   * artifact.data.nodes: [{ id, parentId?, position: {x,y,z}, rotation?: {x,y,z}, scale?: {x,y,z}, type?, meshVertexCount? }]
   */
  registerLensAction("ar", "sceneGraph", (ctx, artifact, params) => {
    const nodes = artifact.data.nodes || [];
    if (nodes.length === 0) {
      return { ok: true, result: { message: "No scene graph nodes provided." } };
    }

    // Build parent-child map
    const nodeMap = {};
    const children = {};
    const roots = [];

    for (const node of nodes) {
      nodeMap[node.id] = node;
      children[node.id] = [];
    }
    for (const node of nodes) {
      if (node.parentId && nodeMap[node.parentId]) {
        children[node.parentId].push(node.id);
      } else {
        roots.push(node.id);
      }
    }

    // Compute world transforms by traversing the hierarchy
    const worldTransforms = {};

    function computeWorldTransform(nodeId, parentWorldPos, parentWorldScale) {
      const node = nodeMap[nodeId];
      const localPos = node.position || { x: 0, y: 0, z: 0 };
      const localScale = node.scale || { x: 1, y: 1, z: 1 };

      // Simplified transform: position accumulates, scale multiplies
      const worldPos = {
        x: parentWorldPos.x + localPos.x * parentWorldScale.x,
        y: parentWorldPos.y + localPos.y * parentWorldScale.y,
        z: parentWorldPos.z + localPos.z * parentWorldScale.z,
      };
      const worldScale = {
        x: parentWorldScale.x * localScale.x,
        y: parentWorldScale.y * localScale.y,
        z: parentWorldScale.z * localScale.z,
      };

      worldTransforms[nodeId] = {
        position: {
          x: Math.round(worldPos.x * 10000) / 10000,
          y: Math.round(worldPos.y * 10000) / 10000,
          z: Math.round(worldPos.z * 10000) / 10000,
        },
        scale: {
          x: Math.round(worldScale.x * 10000) / 10000,
          y: Math.round(worldScale.y * 10000) / 10000,
          z: Math.round(worldScale.z * 10000) / 10000,
        },
        rotation: node.rotation || { x: 0, y: 0, z: 0 },
      };

      for (const childId of children[nodeId]) {
        computeWorldTransform(childId, worldPos, worldScale);
      }
    }

    const originPos = { x: 0, y: 0, z: 0 };
    const unitScale = { x: 1, y: 1, z: 1 };
    for (const rootId of roots) {
      computeWorldTransform(rootId, originPos, unitScale);
    }

    // Compute tree depth for each node
    const depths = {};
    function computeDepth(nodeId, depth) {
      depths[nodeId] = depth;
      for (const childId of children[nodeId]) {
        computeDepth(childId, depth + 1);
      }
    }
    for (const rootId of roots) {
      computeDepth(rootId, 0);
    }

    const maxDepth = Math.max(...Object.values(depths), 0);

    // Detect overlapping objects using world-space proximity
    function dist3d(a, b) {
      return Math.sqrt(
        Math.pow(a.x - b.x, 2) +
        Math.pow(a.y - b.y, 2) +
        Math.pow(a.z - b.z, 2)
      );
    }

    const overlaps = [];
    const nodeIds = Object.keys(worldTransforms);
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = worldTransforms[nodeIds[i]];
        const b = worldTransforms[nodeIds[j]];
        const d = dist3d(a.position, b.position);
        // Consider objects overlapping if within combined scale radius
        const radiusA = (Math.abs(a.scale.x) + Math.abs(a.scale.y) + Math.abs(a.scale.z)) / 6;
        const radiusB = (Math.abs(b.scale.x) + Math.abs(b.scale.y) + Math.abs(b.scale.z)) / 6;
        if (d < radiusA + radiusB && d < 0.5) {
          overlaps.push({
            nodeA: nodeIds[i],
            nodeB: nodeIds[j],
            distance: Math.round(d * 10000) / 10000,
            combinedRadius: Math.round((radiusA + radiusB) * 10000) / 10000,
          });
        }
      }
    }

    // Scene complexity metrics
    const totalVertices = nodes.reduce((s, n) => s + (n.meshVertexCount || 0), 0);
    const typeCounts = {};
    for (const node of nodes) {
      const type = node.type || "unknown";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }

    // Branching factor: average children per non-leaf node
    const nonLeaves = nodes.filter(n => children[n.id].length > 0);
    const avgBranchingFactor = nonLeaves.length > 0
      ? Math.round((nonLeaves.reduce((s, n) => s + children[n.id].length, 0) / nonLeaves.length) * 100) / 100
      : 0;

    // Leaf nodes count
    const leafCount = nodes.filter(n => children[n.id].length === 0).length;

    // Scene bounds from world transforms
    const sceneBounds = {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity },
    };
    for (const wt of Object.values(worldTransforms)) {
      sceneBounds.min.x = Math.min(sceneBounds.min.x, wt.position.x);
      sceneBounds.min.y = Math.min(sceneBounds.min.y, wt.position.y);
      sceneBounds.min.z = Math.min(sceneBounds.min.z, wt.position.z);
      sceneBounds.max.x = Math.max(sceneBounds.max.x, wt.position.x);
      sceneBounds.max.y = Math.max(sceneBounds.max.y, wt.position.y);
      sceneBounds.max.z = Math.max(sceneBounds.max.z, wt.position.z);
    }

    const result = {
      analyzedAt: new Date().toISOString(),
      totalNodes: nodes.length,
      rootCount: roots.length,
      roots,
      maxDepth,
      leafCount,
      avgBranchingFactor,
      totalVertices,
      typeCounts,
      worldTransforms,
      overlappingPairs: overlaps,
      sceneBounds: nodes.length > 0 ? sceneBounds : null,
      complexity: {
        nodeCount: nodes.length,
        depthScore: maxDepth,
        branchingScore: avgBranchingFactor,
        vertexScore: totalVertices,
        overlapCount: overlaps.length,
        // Composite complexity: weighted combination
        composite: Math.round((
          nodes.length * 1 +
          maxDepth * 5 +
          avgBranchingFactor * 3 +
          Math.log2(totalVertices + 1) * 2 +
          overlaps.length * 10
        ) * 100) / 100,
      },
    };

    artifact.data.sceneGraph = result;
    return { ok: true, result };
  });
}

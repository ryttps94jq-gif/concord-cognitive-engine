// server/domains/geology.js
export default function registerGeologyActions(registerLensAction) {
  registerLensAction("geology", "rockClassify", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const hardness = parseFloat(data.mohsHardness) || 0;
    const luster = (data.luster || "").toLowerCase();
    const color = data.color || "";
    const texture = (data.texture || "").toLowerCase();
    const rockType = texture.includes("crystal") || texture.includes("foliat") ? "metamorphic" : texture.includes("vesicul") || texture.includes("porphyr") ? "igneous" : texture.includes("clastic") || texture.includes("fossil") ? "sedimentary" : "unclassified";
    return { ok: true, result: { specimen: data.name || artifact.title, rockType, mohsHardness: hardness, luster, color, texture, durability: hardness >= 7 ? "highly-durable" : hardness >= 5 ? "moderate" : "soft", commonUses: hardness >= 7 ? ["construction", "countertops", "monuments"] : hardness >= 4 ? ["building stone", "crushed aggregate"] : ["carving", "talc", "filler"] } };
  });
  registerLensAction("geology", "seismicRisk", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const lat = parseFloat(data.latitude) || 37;
    const lon = parseFloat(data.longitude) || -122;
    const soilType = (data.soilType || "rock").toLowerCase();
    const buildingCode = data.buildingCode || "IBC 2021";
    const amplificationFactors = { rock: 1.0, "stiff-soil": 1.2, "soft-soil": 1.6, "very-soft": 2.0, sand: 1.4, clay: 1.5 };
    const amp = amplificationFactors[soilType] || 1.0;
    const baseRisk = Math.abs(lat - 37) < 5 && Math.abs(lon + 122) < 5 ? 0.8 : Math.abs(lat - 35) < 10 ? 0.4 : 0.15;
    const adjustedRisk = Math.min(1, baseRisk * amp);
    return { ok: true, result: { location: { lat, lon }, soilType, amplificationFactor: amp, baseSeismicRisk: Math.round(baseRisk * 100), adjustedRisk: Math.round(adjustedRisk * 100), riskLevel: adjustedRisk > 0.6 ? "high" : adjustedRisk > 0.3 ? "moderate" : "low", buildingCode, recommendations: adjustedRisk > 0.5 ? ["Seismic retrofit required", "Foundation isolation recommended", "Earthquake insurance essential"] : ["Standard building codes sufficient"] } };
  });
  registerLensAction("geology", "mineralId", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const properties = { hardness: parseFloat(data.hardness) || 0, streak: data.streak || "", cleavage: data.cleavage || "", fracture: data.fracture || "", specific_gravity: parseFloat(data.specificGravity) || 0 };
    const score = (properties.hardness > 0 ? 25 : 0) + (properties.streak ? 20 : 0) + (properties.cleavage ? 20 : 0) + (properties.specific_gravity > 0 ? 20 : 0) + (data.color ? 15 : 0);
    return { ok: true, result: { specimen: data.name || artifact.title, properties, identificationConfidence: score, testsPerformed: Object.values(properties).filter(v => v && v !== 0).length, testsRecommended: score < 60 ? ["streak test", "acid test", "hardness test", "specific gravity"].filter(t => !properties[t.split(" ")[0]]) : [], classification: properties.hardness >= 7 ? "silicate-likely" : properties.hardness >= 3 ? "carbonate-or-sulfate" : "clay-or-evaporite" } };
  });
  registerLensAction("geology", "stratigraphicColumn", (ctx, artifact, _params) => {
    const layers = artifact.data?.layers || [];
    if (layers.length === 0) return { ok: true, result: { message: "Add geological layers with thickness and age." } };
    let cumulativeDepth = 0;
    const column = layers.map(l => { const thick = parseFloat(l.thickness) || 1; cumulativeDepth += thick; return { formation: l.name || l.formation, lithology: l.lithology || l.rockType || "unknown", thickness: thick, depthTop: cumulativeDepth - thick, depthBottom: cumulativeDepth, age: l.age || "unknown", fossils: l.fossils || [] }; });
    return { ok: true, result: { layers: column, totalThickness: cumulativeDepth, layerCount: layers.length, oldestFormation: column[column.length - 1]?.formation, youngestFormation: column[0]?.formation, fossiliferous: column.filter(l => l.fossils.length > 0).length } };
  });
}

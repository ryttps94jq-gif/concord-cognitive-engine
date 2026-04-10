// server/domains/energy.js
export default function registerEnergyActions(registerLensAction) {
  registerLensAction("energy", "consumptionAnalysis", (ctx, artifact, _params) => {
    const readings = artifact.data?.readings || [];
    if (readings.length === 0) return { ok: true, result: { message: "Add energy readings (kWh) to analyze consumption." } };
    const values = readings.map(r => parseFloat(r.kWh || r.value) || 0);
    const total = values.reduce((s, v) => s + v, 0);
    const avg = total / values.length;
    const peak = Math.max(...values);
    const costPerKWh = parseFloat(artifact.data?.costPerKWh) || 0.12;
    return { ok: true, result: { totalKWh: Math.round(total * 10) / 10, avgKWh: Math.round(avg * 10) / 10, peakKWh: Math.round(peak * 10) / 10, readingCount: values.length, estimatedCost: Math.round(total * costPerKWh * 100) / 100, costPerKWh, peakToAvgRatio: Math.round((peak / avg) * 100) / 100, savingsOpportunity: peak > avg * 2 ? "Significant peak reduction possible" : "Consumption is relatively stable" } };
  });
  registerLensAction("energy", "solarEstimate", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const roofSqFt = parseFloat(data.roofAreaSqFt) || 1000;
    const sunHours = parseFloat(data.peakSunHours) || 5;
    const usageKWh = parseFloat(data.monthlyUsageKWh) || 900;
    const panelWatts = 400;
    const panelSqFt = 18;
    const maxPanels = Math.floor(roofSqFt * 0.7 / panelSqFt);
    const systemKW = maxPanels * panelWatts / 1000;
    const monthlyProduction = systemKW * sunHours * 30 * 0.8;
    const coveragePercent = Math.round((monthlyProduction / usageKWh) * 100);
    const costEstimate = Math.round(systemKW * 2800);
    const annualSavings = Math.round(Math.min(monthlyProduction, usageKWh) * 12 * 0.12);
    const paybackYears = annualSavings > 0 ? Math.round((costEstimate * 0.7) / annualSavings * 10) / 10 : 0; // 30% tax credit
    return { ok: true, result: { roofArea: roofSqFt, maxPanels, systemSizeKW: Math.round(systemKW * 10) / 10, monthlyProductionKWh: Math.round(monthlyProduction), coveragePercent, estimatedCost: costEstimate, afterTaxCredit: Math.round(costEstimate * 0.7), annualSavings, paybackYears, recommendation: coveragePercent >= 100 ? "Solar can cover 100% of usage" : `Solar can cover ${coveragePercent}% of usage` } };
  });
  registerLensAction("energy", "carbonFootprint", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const electricityKWh = parseFloat(data.electricityKWh) || 0;
    const naturalGasTherms = parseFloat(data.naturalGasTherms) || 0;
    const gasolineGallons = parseFloat(data.gasolineGallons) || 0;
    const flightMiles = parseFloat(data.flightMiles) || 0;
    // EPA emission factors
    const co2Electricity = electricityKWh * 0.000417; // metric tons per kWh
    const co2Gas = naturalGasTherms * 0.0053;
    const co2Gasoline = gasolineGallons * 0.00887;
    const co2Flights = flightMiles * 0.000255;
    const total = co2Electricity + co2Gas + co2Gasoline + co2Flights;
    const usAvg = 16; // tons per capita
    return { ok: true, result: { breakdown: { electricity: Math.round(co2Electricity * 1000) / 1000, naturalGas: Math.round(co2Gas * 1000) / 1000, transportation: Math.round(co2Gasoline * 1000) / 1000, flights: Math.round(co2Flights * 1000) / 1000 }, totalMetricTons: Math.round(total * 1000) / 1000, annualEstimate: Math.round(total * 12 * 100) / 100, vsUSAverage: `${Math.round((total * 12 / usAvg) * 100)}% of US average`, topSource: [["electricity", co2Electricity], ["naturalGas", co2Gas], ["transportation", co2Gasoline], ["flights", co2Flights]].sort((a, b) => b[1] - a[1])[0][0], reductionTips: co2Electricity > co2Gas ? ["Switch to renewable energy provider", "Improve insulation", "LED lighting"] : ["Improve heating efficiency", "Seal air leaks", "Smart thermostat"] } };
  });
  registerLensAction("energy", "gridStatus", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const demandMW = parseFloat(data.currentDemandMW) || 0;
    const capacityMW = parseFloat(data.totalCapacityMW) || 0;
    const renewablePercent = parseFloat(data.renewablePercent) || 0;
    const frequency = parseFloat(data.gridFrequencyHz) || 60;
    const utilization = capacityMW > 0 ? Math.round((demandMW / capacityMW) * 100) : 0;
    const frequencyDeviation = Math.abs(frequency - 60);
    return { ok: true, result: { currentDemand: `${demandMW} MW`, totalCapacity: `${capacityMW} MW`, utilization, renewableShare: `${renewablePercent}%`, gridFrequency: `${frequency} Hz`, frequencyStable: frequencyDeviation < 0.05, status: utilization > 90 ? "critical-load" : utilization > 75 ? "high-load" : utilization > 50 ? "normal" : "low-load", reserves: `${Math.round(capacityMW - demandMW)} MW available` } };
  });
}

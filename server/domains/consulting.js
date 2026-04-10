// server/domains/consulting.js
export default function registerConsultingActions(registerLensAction) {
  registerLensAction("consulting", "engagementScope", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const deliverables = data.deliverables || [];
    const rate = parseFloat(data.hourlyRate) || 200;
    const hours = deliverables.reduce((s, d) => s + (parseFloat(d.hours) || 8), 0);
    const totalFee = Math.round(hours * rate * 100) / 100;
    const contingency = Math.round(totalFee * 0.15 * 100) / 100;
    return { ok: true, result: { client: data.client || artifact.title, deliverables: deliverables.map(d => ({ name: d.name, hours: parseFloat(d.hours) || 8, fee: Math.round((parseFloat(d.hours) || 8) * rate * 100) / 100 })), totalHours: hours, hourlyRate: rate, subtotal: totalFee, contingency, grandTotal: Math.round((totalFee + contingency) * 100) / 100, timeline: `${Math.ceil(hours / 40)} weeks at full-time` } };
  });
  registerLensAction("consulting", "utilizationRate", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const billableHours = parseFloat(data.billableHours) || 0;
    const totalHours = parseFloat(data.totalHours) || 40;
    const rate = billableHours / totalHours;
    return { ok: true, result: { billableHours, totalHours, utilizationRate: Math.round(rate * 100), target: 75, variance: Math.round(rate * 100) - 75, status: rate >= 0.8 ? "excellent" : rate >= 0.65 ? "on-target" : rate >= 0.5 ? "below-target" : "critical" } };
  });
  registerLensAction("consulting", "proposalScore", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const sections = ["executive-summary", "methodology", "timeline", "pricing", "team", "references"];
    const present = sections.filter(s => data[s] || data[s.replace("-", "")]);
    const score = Math.round((present.length / sections.length) * 100);
    return { ok: true, result: { score, sectionsPresent: present, sectionsMissing: sections.filter(s => !present.includes(s)), completeness: score >= 80 ? "ready-to-submit" : score >= 50 ? "needs-work" : "incomplete" } };
  });
  registerLensAction("consulting", "clientHealth", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const nps = parseInt(data.nps) || 0;
    const invoicesPaid = parseInt(data.invoicesPaid) || 0;
    const invoicesTotal = parseInt(data.invoicesTotal) || 1;
    const responseTime = parseFloat(data.avgResponseDays) || 3;
    const paymentRate = Math.round((invoicesPaid / invoicesTotal) * 100);
    const health = Math.round((Math.min(nps + 100, 200) / 200 * 30 + paymentRate / 100 * 40 + Math.max(0, 1 - responseTime / 14) * 30));
    return { ok: true, result: { client: data.client || artifact.title, nps, paymentRate, avgResponseDays: responseTime, healthScore: health, risk: health >= 70 ? "low" : health >= 40 ? "medium" : "high" } };
  });
}

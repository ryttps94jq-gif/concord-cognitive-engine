// server/domains/parenting.js
// Domain actions for parenting: milestone tracking, growth percentiles,
// sleep analysis, developmental screening, routine optimization.

export default function registerParentingActions(registerLensAction) {
  /**
   * milestoneCheck
   * Evaluate developmental milestones against age-appropriate expectations.
   * artifact.data: { childName, childAge, milestones: [{ category, name, date }] }
   */
  registerLensAction("parenting", "milestoneCheck", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const childAge = data.childAge || "";
    const milestones = data.milestones || [];

    // Parse age string like "2y 3m" into months
    const ageMatch = childAge.match(/(\d+)\s*y(?:ear)?s?\s*(?:(\d+)\s*m(?:onth)?s?)?/i);
    const ageMonths = ageMatch ? (parseInt(ageMatch[1]) || 0) * 12 + (parseInt(ageMatch[2]) || 0) : 0;

    // CDC milestone benchmarks by age range (months)
    const benchmarks = [
      { ageMin: 0, ageMax: 3, category: "Physical", expected: ["Lifts head", "Opens/closes hands", "Brings hands to mouth"] },
      { ageMin: 0, ageMax: 3, category: "Social", expected: ["Smiles at people", "Tries to look at parent", "Coos and makes sounds"] },
      { ageMin: 4, ageMax: 6, category: "Physical", expected: ["Rolls over", "Reaches for toys", "Brings things to mouth"] },
      { ageMin: 4, ageMax: 6, category: "Cognitive", expected: ["Responds to name", "Shows curiosity", "Passes things hand to hand"] },
      { ageMin: 7, ageMax: 12, category: "Physical", expected: ["Sits without support", "Crawls", "Pulls to stand", "May walk"] },
      { ageMin: 7, ageMax: 12, category: "Language", expected: ["Babbles", "Says mama/dada", "Understands no"] },
      { ageMin: 12, ageMax: 24, category: "Physical", expected: ["Walks independently", "Begins to run", "Climbs furniture"] },
      { ageMin: 12, ageMax: 24, category: "Language", expected: ["Says several words", "Points to things", "2-word phrases by 24m"] },
      { ageMin: 12, ageMax: 24, category: "Cognitive", expected: ["Follows simple directions", "Scribbles", "Sorts shapes"] },
      { ageMin: 24, ageMax: 48, category: "Physical", expected: ["Runs easily", "Jumps", "Pedals tricycle"] },
      { ageMin: 24, ageMax: 48, category: "Language", expected: ["3-4 word sentences", "Names familiar things", "Understood by strangers"] },
      { ageMin: 24, ageMax: 48, category: "Social", expected: ["Takes turns", "Shows concern for others", "Plays with other children"] },
      { ageMin: 48, ageMax: 72, category: "Physical", expected: ["Hops on one foot", "Catches bounced ball", "Uses scissors"] },
      { ageMin: 48, ageMax: 72, category: "Cognitive", expected: ["Counts to 10+", "Draws person with 6 parts", "Tells stories"] },
    ];

    const applicable = benchmarks.filter(b => ageMonths >= b.ageMin && ageMonths <= b.ageMax);
    const achievedNames = milestones.map(m => (m.name || m.milestone || "").toLowerCase());

    const results = applicable.map(benchmark => {
      const achieved = benchmark.expected.filter(exp =>
        achievedNames.some(a => a.includes(exp.toLowerCase().slice(0, 10)))
      );
      return {
        category: benchmark.category,
        ageRange: `${benchmark.ageMin}-${benchmark.ageMax} months`,
        expected: benchmark.expected,
        achieved: achieved.length,
        total: benchmark.expected.length,
        completionRate: Math.round((achieved.length / benchmark.expected.length) * 100),
      };
    });

    const overallRate = results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.completionRate, 0) / results.length)
      : 0;

    return {
      ok: true,
      result: {
        childName: data.childName,
        ageMonths,
        ageDisplay: childAge,
        milestoneResults: results,
        overallCompletionRate: overallRate,
        totalMilestonesRecorded: milestones.length,
        assessment: overallRate >= 80 ? "On track — excellent development"
          : overallRate >= 50 ? "Mostly on track — a few areas to monitor"
          : overallRate >= 20 ? "Some delays noted — consider pediatrician consultation"
          : ageMonths > 0 ? "Limited milestone data — record more observations" : "Enter child age to assess milestones",
      },
    };
  });

  /**
   * growthPercentile
   * Calculate height/weight percentile based on WHO/CDC growth charts.
   * artifact.data: { childAge, height, weight, headCirc, sex }
   */
  registerLensAction("parenting", "growthPercentile", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const height = parseFloat(data.height) || 0;
    const weight = parseFloat(data.weight) || 0;
    const headCirc = parseFloat(data.headCirc) || 0;
    const sex = (data.sex || "neutral").toLowerCase();

    // Simplified percentile estimation using z-score approximation
    // WHO median values for 2-year-old as reference point
    const medians = {
      male: { height: 34.2, weight: 27.5, head: 19.2 },
      female: { height: 33.7, weight: 26.5, head: 18.9 },
      neutral: { height: 34.0, weight: 27.0, head: 19.0 },
    };
    const ref = medians[sex] || medians.neutral;

    // Approximate percentile from deviation
    function estimatePercentile(value, median, sd) {
      if (!value || !median) return null;
      const z = (value - median) / sd;
      // Simplified normal CDF approximation
      const p = 1 / (1 + Math.exp(-1.7 * z));
      return Math.round(p * 100);
    }

    const heightPct = estimatePercentile(height, ref.height, 2.5);
    const weightPct = estimatePercentile(weight, ref.weight, 3.5);
    const headPct = estimatePercentile(headCirc, ref.head, 1.2);

    // BMI for age (simplified)
    const heightM = height > 0 ? height * 0.0254 : 1; // inches to meters
    const weightKg = weight > 0 ? weight * 0.4536 : 0;
    const bmi = heightM > 0 ? Math.round((weightKg / (heightM * heightM)) * 10) / 10 : 0;

    const flags = [];
    if (weightPct !== null && weightPct < 5) flags.push("Weight below 5th percentile — discuss with pediatrician");
    if (weightPct !== null && weightPct > 95) flags.push("Weight above 95th percentile — monitor growth trajectory");
    if (heightPct !== null && heightPct < 5) flags.push("Height below 5th percentile — may need evaluation");
    if (headPct !== null && headPct < 5) flags.push("Head circumference below 5th percentile — worth monitoring");

    return {
      ok: true,
      result: {
        measurements: {
          height: height ? `${height} in` : "Not recorded",
          weight: weight ? `${weight} lbs` : "Not recorded",
          headCircumference: headCirc ? `${headCirc} in` : "Not recorded",
          bmi,
        },
        percentiles: {
          height: heightPct !== null ? `${heightPct}th` : "N/A",
          weight: weightPct !== null ? `${weightPct}th` : "N/A",
          headCircumference: headPct !== null ? `${headPct}th` : "N/A",
        },
        flags,
        note: "Percentiles are approximations. Consult your pediatrician for precise growth chart plotting.",
      },
    };
  });

  /**
   * sleepAnalysis
   * Analyze sleep patterns and recommend age-appropriate schedules.
   * artifact.data: { childAge, sleepLogs: [{ date, bedtime, wakeTime, naps }] }
   */
  registerLensAction("parenting", "sleepAnalysis", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const childAge = data.childAge || "";
    const sleepLogs = data.sleepLogs || [];

    const ageMatch = childAge.match(/(\d+)\s*y/i);
    const ageYears = ageMatch ? parseInt(ageMatch[1]) : 2;

    // Recommended sleep by age (hours per 24h)
    const recommendations = {
      0: { total: 16, nightMin: 8, nightMax: 9, naps: "3-5 naps", napHours: 7 },
      1: { total: 14, nightMin: 10, nightMax: 12, naps: "2 naps", napHours: 3 },
      2: { total: 13, nightMin: 10, nightMax: 12, naps: "1 nap", napHours: 2 },
      3: { total: 12, nightMin: 10, nightMax: 12, naps: "0-1 nap", napHours: 1 },
      5: { total: 11, nightMin: 10, nightMax: 11, naps: "No naps", napHours: 0 },
      8: { total: 10, nightMin: 9, nightMax: 11, naps: "No naps", napHours: 0 },
      13: { total: 9, nightMin: 8, nightMax: 10, naps: "No naps", napHours: 0 },
    };

    const ageKey = Object.keys(recommendations).map(Number).filter(k => k <= ageYears).pop() || 2;
    const rec = recommendations[ageKey];

    // Analyze logs
    let avgNightHours = 0;
    let avgNapHours = 0;
    if (sleepLogs.length > 0) {
      for (const log of sleepLogs) {
        if (log.bedtime && log.wakeTime) {
          const bed = new Date(`2000-01-01 ${log.bedtime}`);
          let wake = new Date(`2000-01-01 ${log.wakeTime}`);
          if (wake < bed) wake = new Date(`2000-01-02 ${log.wakeTime}`);
          avgNightHours += (wake.getTime() - bed.getTime()) / 3600000;
        }
        avgNapHours += parseFloat(log.naps) || 0;
      }
      avgNightHours = Math.round((avgNightHours / sleepLogs.length) * 10) / 10;
      avgNapHours = Math.round((avgNapHours / sleepLogs.length) * 10) / 10;
    }

    const totalAvg = avgNightHours + avgNapHours;
    const deficit = rec.total - totalAvg;

    return {
      ok: true,
      result: {
        ageYears,
        recommended: rec,
        actual: {
          avgNightHours,
          avgNapHours,
          totalAvg: Math.round(totalAvg * 10) / 10,
          logsAnalyzed: sleepLogs.length,
        },
        sleepDebt: deficit > 0 ? `${Math.round(deficit * 10) / 10} hours/day below recommended` : "Getting enough sleep",
        tips: [
          deficit > 1 ? `Try moving bedtime ${Math.round(deficit * 30)} minutes earlier` : null,
          ageYears < 3 && avgNapHours < 1 ? "Ensure at least one daytime nap" : null,
          "Consistent bedtime routine helps — bath, book, bed",
          "Limit screen time 1 hour before bed",
          ageYears >= 5 ? "School-age children need 9-11 hours total" : null,
        ].filter(Boolean),
      },
    };
  });

  /**
   * routineOptimizer
   * Suggest an optimized daily routine based on child's age and family schedule.
   * artifact.data: { childAge, schedules: [{ name, time, frequency }] }
   */
  registerLensAction("parenting", "routineOptimizer", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const childAge = data.childAge || "2y";
    const schedules = data.schedules || [];

    const ageMatch = childAge.match(/(\d+)/);
    const ageYears = ageMatch ? parseInt(ageMatch[1]) : 2;

    // Age-appropriate routine templates
    const templates = {
      infant: [
        { time: "06:00", activity: "Wake & Feed", duration: 30, category: "care" },
        { time: "07:00", activity: "Tummy Time / Play", duration: 20, category: "development" },
        { time: "08:00", activity: "Nap 1", duration: 90, category: "sleep" },
        { time: "10:00", activity: "Feed", duration: 30, category: "care" },
        { time: "10:30", activity: "Sensory Play", duration: 30, category: "development" },
        { time: "11:30", activity: "Nap 2", duration: 90, category: "sleep" },
        { time: "13:30", activity: "Feed", duration: 30, category: "care" },
        { time: "14:00", activity: "Outdoor Time", duration: 30, category: "development" },
        { time: "15:00", activity: "Nap 3", duration: 60, category: "sleep" },
        { time: "17:00", activity: "Feed", duration: 30, category: "care" },
        { time: "18:00", activity: "Bath", duration: 20, category: "care" },
        { time: "18:30", activity: "Bedtime Routine", duration: 30, category: "sleep" },
      ],
      toddler: [
        { time: "07:00", activity: "Wake & Breakfast", duration: 30, category: "care" },
        { time: "08:00", activity: "Free Play / Arts", duration: 60, category: "development" },
        { time: "09:00", activity: "Outdoor Play", duration: 60, category: "physical" },
        { time: "10:00", activity: "Snack & Story Time", duration: 30, category: "learning" },
        { time: "10:30", activity: "Learning Activity", duration: 30, category: "learning" },
        { time: "11:30", activity: "Lunch", duration: 30, category: "care" },
        { time: "12:30", activity: "Nap", duration: 120, category: "sleep" },
        { time: "14:30", activity: "Snack", duration: 15, category: "care" },
        { time: "15:00", activity: "Playdate / Park", duration: 90, category: "social" },
        { time: "17:00", activity: "Dinner", duration: 30, category: "care" },
        { time: "18:00", activity: "Bath & Wind Down", duration: 30, category: "care" },
        { time: "19:00", activity: "Bedtime Stories & Sleep", duration: 30, category: "sleep" },
      ],
      preschool: [
        { time: "07:00", activity: "Wake & Breakfast", duration: 30, category: "care" },
        { time: "08:00", activity: "School / Learning", duration: 180, category: "learning" },
        { time: "12:00", activity: "Lunch", duration: 30, category: "care" },
        { time: "13:00", activity: "Quiet Time / Rest", duration: 60, category: "sleep" },
        { time: "14:00", activity: "Creative Play", duration: 60, category: "development" },
        { time: "15:00", activity: "Outdoor Activity", duration: 60, category: "physical" },
        { time: "16:00", activity: "Snack & Free Play", duration: 60, category: "care" },
        { time: "17:30", activity: "Dinner", duration: 30, category: "care" },
        { time: "18:30", activity: "Family Time", duration: 60, category: "social" },
        { time: "19:30", activity: "Bath & Bedtime", duration: 30, category: "sleep" },
      ],
    };

    const stage = ageYears < 1 ? "infant" : ageYears < 3 ? "toddler" : "preschool";
    const template = templates[stage] || templates.toddler;

    // Merge with existing schedules
    const existingTimes = new Set(schedules.map(s => s.time));
    const suggested = template.filter(t => !existingTimes.has(t.time));

    return {
      ok: true,
      result: {
        stage,
        ageYears,
        suggestedRoutine: template,
        existingSchedules: schedules.length,
        newSuggestions: suggested.length,
        categoryBreakdown: template.reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + t.duration;
          return acc;
        }, {}),
      },
    };
  });

  /**
   * immunizationTracker
   * Track and recommend childhood immunizations per CDC schedule.
   * artifact.data: { childAge, vaccinations: [{ name, date }] }
   */
  registerLensAction("parenting", "immunizationTracker", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const childAge = data.childAge || "1y";
    const vaccinations = data.vaccinations ? data.vaccinations.split(",").map(v => v.trim()) : [];

    const ageMatch = childAge.match(/(\d+)\s*y/i);
    const ageYears = ageMatch ? parseInt(ageMatch[1]) : 1;
    const ageMonths = ageYears * 12;

    const cdcSchedule = [
      { vaccine: "Hepatitis B", doses: 3, byMonths: 6, critical: true },
      { vaccine: "DTaP", doses: 5, byMonths: 72, critical: true },
      { vaccine: "IPV (Polio)", doses: 4, byMonths: 72, critical: true },
      { vaccine: "Hib", doses: 4, byMonths: 15, critical: true },
      { vaccine: "PCV13 (Pneumococcal)", doses: 4, byMonths: 15, critical: true },
      { vaccine: "RV (Rotavirus)", doses: 3, byMonths: 8, critical: true },
      { vaccine: "MMR", doses: 2, byMonths: 72, critical: true },
      { vaccine: "Varicella", doses: 2, byMonths: 72, critical: true },
      { vaccine: "Hepatitis A", doses: 2, byMonths: 24, critical: true },
      { vaccine: "Influenza", doses: 1, byMonths: 6, critical: false, note: "Annual" },
    ];

    const applicable = cdcSchedule.filter(v => ageMonths >= v.byMonths - 6);
    const received = applicable.map(v => {
      const got = vaccinations.some(vax => vax.toLowerCase().includes(v.vaccine.toLowerCase().slice(0, 5)));
      return {
        vaccine: v.vaccine,
        required: v.critical,
        received: got,
        status: got ? "completed" : ageMonths > v.byMonths ? "overdue" : "upcoming",
        note: v.note || null,
      };
    });

    const overdue = received.filter(r => r.status === "overdue" && r.required).length;

    return {
      ok: true,
      result: {
        childAge,
        ageMonths,
        immunizations: received,
        summary: {
          total: received.length,
          completed: received.filter(r => r.received).length,
          overdue,
          complianceRate: received.length > 0 ? Math.round((received.filter(r => r.received).length / received.length) * 100) : 0,
        },
        action: overdue > 0 ? `${overdue} critical immunization(s) overdue — schedule pediatrician visit` : "Immunizations on track",
      },
    };
  });
}

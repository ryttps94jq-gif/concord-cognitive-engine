// server/domains/calendar.js
// Domain actions for calendar: conflict detection, availability analysis,
// recurring event expansion, time zone conversion, schedule optimization.

export default function registerCalendarActions(registerLensAction) {
  registerLensAction("calendar", "detectConflicts", (ctx, artifact, _params) => {
    const events = artifact.data?.events || [];
    if (events.length < 2) return { ok: true, result: { message: "Add at least 2 events to check for conflicts." } };
    const parsed = events.map(e => ({ name: e.name || e.title, start: new Date(e.start || e.startDate), end: new Date(e.end || e.endDate || new Date(new Date(e.start || e.startDate).getTime() + 3600000)) }));
    parsed.sort((a, b) => a.start.getTime() - b.start.getTime());
    const conflicts = [];
    for (let i = 0; i < parsed.length; i++) {
      for (let j = i + 1; j < parsed.length; j++) {
        if (parsed[i].end > parsed[j].start && parsed[i].start < parsed[j].end) {
          const overlapMinutes = Math.round((Math.min(parsed[i].end.getTime(), parsed[j].end.getTime()) - parsed[j].start.getTime()) / 60000);
          conflicts.push({ event1: parsed[i].name, event2: parsed[j].name, overlapMinutes });
        }
      }
    }
    return { ok: true, result: { totalEvents: events.length, conflicts, conflictCount: conflicts.length, conflictFree: conflicts.length === 0 } };
  });

  registerLensAction("calendar", "findAvailability", (ctx, artifact, _params) => {
    const events = artifact.data?.events || [];
    const workStart = parseInt(artifact.data?.workStartHour) || 9;
    const workEnd = parseInt(artifact.data?.workEndHour) || 17;
    const slotMinutes = parseInt(artifact.data?.slotMinutes) || 30;
    const dateStr = artifact.data?.date || new Date().toISOString().split("T")[0];
    const dayStart = new Date(`${dateStr}T${String(workStart).padStart(2, "0")}:00:00`);
    const dayEnd = new Date(`${dateStr}T${String(workEnd).padStart(2, "0")}:00:00`);
    const dayEvents = events.filter(e => { const s = new Date(e.start || e.startDate); return s >= dayStart && s < dayEnd; })
      .map(e => ({ start: new Date(e.start || e.startDate), end: new Date(e.end || e.endDate || new Date(new Date(e.start || e.startDate).getTime() + 3600000)) }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const slots = [];
    let cursor = dayStart.getTime();
    for (const evt of dayEvents) {
      if (cursor < evt.start.getTime()) {
        const gapMinutes = (evt.start.getTime() - cursor) / 60000;
        if (gapMinutes >= slotMinutes) slots.push({ start: new Date(cursor).toTimeString().slice(0, 5), end: evt.start.toTimeString().slice(0, 5), minutes: Math.round(gapMinutes) });
      }
      cursor = Math.max(cursor, evt.end.getTime());
    }
    if (cursor < dayEnd.getTime()) {
      const gapMinutes = (dayEnd.getTime() - cursor) / 60000;
      if (gapMinutes >= slotMinutes) slots.push({ start: new Date(cursor).toTimeString().slice(0, 5), end: dayEnd.toTimeString().slice(0, 5), minutes: Math.round(gapMinutes) });
    }
    return { ok: true, result: { date: dateStr, workHours: `${workStart}:00-${workEnd}:00`, eventsToday: dayEvents.length, availableSlots: slots, totalFreeMinutes: slots.reduce((s, sl) => s + sl.minutes, 0) } };
  });

  registerLensAction("calendar", "expandRecurring", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const rule = data.recurrence || data.frequency || "weekly";
    const startDate = new Date(data.startDate || data.start || new Date());
    const count = Math.min(parseInt(data.count) || 10, 52);
    const intervals = { daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 91, yearly: 365 };
    const intervalDays = intervals[rule.toLowerCase()] || 7;
    const occurrences = [];
    for (let i = 0; i < count; i++) {
      const date = new Date(startDate.getTime() + i * intervalDays * 86400000);
      occurrences.push({ occurrence: i + 1, date: date.toISOString().split("T")[0], dayOfWeek: date.toLocaleDateString("en-US", { weekday: "long" }) });
    }
    return { ok: true, result: { eventName: data.name || artifact.title, recurrence: rule, startDate: startDate.toISOString().split("T")[0], occurrences, totalOccurrences: count, spanDays: (count - 1) * intervalDays } };
  });

  registerLensAction("calendar", "scheduleOptimize", (ctx, artifact, _params) => {
    const tasks = artifact.data?.tasks || [];
    if (tasks.length === 0) return { ok: true, result: { message: "Add tasks with duration and priority to optimize schedule." } };
    const sorted = tasks.map(t => ({ name: t.name || t.title, duration: parseInt(t.duration) || 30, priority: t.priority || "medium", deadline: t.deadline, energy: t.energy || "medium" }))
      .sort((a, b) => { const pOrder = { critical: 0, high: 1, medium: 2, low: 3 }; return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2); });
    // Schedule high-energy tasks in morning, low-energy in afternoon
    const morning = sorted.filter(t => t.energy === "high" || t.priority === "critical");
    const afternoon = sorted.filter(t => t.energy !== "high" && t.priority !== "critical");
    const totalMinutes = sorted.reduce((s, t) => s + t.duration, 0);
    return { ok: true, result: { optimizedOrder: sorted.map(t => t.name), morningBlock: morning.map(t => t.name), afternoonBlock: afternoon.map(t => t.name), totalMinutes, totalHours: Math.round(totalMinutes / 60 * 10) / 10, fitsInWorkday: totalMinutes <= 480 } };
  });
}

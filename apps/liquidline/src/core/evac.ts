// Evacuation: the checklist, the vacuum target and the decay (standing vacuum) test verdict.
// Targets follow common manufacturer and industry guidance: pull below 500 micron (≈ 67 Pa), then isolate the pump
// and hold. A rise that levels off below about 1000 micron means the system is dry and tight; a rise that keeps
// climbing means a leak; a rise that levels off higher means moisture (keep pulling). The unit's manual wins.

export const TARGET_MICRON = 500;
export const DECAY_LIMIT_MICRON = 1000;
export const DECAY_MINUTES = 10;

export type DecayReading = { minute: number; micron: number };
export type DecayVerdict = { verdict: 'pass' | 'leak' | 'moisture' | 'not-deep' | 'need-more'; text: string };

/** Judges a standing-vacuum test from readings taken after the pump was isolated (minute 0 = isolation). */
export function judgeDecay(readings: DecayReading[], minutes = DECAY_MINUTES): DecayVerdict {
  const r = readings.filter((x) => Number.isFinite(x.minute) && Number.isFinite(x.micron) && x.micron >= 0).sort((a, b) => a.minute - b.minute);
  if (r.length < 2) return { verdict: 'need-more', text: 'Log a reading at isolation and at least one more.' };
  const start = r[0];
  const last = r[r.length - 1];
  if (start.micron > TARGET_MICRON) return { verdict: 'not-deep', text: `Start below ${TARGET_MICRON} micron before the decay test. Keep pulling.` };
  if (last.minute - start.minute < minutes) {
    if (last.micron > DECAY_LIMIT_MICRON * 2) return { verdict: 'leak', text: 'Rising fast. Likely a leak: check flares, cores and hose seals.' };
    return { verdict: 'need-more', text: `Keep holding: ${Math.max(0, Math.ceil(minutes - (last.minute - start.minute)))} min to go.` };
  }
  // Rate over the last third of the test versus the first third: a leak keeps climbing at the same rate.
  const span = last.minute - start.minute;
  const at = (m: number) => interp(r, m);
  const early = (at(start.minute + span / 3) - start.micron) / (span / 3);
  const late = (last.micron - at(last.minute - span / 3)) / (span / 3);
  if (last.micron <= DECAY_LIMIT_MICRON) return { verdict: 'pass', text: `Held below ${DECAY_LIMIT_MICRON} micron for ${Math.round(span)} min. Dry and tight.` };
  if (early > 0 && late >= early * 0.6) return { verdict: 'leak', text: 'Still climbing at a steady rate: a leak. Find it, fix it and evacuate again.' };
  return { verdict: 'moisture', text: 'Rose then levelled off above the limit: moisture. Keep evacuating (warm the system, change pump oil), then test again.' };
}

function interp(r: DecayReading[], m: number): number {
  if (m <= r[0].minute) return r[0].micron;
  for (let i = 1; i < r.length; i++) {
    if (r[i].minute >= m) {
      const a = r[i - 1];
      const b = r[i];
      const f = b.minute === a.minute ? 1 : (m - a.minute) / (b.minute - a.minute);
      return a.micron + (b.micron - a.micron) * f;
    }
  }
  return r[r.length - 1].micron;
}

export type ChecklistItem = { id: string; text: string; detail?: string; flammableOnly?: boolean };

export const EVAC_CHECKLIST: ChecklistItem[] = [
  { id: 'ppe', text: 'Gloves and eye protection on', detail: 'Liquid refrigerant burns skin and eyes.' },
  { id: 'ignition', text: 'No ignition sources nearby; area ventilated', detail: 'Flammable refrigerant on this job.', flammableOnly: true },
  { id: 'pressure-test', text: 'Strength and tightness test with dry nitrogen (OFN)', detail: 'Use the test pressure in the unit’s manual. Never use oxygen or compressed air. Hold and check for a drop.' },
  { id: 'release', text: 'Release the nitrogen to a safe place' },
  { id: 'pump-oil', text: 'Vacuum pump oil fresh, pump rated for this refrigerant' },
  { id: 'hoses', text: 'Short, large-bore vacuum hoses; valve cores removed with a core tool', detail: 'Cores and thin hoses slow evacuation a lot.' },
  { id: 'gauge', text: 'Micron gauge at the system end, away from the pump' },
  { id: 'pull', text: `Evacuate below ${TARGET_MICRON} micron (about 67 Pa)` },
  { id: 'decay', text: `Isolate the pump and hold ${DECAY_MINUTES} minutes`, detail: `Should level off below ${DECAY_LIMIT_MICRON} micron.` },
  { id: 'cores', text: 'Refit cores under vacuum or break vacuum with refrigerant' },
  { id: 'open', text: 'Open the service valves fully; check caps and flares for leaks' },
  { id: 'record', text: 'Record the vacuum reached, the decay result and any refrigerant added', detail: 'Your licence and local rules may require a logbook entry.' },
];

export function checklistFor(flammable: boolean): ChecklistItem[] {
  return EVAC_CHECKLIST.filter((c) => !c.flammableOnly || flammable);
}

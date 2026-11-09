// "Take your chart further": a coaching session that goes through all ten
// areas of the client's chart together. Pure helpers; reads and writes are in
// lib/actions/calibration.ts. Two tracks follow from it: the Score (how an
// area is, out of 10) and the Steps (what they agreed to do).

export type CalibratedArea = {
  life_area_id: string;
  alone: number | null; // the score they gave alone in the audit
  agreed: number | null; // agreed together; the new baseline
  definition: string; // what the scores mean for them, in their words
  focus: boolean;
};

const score = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 10 ? v : null);

// Keep only known areas, valid scores and short definitions, in area order.
export function cleanAreas(input: unknown, areaIds: string[]): CalibratedArea[] {
  const given = new Map(
    (Array.isArray(input) ? input : [])
      .filter((a) => a && typeof a.life_area_id === "string")
      .map((a) => [a.life_area_id as string, a])
  );
  return areaIds.map((id) => {
    const a = given.get(id) ?? {};
    return {
      life_area_id: id,
      alone: score(a.alone),
      agreed: score(a.agreed),
      definition: typeof a.definition === "string" ? a.definition.trim().slice(0, 600) : "",
      focus: a.focus === true,
    };
  });
}

// "+4", "−1", "same" or "" (not calibrated yet), from alone to agreed.
export function shift(a: Pick<CalibratedArea, "alone" | "agreed">): string {
  if (a.alone === null || a.agreed === null) return "";
  const d = a.agreed - a.alone;
  return d === 0 ? "same" : d > 0 ? `+${d}` : `−${-d}`;
}

export function progress(areas: CalibratedArea[]) {
  return { agreed: areas.filter((a) => a.agreed !== null).length, defined: areas.filter((a) => a.definition).length, focus: areas.filter((a) => a.focus).length };
}

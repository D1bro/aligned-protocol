// The Next Step as one map (Duane, 10 Nov 2026). Setting a Next Step walks
// it: you are here (the pin), your destination (the X, your 10), your Next
// Step (the camp), what's in the way (rough ground), your route (the moves).
// The set page shows the whole map, and each Next Step card a small trail.

const GOLD = "#D3A758";
const GOLD2 = "#E2BD7A";
const INK = "#FBF8F2";
const INK2 = "#A5ADBF";
const INK3 = "#7C859A";
const LINE = "#3a4560";
const RED = "#EF6464";

const cut = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);

// The five waypoints, for the stepper and the map.
export const WAYPOINTS = ["pin", "x", "camp", "rocks", "route"] as const;

export function WaypointIcon({ kind, size = 20 }: { kind: (typeof WAYPOINTS)[number]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === "pin" ? <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></> : null}
      {kind === "x" ? <path d="M7 7l10 10M17 7L7 17" /> : null}
      {kind === "camp" ? <><path d="M3 20h18" /><path d="M12 4 4 20" /><path d="M12 4l8 16" /><path d="M12 13l-3 7h6z" /></> : null}
      {kind === "rocks" ? <path d="M3 18l5-7 4 5 3-4 6 6z" /> : null}
      {kind === "route" ? <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7" /></> : null}
    </svg>
  );
}

// The stepper across the top of each screen: five points on the map.
export function NsStepper({ screen, labels }: { screen: number; labels: readonly string[] }) {
  return (
    <ol className="ns-way" aria-label="Setting your Next Step">
      {labels.map((label, i) => {
        const n = i + 1;
        const state = n === screen ? "now" : n < screen ? "done" : "";
        return (
          <li key={label} className={state || undefined} aria-current={n === screen ? "step" : undefined}>
            <span className="ns-way-ic"><WaypointIcon kind={WAYPOINTS[i]} /></span>
            <span className="ns-way-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

const TRAIL = "M80 480 C140 462 160 420 190 400 S 250 352 270 322 S 320 236 338 204 S 356 150 360 130";
const TO_CAMP = "M80 480 C140 462 160 420 190 400 S 250 352 270 322";

function Contours() {
  return (
    <g fill="none" stroke={GOLD} strokeOpacity=".09">
      <ellipse cx="360" cy="130" rx="50" ry="34" />
      <ellipse cx="360" cy="135" rx="100" ry="72" />
      <ellipse cx="355" cy="145" rx="160" ry="118" />
      <ellipse cx="345" cy="160" rx="230" ry="170" />
      <ellipse cx="330" cy="180" rx="310" ry="230" />
      <ellipse cx="310" cy="200" rx="400" ry="300" />
    </g>
  );
}

function FaintX({ label = "Your 10" }: { label?: string }) {
  return (
    <>
      <path d="M351 121 L369 139 M369 121 L351 139" stroke={INK3} strokeWidth="2.5" strokeLinecap="round" />
      <text x="360" y={label === "Your 10" ? 162 : 100} textAnchor="middle" className="ns-map-t" fill={INK3}>{label}</text>
    </>
  );
}

function Camp({ glow }: { glow: boolean }) {
  return (
    <>
      {glow ? <circle cx="270" cy="322" r="56" fill={GOLD} fillOpacity=".08" /> : null}
      {glow ? <circle cx="270" cy="322" r="34" fill={GOLD} fillOpacity=".16" /> : null}
      <path d="M248 342 L270 300 L292 342 Z" fill={GOLD} />
      <path d="M270 322 L263 342 H277 Z" fill="#100F18" />
    </>
  );
}

const Pin = () => <path d="M80 486 s-12-11-12-19 a12 12 0 0 1 24 0 c0 8-12 19-12 19z" fill={INK} />;

// The map panel beside each screen. `stage` is the screen (1–5).
export function NsMap({
  stage,
  area,
  start,
  aim,
  moves = [],
}: {
  stage: number;
  area: string;
  start: number | null;
  aim: number | null;
  moves?: { body: string; when: string }[];
}) {
  const going = start && aim && aim > start ? aim : null;
  const label =
    stage === 1 ? `A map: a gold pin marks where you are${start ? `, at ${start}` : ""}. The trail ahead fades into mist.`
    : stage === 2 ? "The map: your pin at the bottom, the trail winding up to a gold X, your 10."
    : stage === 3 ? `The map: the trail lit in gold from your pin to a glowing camp, your Next Step${going ? `, which could take you to ${going}` : ""}. The X, your 10, beyond.`
    : stage === 4 ? "The map: the trail from your pin to your camp crosses rough ground, marked with jagged rocks."
    : "The map: your route drawn in gold from your pin, through your moves, to your camp.";
  const named = moves.filter((m) => m.body.trim()).slice(0, 2);
  return (
    <svg className="ns-map" viewBox="0 0 480 560" role="img" aria-label={label}>
      <rect width="480" height="560" rx="18" fill="#111622" />
      <Contours />
      <path d={TRAIL} fill="none" stroke={stage === 1 ? "#2B3344" : LINE} strokeWidth="3" strokeDasharray="3 9" strokeLinecap="round" />

      {stage === 1 ? (
        <>
          <rect x="0" y="0" width="480" height="300" fill="#111622" opacity=".55" />
          <FaintX label="Your 10, still in the mist" />
          <circle cx="80" cy="480" r="38" fill={GOLD} fillOpacity=".10" />
          <circle cx="80" cy="480" r="22" fill={GOLD} fillOpacity=".18" />
          <path d="M80 486 s-17-15-17-27 a17 17 0 0 1 34 0 c0 12-17 27-17 27z" fill={GOLD} />
          <circle cx="80" cy="459" r="6.5" fill="#100F18" />
          <text x="112" y="474" className="ns-map-h" fill={INK}>You are here</text>
          <text x="112" y="494" className="ns-map-t" fill={INK2}>{cut(area, 26)}{start ? ` · ${start}` : ""}</text>
        </>
      ) : null}

      {stage === 2 ? (
        <>
          <path d="M80 486 s-12-11-12-19 a12 12 0 0 1 24 0 c0 8-12 19-12 19z" fill="none" stroke={GOLD} strokeWidth="2" />
          <text x="100" y="490" className="ns-map-t" fill={INK2}>You{start ? ` · ${start}` : ""}</text>
          <circle cx="360" cy="130" r="54" fill={GOLD} fillOpacity=".08" />
          <circle cx="360" cy="130" r="32" fill={GOLD} fillOpacity=".14" />
          <path d="M346 116 L374 144 M374 116 L346 144" stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
          <text x="360" y="190" textAnchor="middle" className="ns-map-h" fill={INK}>Your 10</text>
          <text x="360" y="210" textAnchor="middle" className="ns-map-t" fill={INK2}>The destination</text>
        </>
      ) : null}

      {stage === 3 ? (
        <>
          <path d={TO_CAMP} fill="none" stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
          <Pin />
          <text x="100" y="490" className="ns-map-t" fill={INK2}>You{start ? ` · ${start}` : ""}</text>
          <Camp glow />
          <text x="300" y="372" className="ns-map-h" fill={INK}>Your Next Step</text>
          {going ? <text x="300" y="392" className="ns-map-t" fill={GOLD2}>Could take you to {going}</text> : null}
          <FaintX />
        </>
      ) : null}

      {stage === 4 ? (
        <>
          <path d={TO_CAMP} fill="none" stroke={GOLD} strokeWidth="3" strokeOpacity=".55" strokeDasharray="10 6" strokeLinecap="round" />
          <Pin />
          <circle cx="190" cy="402" r="40" fill={RED} fillOpacity=".08" />
          <path d="M158 418 l12-18 9 11 8-14 10 13 9-9 12 17z" fill="#2B3344" stroke={RED} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M222 372 l9-13 7 8 6-10 8 10 7-7 9 12z" fill="#2B3344" stroke={RED} strokeWidth="1.4" strokeLinejoin="round" />
          <text x="40" y="380" className="ns-map-h" fill={INK}>Rough ground</text>
          <text x="40" y="400" className="ns-map-t" fill={INK2}>What could stop you</text>
          <Camp glow={false} />
          <text x="300" y="336" className="ns-map-t" fill={GOLD2}>Your Next Step</text>
          <FaintX />
        </>
      ) : null}

      {stage === 5 ? (
        <>
          <path d={TO_CAMP} fill="none" stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
          <Pin />
          {[{ x: 152, y: 438, lx: 172, ly: 462 }, { x: 226, y: 370, lx: 40, ly: 360 }].map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="13" fill={GOLD} />
              <text x={p.x} y={p.y + 5} textAnchor="middle" className="ns-map-n" fill="#100F18">{i + 1}</text>
              {named[i] ? <text x={p.lx} y={p.ly} className="ns-map-t" fill={INK2}>{cut(named[i].body, 24)}</text> : null}
            </g>
          ))}
          <circle cx="270" cy="322" r="34" fill={GOLD} fillOpacity=".16" />
          <Camp glow={false} />
          <text x="300" y="336" className="ns-map-h" fill={INK}>Arrived</text>
          <FaintX />
        </>
      ) : null}
    </svg>
  );
}

// The whole map, wide: the set page (`variant="set"`) and each Next Step
// card (`variant="card"`, smaller and simpler).
export function NsTrail({ start, aim, moves = 0, variant }: { start: number | null; aim: number | null; moves?: number; variant: "set" | "card" }) {
  const going = start && aim && aim > start ? aim : null;
  const label = `Your map: ${start ? `you're at ${start}` : "where you are"}, your Next Step${going ? ` could take you to ${going}` : " ahead"}, and the X, your 10, beyond.`;
  if (variant === "card") {
    return (
      <svg className="ns-trail ns-trail-card" viewBox="0 0 640 150" role="img" aria-label={label}>
        <path d="M30 118 C 140 118, 170 86, 250 82 S 380 60, 420 50 S 560 22, 606 18" fill="none" stroke={LINE} strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round" />
        <path d="M30 118 C 140 118, 170 86, 250 82 S 380 60, 420 50" fill="none" stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
        <circle cx="30" cy="118" r="11" fill={INK} />
        {start ? <text x="30" y="122.5" textAnchor="middle" className="ns-map-n" fill="#100F18">{start}</text> : null}
        <text x="50" y="104" className="ns-map-t" fill={INK}>You are here</text>
        <circle cx="420" cy="50" r="15" fill={GOLD} />
        {going ? <text x="420" y="55" textAnchor="middle" className="ns-map-n" fill="#100F18">{going}</text> : null}
        <text x="420" y="88" textAnchor="middle" className="ns-map-t" fill={GOLD}>Your Next Step</text>
        <path d="M598 12 L614 28 M614 12 L598 28" stroke={INK3} strokeWidth="2.5" strokeLinecap="round" />
        <text x="606" y="50" textAnchor="middle" className="ns-map-t" fill={INK3}>Your 10</text>
      </svg>
    );
  }
  const dots = [{ x: 300, y: 316 }, { x: 470, y: 272 }, { x: 545, y: 250 }].slice(0, Math.min(3, moves));
  return (
    <svg className="ns-trail ns-trail-set" viewBox="0 0 1136 420" role="img" aria-label={label}>
      <rect width="1136" height="420" rx="22" fill="#111622" />
      <g fill="none" stroke={GOLD} strokeOpacity=".08">
        <ellipse cx="960" cy="110" rx="70" ry="40" />
        <ellipse cx="960" cy="115" rx="150" ry="85" />
        <ellipse cx="950" cy="125" rx="250" ry="135" />
        <ellipse cx="930" cy="140" rx="370" ry="195" />
        <ellipse cx="900" cy="160" rx="520" ry="260" />
        <ellipse cx="860" cy="180" rx="700" ry="330" />
      </g>
      <path d="M110 350 C 250 345 300 300 380 290 S 540 250 620 230 S 820 150 880 130 S 940 104 960 96" fill="none" stroke={LINE} strokeWidth="3" strokeDasharray="3 10" strokeLinecap="round" />
      <path d="M110 350 C 250 345 300 300 380 290 S 540 250 620 230" fill="none" stroke={GOLD} strokeWidth="5" strokeLinecap="round" />
      <path d="M110 358 s-15-14-15-24 a15 15 0 0 1 30 0 c0 10-15 24-15 24z" fill={INK} />
      <circle cx="110" cy="334" r="5.5" fill="#100F18" />
      <text x="110" y="392" textAnchor="middle" className="ns-map-h" fill={INK}>You were here{start ? ` · ${start}` : ""}</text>
      {dots.map((d, i) => (
        <g key={i}>
          <circle cx={d.x} cy={d.y} r="12" fill={GOLD} />
          <text x={d.x} y={d.y + 4.5} textAnchor="middle" className="ns-map-n" fill="#100F18">{i + 1}</text>
        </g>
      ))}
      <circle cx="620" cy="220" r="80" fill={GOLD} fillOpacity=".07" />
      <circle cx="620" cy="220" r="46" fill={GOLD} fillOpacity=".16" />
      <path d="M590 248 L620 190 L650 248 Z" fill={GOLD} />
      <path d="M620 220 L611 248 H629 Z" fill="#100F18" />
      <text x="620" y="290" textAnchor="middle" className="ns-map-h" fill={INK}>Your Next Step{going ? ` · ${going}` : ""}</text>
      <path d="M946 82 L974 110 M974 82 L946 110" stroke={GOLD} strokeOpacity=".8" strokeWidth="3.5" strokeLinecap="round" />
      <text x="960" y="140" textAnchor="middle" className="ns-map-t" fill={INK2}>Your 10</text>
    </svg>
  );
}

// The three sorties of Kestrel Isles, their objectives and their scoring. A
// mission is a start line, a set of rings or a destination strip, a wind, and a
// way of adding up the day. Ring passes are judged geometrically: the plane
// must cross the ring's plane, travelling its way, inside its radius.
import { RUNWAYS } from './config.js';
import { rollingNoise } from './random.js';
import { aimPoint } from './terrain.js';

function ring(x, z, y, heading, radius = 26) {
  const rad = (heading * Math.PI) / 180;
  return { x, z, y, heading, radius, nx: Math.sin(rad), nz: -Math.cos(rad), done: false };
}

export const MISSIONS = [
  {
    id: 'ringrun',
    name: 'Kestrel Ring Run',
    tagline: 'Seven gates over the bay, then bring her home.',
    briefing: [
      'Take off from Kestrel Field and fly the seven golden rings in order.',
      'Each ring is worth 120. Land back at Kestrel Field to bank the day.',
    ],
    startRunway: 0,
    startHeading: 0,
    wind: { x: 1.5, z: 0.5, gust: 0.6 },
    rings: [
      ring(140, -430, 108, 12),
      ring(640, -900, 132, 55),
      ring(1205, -560, 104, 118),
      ring(1080, 185, 92, 172),
      ring(430, 645, 116, 208),
      ring(-335, 335, 100, 252),
      ring(-165, -330, 122, 322),
    ],
    homeRunway: 0,
  },
  {
    id: 'islandhop',
    name: 'Gull Rock Mail Run',
    tagline: 'One bag of mail, one far island, one short strip.',
    briefing: [
      'Carry the mail from Kestrel Field to Gull Rock Strip, 2.9 km north-west.',
      'Land there — gently. Score rides on the touchdown and the fuel left.',
    ],
    startRunway: 0,
    startHeading: 0,
    wind: { x: 2.5, z: 1, gust: 0.8 },
    rings: [],
    homeRunway: 1,
  },
  {
    id: 'stormsurvey',
    name: 'Storm Survey',
    tagline: 'Five wide gates in a gusting crosswind.',
    briefing: [
      'A front is coming in. Fly the five survey gates west of the bay,',
      'mind the crosswind, and land back at Kestrel Field before it arrives.',
    ],
    startRunway: 0,
    startHeading: 0,
    wind: { x: -7, z: 3, gust: 4.5 },
    rings: [
      ring(-480, -720, 128, 305, 42),
      ring(-1240, -1420, 118, 318, 42),
      ring(-1980, -1420, 108, 55, 42),
      ring(-1150, -520, 138, 130, 42),
      ring(-330, -190, 118, 165, 42),
    ],
    homeRunway: 0,
  },
];

const LANDING_POINTS = { greased: 300, firm: 180, hard: 60, rough: 40, belly: 20, forced: 0, wreck: 0, ditched: 0, terrain: 0 };

/** Live state for one attempt at a mission. */
export function createMissionState(mission) {
  return {
    mission,
    rings: mission.rings.map((r) => ({ ...r })),
    ringIndex: 0,
    ringsPassed: 0,
    prevAlong: null,
    elapsed: 0,
    finished: false,
    flash: '',
    flashTime: 0,
  };
}

/** Where the plane starts: parked at the near threshold of the start strip. */
export function startPosition(mission) {
  const runway = RUNWAYS[mission.startRunway];
  const rad = (mission.startHeading * Math.PI) / 180;
  const along = -runway.length / 2 + 46;
  return {
    x: runway.x + Math.sin(rad) * along,
    z: runway.z - Math.cos(rad) * along,
    heading: mission.startHeading,
  };
}

/** The wind this second: the mission's steady wind plus wandering gusts. */
export function missionWind(state, time) {
  const { wind } = state.mission;
  const gx = (rollingNoise(time * 0.11, 3.1, 77) - 0.5) * 2 * wind.gust;
  const gz = (rollingNoise(8.4, time * 0.09, 91) - 0.5) * 2 * wind.gust;
  return { x: wind.x + gx, z: wind.z + gz };
}

function checkRingPass(state, plane) {
  const target = state.rings[state.ringIndex];
  if (!target) return;
  const relX = plane.x - target.x;
  const relY = plane.y - target.y;
  const relZ = plane.z - target.z;
  const along = relX * target.nx + relZ * target.nz;
  if (state.prevAlong !== null && state.prevAlong > 0 && along <= 0) {
    const radial = Math.sqrt(Math.max(0, relX * relX + relY * relY + relZ * relZ - along * along));
    if (radial <= target.radius) {
      target.done = true;
      state.ringsPassed += 1;
      state.ringIndex += 1;
      state.prevAlong = null;
      state.flash = state.ringIndex >= state.rings.length ? 'ALL GATES — HEAD HOME' : `GATE ${state.ringsPassed} CLEAR`;
      state.flashTime = 2.2;
      return;
    }
    state.flash = 'MISSED THE GATE — COME AROUND';
    state.flashTime = 1.6;
  }
  state.prevAlong = along;
}

/** Advance objectives; returns true when a gate has just been cleared. */
export function updateMission(state, plane, dt) {
  state.elapsed += dt;
  if (state.flashTime > 0) state.flashTime -= dt;
  const before = state.ringsPassed;
  if (!plane.onGround) checkRingPass(state, plane);
  return state.ringsPassed > before;
}

/** What the HUD should point at now: the next ring, or the home strip's aim point. */
export function currentObjective(state, plane) {
  const target = state.rings[state.ringIndex];
  if (target) {
    return {
      label: `GATE ${state.ringIndex + 1} OF ${state.rings.length}`,
      x: target.x, y: target.y, z: target.z,
      distance: Math.hypot(plane.x - target.x, plane.z - target.z),
    };
  }
  const runway = RUNWAYS[state.mission.homeRunway];
  const aim = aimPoint(runway, runway.heading);
  return {
    label: `LAND — ${runway.name.toUpperCase()}`,
    x: aim.x, y: aim.y, z: aim.z,
    distance: Math.hypot(plane.x - aim.x, plane.z - aim.z),
  };
}

/** The debrief: lines of score that add up to the day's total. */
export function scoreMission(state, plane) {
  const outcome = plane.outcome;
  const lines = [];
  let total = 0;
  if (state.rings.length > 0) {
    const ringPoints = state.ringsPassed * 120;
    lines.push([`Gates cleared (${state.ringsPassed}/${state.rings.length})`, ringPoints]);
    total += ringPoints;
  }
  if (outcome) {
    const landingPoints = LANDING_POINTS[outcome.quality] ?? 0;
    lines.push([`Touchdown — ${outcome.quality}`, outcome.kind === 'landed' ? landingPoints : 0]);
    total += outcome.kind === 'landed' ? landingPoints : 0;
    if (outcome.kind === 'landed') {
      const fuelPoints = Math.round(plane.fuel * 2);
      lines.push(['Fuel in the tanks', fuelPoints]);
      total += fuelPoints;
      const timeBonus = Math.max(0, 420 - Math.round(state.elapsed * 0.9));
      lines.push(['Time bonus', timeBonus]);
      total += timeBonus;
    }
  }
  return { lines, total };
}

/** One letter for the debrief board. */
export function scoreGrade(total) {
  if (total >= 1250) return 'S';
  if (total >= 950) return 'A';
  if (total >= 650) return 'B';
  if (total >= 350) return 'C';
  return 'D';
}

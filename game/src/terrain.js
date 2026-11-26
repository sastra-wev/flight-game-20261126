// The archipelago itself: an analytic heightfield (no stored grid, so any point
// can be asked its height), the two graded runway strips cut flat into it, and
// the landmarks a pilot navigates by. Everything here is a pure function of
// position, which keeps the renderer, the flight model and the landing checks
// in perfect agreement about where the ground is.
import { ISLANDS, RUNWAYS, SEA_LEVEL } from './config.js';
import { rollingNoise } from './random.js';

const WORLD_SEED = 1907;

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothstep(t) {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/** One island's contribution: a smooth dome that reaches the sea at its radius. */
function islandHeight(island, x, z) {
  const dx = x - island.x;
  const dz = z - island.z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  const t = clamp01(1 - distance / island.radius);
  if (t <= 0) return 0;
  const dome = Math.pow(smoothstep(t), 1.35);
  const ridge = rollingNoise(x * 0.0016, z * 0.0016, WORLD_SEED) - 0.5;
  const detail = rollingNoise(x * 0.011, z * 0.011, WORLD_SEED + 3) - 0.5;
  return island.peak * dome + ridge * 26 * dome + detail * 5 * dome;
}

/** Position in a runway's own frame: `along` down its axis from its centre, `across` sideways. */
export function runwayLocal(runway, x, z) {
  const rad = (runway.heading * Math.PI) / 180;
  const dx = x - runway.x;
  const dz = z - runway.z;
  return {
    along: dx * Math.sin(rad) - dz * Math.cos(rad),
    across: dx * Math.cos(rad) + dz * Math.sin(rad),
  };
}

/** How strongly the grading to a runway's elevation applies at a point: 1 across the whole strip and its apron, easing off over a wide skirt so the field sits in a shallow bowl rather than against a wall. */
function gradingWeight(runway, x, z) {
  const { along, across } = runwayLocal(runway, x, z);
  const coreLength = runway.length / 2 + 60;
  const coreWidth = runway.width / 2 + 45;
  const edge = Math.max(Math.abs(along) / coreLength, Math.abs(across) / coreWidth);
  if (edge <= 1) return 1;
  return 1 - smoothstep((edge - 1) / 4);
}

/** The raw land height before any runway grading: domes and noise only. */
export function landHeight(x, z) {
  let height = 0;
  for (const island of ISLANDS) height += islandHeight(island, x, z);
  return height;
}

/** Ground height in metres at any point: land height with both strips graded flat. */
export function terrainHeight(x, z) {
  let height = landHeight(x, z);
  for (const runway of RUNWAYS) {
    const weight = gradingWeight(runway, x, z);
    if (weight > 0) height = height * (1 - weight) + runway.elevation * weight;
  }
  return height;
}

/** The runway a point stands on, or null: on the paved rectangle itself. */
export function runwayAt(x, z) {
  for (const runway of RUNWAYS) {
    const { along, across } = runwayLocal(runway, x, z);
    if (Math.abs(along) <= runway.length / 2 && Math.abs(across) <= runway.width / 2) return runway;
  }
  return null;
}

/** Whether a point is over open water (land fully below the surface). */
export function isWater(x, z) {
  return terrainHeight(x, z) <= SEA_LEVEL + 0.05;
}

/** The strip's touchdown aim point: a quarter of its length in from the near threshold. */
export function aimPoint(runway, approachHeading) {
  const rad = (approachHeading * Math.PI) / 180;
  const along = -runway.length / 4;
  return {
    x: runway.x + Math.sin(rad) * along,
    z: runway.z - Math.cos(rad) * along,
    y: runway.elevation,
  };
}

/** Buildings and marks that make the fields recognisable from the air. */
export const LANDMARKS = [
  { kind: 'hangar', x: 52, z: 300, heading: 90, width: 34, depth: 24, height: 9, colour: '#b8bcc2' },
  { kind: 'hangar', x: 58, z: 356, heading: 90, width: 26, depth: 20, height: 7, colour: '#9aa5ad' },
  { kind: 'tower', x: -48, z: 330, heading: 0, width: 9, depth: 9, height: 21, colour: '#d8d3c3' },
  { kind: 'hangar', x: -1568, z: -1836, heading: 0, width: 28, depth: 20, height: 8, colour: '#aeb6ba' },
  { kind: 'lighthouse', x: -2040, z: -2260, heading: 0, width: 10, depth: 10, height: 30, colour: '#e8e2d2' },
  { kind: 'beacon', x: 1420, z: -620, heading: 0, width: 6, depth: 6, height: 16, colour: '#c94f43' },
];

/** Harbour buoys bobbing in the bay north of Kestrel Field. */
export const BUOYS = [
  { x: 260, z: -320 },
  { x: -310, z: -560 },
  { x: 540, z: -140 },
  { x: -80, z: -980 },
];

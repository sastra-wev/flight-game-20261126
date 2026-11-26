// Kestrel Isles: every tuning number, colour and world landmark in one place.
// Units are metres, metres per second and degrees unless a name says otherwise.
// The world is a fixed archipelago: x grows east, z grows south, y grows up,
// and a heading of 0 flies north (toward -z), 90 flies east (toward +x).

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second at any display rate. */
export const STEP = 1 / 60;

/** Sea level: terrain below this height is under water. */
export const SEA_LEVEL = 0;

export const PLANE = {
  /** Speeds the flight model works in: stall, cruise and the red line. */
  stallSpeed: 27,
  liftFullSpeed: 36,
  maxSpeed: 84,
  throttleRate: 0.45,
  /** Pitch and bank limits and how fast the stick moves them, radians. */
  maxPitch: 0.46,
  maxBank: 1.05,
  pitchRate: 1.15,
  bankRate: 2.4,
  /** How hard a banked wing turns the nose, and how strongly the nose drops in a stall. */
  turnFactor: 10.5,
  stallDrop: 0.55,
  /** Fuel units on a full tank and the burn per second at idle and at full throttle. */
  tank: 100,
  burnIdle: 0.055,
  burnFull: 0.42,
  /** Sink rates (m/s) that still count as a landing, and the bands above them. */
  sinkGentle: 2.2,
  sinkFirm: 4.2,
  sinkHard: 6.5,
};

export const ISLANDS = [
  { name: 'Kestrel Isle', x: 0, z: 620, radius: 1080, peak: 118 },
  { name: 'Gull Rock', x: -1500, z: -1900, radius: 720, peak: 88 },
  { name: 'Pinnacle', x: 1420, z: -620, radius: 400, peak: 52 },
  { name: 'Low Cay', x: 950, z: 1560, radius: 320, peak: 26 },
  { name: 'West Holm', x: -1250, z: 950, radius: 430, peak: 58 },
];

/** Runway strips: centre, axis heading, length, width and the elevation the ground is graded to. */
export const RUNWAYS = [
  { id: 'A', name: 'Kestrel Field', x: 0, z: 140, heading: 0, length: 720, width: 36, elevation: 12 },
  { id: 'B', name: 'Gull Rock Strip', x: -1500, z: -1900, heading: 90, length: 620, width: 32, elevation: 10 },
];

export const PALETTE = {
  skyTop: '#2e63a8',
  skyMid: '#7db3e0',
  skyLow: '#f6cf9a',
  sunCore: '#fff3c4',
  sunGlow: 'rgba(255, 190, 90, 0.35)',
  seaDeep: '#155e6b',
  seaShallow: '#2b8a94',
  sand: '#e3cf9e',
  grassLow: '#5d9e52',
  grassHigh: '#3e7d46',
  rock: '#8a7f72',
  snow: '#f4f1e6',
  runway: '#3c4148',
  runwayLine: '#f5f2e4',
  panel: '#20242c',
  panelEdge: '#39404d',
  gaugeFace: '#101318',
  gaugeTick: '#cfd6de',
  gaugeText: '#e8edf2',
  needle: '#ffb340',
  warning: '#ff5347',
  okLamp: '#58e08a',
  hudText: '#eaf6ff',
  hudShadow: 'rgba(6, 20, 34, 0.55)',
  ring: '#ffc93c',
  ringNext: '#ffe89a',
  ringDone: '#69d98c',
};

export const FONT = '"Avenir Next", "Segoe UI", system-ui, sans-serif';
export const FONT_MONO = '"SF Mono", "Cascadia Mono", Consolas, monospace';

/** Where the best score per mission is kept between visits (this browser only). */
export const BEST_KEY = 'kestrel-isles.best';

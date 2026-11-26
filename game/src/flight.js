// The Kestrel K-1's flight model: deliberately arcade in its manners (the stick
// centres itself, the wings want to level) but disciplined where it matters —
// speed bleeds in a climb, the wing stalls if you haul back too slow, a banked
// turn needs speed to hold its height, and every touchdown is judged on sink,
// speed and alignment. The model owns the plane's state; missions and the
// renderer only read it.
import { PLANE } from './config.js';
import { runwayAt, terrainHeight } from './terrain.js';

/** How far the airframe sits above the ground it rests or rolls on. */
export const GEAR_CLEARANCE = 2.1;

export const EVENT_NONE = 0;
export const EVENT_LIFTOFF = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASHED = 4;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function headingDelta(a, b) {
  let delta = (a - b) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

/** A plane parked at a runway threshold, engine idling, full tanks, gear down. */
export function createPlane(x, z, heading) {
  const ground = terrainHeight(x, z);
  return {
    x,
    y: ground + GEAR_CLEARANCE,
    z,
    heading,
    pitch: 0,
    bank: 0,
    speed: 0,
    vy: 0,
    throttle: 0,
    gearDown: true,
    onGround: true,
    brakes: false,
    fuel: PLANE.tank,
    hull: 100,
    stalled: false,
    time: 0,
    /** Set when the sortie ends: { kind, quality, reason, sink, speed } for the debrief. */
    outcome: null,
  };
}

function endSortie(state, kind, quality, reason) {
  state.outcome = { kind, quality, reason, sink: state.vy, speed: state.speed };
  return kind === 'crash' ? EVENT_CRASHED : EVENT_LANDED;
}

/** Judge a touchdown the moment the gear meets the ground; fills state.outcome on an ending. */
function judgeTouchdown(state, ground) {
  const runway = runwayAt(state.x, state.z);
  const sink = state.vy;
  if (runway && state.gearDown) {
    const alignment = Math.min(
      Math.abs(headingDelta(state.heading, runway.heading)),
      Math.abs(headingDelta(state.heading, runway.heading + 180)),
    );
    if (sink < -PLANE.sinkHard - 1.5 || state.speed > 68) {
      return endSortie(state, 'crash', 'wreck', `You hit ${runway.name} far too hard — the airframe folded.`);
    }
    if (alignment > 38) {
      state.hull -= 30;
      return endSortie(state, 'landed', 'rough', `Down at ${runway.name}, but slewed across the strip. The gear is bent.`);
    }
    if (sink >= -PLANE.sinkGentle && alignment <= 10 && state.speed <= 46) {
      return endSortie(state, 'landed', 'greased', `Greased it onto ${runway.name}. The tower is applauding.`);
    }
    if (sink >= -PLANE.sinkFirm) {
      return endSortie(state, 'landed', 'firm', `Firm arrival at ${runway.name} — the passengers felt that one.`);
    }
    state.hull -= 32;
    return endSortie(state, 'landed', 'hard', `Hard landing at ${runway.name}. Something underneath is bent.`);
  }
  if (runway && !state.gearDown) {
    state.hull -= 48;
    return endSortie(state, 'landed', 'belly', `Belly landing at ${runway.name} — gear up. Sparks, noise, paperwork.`);
  }
  if (ground <= 0.05) {
    return endSortie(state, 'crash', 'ditched', 'You ditched in the bay. The Kestrel floats — briefly.');
  }
  if (sink >= -3 && state.speed <= 34) {
    state.hull -= 45;
    return endSortie(state, 'landed', 'forced', 'A forced landing in the rough. Walked away; the plane did not.');
  }
  return endSortie(state, 'crash', 'terrain', 'You flew into high ground. The island keeps the wreck.');
}

/**
 * Advance the plane one fixed step. `control` carries pitchAxis and rollAxis in
 * -1..1 (positive pitch hauls the nose up, positive roll banks right), throttle
 * up/down held flags, brakes and the mission wind { x, z }. Returns event bits.
 */
export function stepFlight(state, control, dt) {
  let events = EVENT_NONE;
  state.time += dt;
  const engineAlive = state.fuel > 0;

  if (control.throttleUp && engineAlive) state.throttle = clamp(state.throttle + PLANE.throttleRate * dt, 0, 1);
  if (control.throttleDown) state.throttle = clamp(state.throttle - PLANE.throttleRate * dt, 0, 1);
  if (!engineAlive) state.throttle = 0;
  state.brakes = Boolean(control.brakes);

  if (state.onGround) {
    events |= stepOnGround(state, control, dt);
  } else {
    events |= stepAirborne(state, control, dt);
  }

  if (engineAlive) {
    state.fuel = Math.max(0, state.fuel - (PLANE.burnIdle + (PLANE.burnFull - PLANE.burnIdle) * state.throttle) * dt);
  }
  return events;
}

function stepOnGround(state, control, dt) {
  const ground = terrainHeight(state.x, state.z);
  const onPavement = runwayAt(state.x, state.z) !== null;
  const accel = state.throttle * 13.5 - 0.0016 * state.speed * state.speed - (onPavement ? 0.4 : 2.6);
  state.speed = Math.max(0, state.speed + accel * dt - (state.brakes ? 7.5 * dt : 0));
  if (state.speed > 0.4) {
    state.heading = (state.heading + control.rollAxis * dt * Math.min(14, state.speed * 0.55) + 360) % 360;
  }
  state.bank = control.rollAxis * 0.06;
  state.pitch = 0;

  const rad = (state.heading * Math.PI) / 180;
  state.x += Math.sin(rad) * state.speed * dt;
  state.z += -Math.cos(rad) * state.speed * dt;
  const newGround = terrainHeight(state.x, state.z);

  // Rolling off the end of the world or into the sea at speed ends the day.
  if (newGround <= 0.05 && state.speed > 12) {
    state.y = newGround + GEAR_CLEARANCE;
    return endSortie(state, 'crash', 'ditched', 'You rolled off the strip and into the bay.');
  }
  if (newGround - ground > 2.5 && state.speed > 20) {
    return endSortie(state, 'crash', 'terrain', 'You taxied into rising ground and tore the gear off.');
  }
  state.y = newGround + GEAR_CLEARANCE;
  state.vy = 0;

  // Rotation: enough speed and a hauled-back stick lifts the nose wheel, then the plane.
  if (state.speed >= PLANE.liftFullSpeed - 3 && control.pitchAxis > 0.25) {
    state.onGround = false;
    state.pitch = 0.16;
    state.vy = 1.2;
    return EVENT_LIFTOFF;
  }
  return EVENT_NONE;
}

function stepAirborne(state, control, dt) {
  // Stick: pitch and bank chase the pilot's input, and centre gently without it.
  if (control.pitchAxis !== 0) state.pitch = clamp(state.pitch + control.pitchAxis * PLANE.pitchRate * dt, -PLANE.maxPitch, PLANE.maxPitch);
  else state.pitch += (0.02 - state.pitch) * Math.min(1, dt * 0.7);
  if (control.rollAxis !== 0) state.bank = clamp(state.bank + control.rollAxis * PLANE.bankRate * dt, -PLANE.maxBank, PLANE.maxBank);
  else state.bank += (0 - state.bank) * Math.min(1, dt * 1.6);

  state.stalled = state.speed < PLANE.stallSpeed;
  if (state.stalled) state.pitch = Math.max(-PLANE.maxPitch, state.pitch - PLANE.stallDrop * dt);

  const gearDrag = state.gearDown ? 0.9 : 0;
  const accel = state.throttle * 14 - 0.0022 * state.speed * state.speed - Math.sin(state.pitch) * 8 - gearDrag;
  state.speed = clamp(state.speed + accel * dt, 6, PLANE.maxSpeed + 22);

  const turnRate = (PLANE.turnFactor * Math.tan(state.bank)) / Math.max(state.speed, 18);
  state.heading = (state.heading + (turnRate * 180) / Math.PI * dt + 360) % 360;

  const lift = clamp((state.speed - PLANE.stallSpeed * 0.7) / (PLANE.liftFullSpeed - PLANE.stallSpeed * 0.7), 0, 1);
  let vyTarget = state.speed * Math.sin(state.pitch) * (0.25 + 0.75 * lift);
  if (state.speed < PLANE.stallSpeed) vyTarget -= (PLANE.stallSpeed - state.speed) * 0.38;
  vyTarget -= Math.abs(state.bank) * state.speed * 0.028; // a steep bank spills lift
  state.vy += (vyTarget - state.vy) * Math.min(1, dt * 3.2);

  const rad = (state.heading * Math.PI) / 180;
  const horizontal = state.speed * Math.cos(state.pitch);
  state.x += (Math.sin(rad) * horizontal + (control.wind ? control.wind.x : 0)) * dt;
  state.z += (-Math.cos(rad) * horizontal + (control.wind ? control.wind.z : 0)) * dt;
  state.y += state.vy * dt;

  const ground = terrainHeight(state.x, state.z);
  if (state.y <= ground + GEAR_CLEARANCE) {
    state.y = ground + GEAR_CLEARANCE;
    if (state.vy < -9.5 || state.speed > 74) {
      return endSortie(state, 'crash', 'wreck', ground <= 0.05 ? 'You went into the sea at speed.' : 'You hit the ground far too hard.');
    }
    const events = judgeTouchdown(state, ground);
    if (state.outcome && state.outcome.kind === 'landed') {
      state.onGround = true;
      state.pitch = 0;
      state.bank = 0;
    }
    return events;
  }
  return EVENT_NONE;
}

/** Compass points for the HUD ribbon, and the plane's speed in knots for the gauges. */
export function headingName(heading) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(heading / 45) % 8];
}

export function toKnots(metresPerSecond) {
  return metresPerSecond * 1.944;
}

export function toFeet(metres) {
  return metres * 3.281;
}

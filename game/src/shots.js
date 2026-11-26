// The four screenshot scenes behind ?shot=cover|takeoff|ring|final. Each one
// builds a real plane and mission, then flies the real flight model forward
// on scripted stick inputs for a second or two, so what the camera captures
// is the game exactly as it plays — needles settled, propeller turning, the
// sortie mid-story — and the same scene every time it is taken.
import { createPlane, stepFlight } from './flight.js';
import { MISSIONS, createMissionState, missionWind, startPosition } from './missions.js';

function settle(plane, state, seconds, control) {
  const steps = Math.round(seconds / (1 / 60));
  for (let i = 0; i < steps; i += 1) {
    stepFlight(plane, { ...control, wind: missionWind(state, plane.time) }, 1 / 60);
    state.elapsed += 1 / 60;
  }
}

function airborne(missionIndex, x, y, z, heading, setup) {
  const mission = MISSIONS[missionIndex];
  const state = createMissionState(mission);
  const plane = createPlane(x, z, heading);
  plane.onGround = false;
  plane.y = y;
  Object.assign(plane, setup);
  return { plane, state };
}

/** Stage the named scene and return everything the frame needs. */
export function stageShot(name) {
  if (name === 'takeoff') {
    const mission = MISSIONS[0];
    const state = createMissionState(mission);
    const start = startPosition(mission);
    const plane = createPlane(start.x, start.z, start.heading);
    settle(plane, state, 2.7, { pitchAxis: 0, rollAxis: 0, throttleUp: true, throttleDown: false, brakes: false });
    return { plane, state };
  }
  if (name === 'ring') {
    const { plane, state } = airborne(0, 914, 112, -715, 118, {
      speed: 54, throttle: 0.72, gearDown: false, pitch: 0.02, bank: 0.24, fuel: 74, vy: -0.3,
    });
    state.rings[0].done = true;
    state.rings[1].done = true;
    state.ringsPassed = 2;
    state.ringIndex = 2;
    settle(plane, state, 0.8, { pitchAxis: 0.04, rollAxis: 0.1, throttleUp: false, throttleDown: false, brakes: false });
    return { plane, state };
  }
  if (name === 'final') {
    const { plane, state } = airborne(1, -2010, 54, -1892, 90, {
      speed: 34.5, throttle: 0.34, gearDown: true, pitch: -0.05, bank: 0.02, fuel: 41, vy: -2.1,
    });
    settle(plane, state, 0.7, { pitchAxis: 0.02, rollAxis: 0, throttleUp: false, throttleDown: false, brakes: false });
    return { plane, state };
  }
  // The cover: airborne over the bay, first gate ahead and a little below,
  // the home island falling away behind the wing.
  const { plane, state } = airborne(0, 70, 128, -205, 14, {
    speed: 47, throttle: 0.66, gearDown: false, pitch: 0.03, bank: 0.13, fuel: 88, vy: 0.2,
  });
  settle(plane, state, 1.1, { pitchAxis: 0, rollAxis: -0.04, throttleUp: false, throttleDown: false, brakes: false });
  return { plane, state };
}

// Boot and the one loop. Kestrel Isles moves between four screens — title,
// briefing, flight and debrief — over a fixed-step simulation: input is read
// every frame, the flight model advances in 1/60 s steps, and the renderer
// and cockpit paint what is there. ?shot=cover|takeoff|ring|final stages a
// screenshot scene instead of running the loop.
import { BEST_KEY, STEP } from './config.js';
import { createPlane, stepFlight, EVENT_LANDED, EVENT_CRASHED } from './flight.js';
import { ACTION_CONFIRM, ACTION_GEAR, ACTION_MUTE, ACTION_ONE, ACTION_PAUSE, ACTION_THREE, ACTION_TWO, createInput } from './input.js';
import { MISSIONS, createMissionState, currentObjective, missionWind, scoreMission, startPosition, updateMission } from './missions.js';
import { createRenderer } from './render.js';
import { createCockpit } from './cockpit.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const cockpit = createCockpit();
const audio = createAudio();

function readBests() {
  try {
    return JSON.parse(window.localStorage.getItem(BEST_KEY) ?? '{}') || {};
  } catch {
    return {};
  }
}

function saveBest(id, value) {
  try {
    const bests = readBests();
    bests[id] = value;
    window.localStorage.setItem(BEST_KEY, JSON.stringify(bests));
  } catch {
    // Storage can be off: bests then last this visit only.
  }
}

function runShot(name) {
  const { plane, state } = stageShot(name);
  const objective = currentObjective(state, plane);
  let painted = 0;
  function paint() {
    renderer.draw({ plane, time: plane.time + 8, rings: state.rings, nextRing: state.ringIndex, shake: 0 });
    cockpit.draw(canvas.getContext('2d'), {
      screen: 'play', plane, dt: 1 / 30, objective,
      flash: '', flashTime: 0,
    });
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const ctx = canvas.getContext('2d');
  let screen = 'title';
  let selected = 0;
  let bests = readBests();
  let plane = null;
  let missionState = null;
  let score = null;
  let isBest = false;
  let endTimer = 0;
  let stallBeep = 0;
  let accumulator = 0;
  let last = performance.now();
  let elapsed = 0;

  function announce(message) {
    status.textContent = message;
  }

  function beginBrief(missionIndex) {
    const mission = MISSIONS[missionIndex];
    missionState = createMissionState(mission);
    const start = startPosition(mission);
    plane = createPlane(start.x, start.z, start.heading);
    score = null;
    isBest = false;
    screen = 'brief';
    announce(`Briefing: ${mission.name}.`);
  }

  function beginFlight() {
    screen = 'play';
    announce('Rolling. Hold W for throttle, pull with the down arrow to climb.');
  }

  function finishSortie() {
    score = scoreMission(missionState, plane);
    const id = missionState.mission.id;
    isBest = score.total > (bests[id] ?? 0);
    if (isBest) {
      saveBest(id, score.total);
      bests = readBests();
    }
    screen = 'over';
    if (plane.outcome.kind === 'landed') audio.fanfare();
    announce(`Sortie over. ${plane.outcome.reason} Score ${score.total}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions) audio.wake();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (screen === 'title') {
      if (actions & ACTION_ONE) beginBrief(0);
      else if (actions & ACTION_TWO) beginBrief(1);
      else if (actions & ACTION_THREE) beginBrief(2);
      else if (actions & ACTION_CONFIRM) beginBrief(selected);
      return;
    }
    if (screen === 'brief') {
      if (actions & ACTION_CONFIRM) beginFlight();
      else if (actions & ACTION_PAUSE) screen = 'title';
      return;
    }
    if (screen === 'play') {
      if (actions & ACTION_PAUSE) {
        screen = 'paused';
        announce('Paused.');
      } else if (actions & ACTION_GEAR && plane && !plane.outcome) {
        if (plane.speed < 76) plane.gearDown = !plane.gearDown;
      }
      return;
    }
    if (screen === 'paused') {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) screen = 'play';
      return;
    }
    if (screen === 'over') {
      if (actions & ACTION_CONFIRM) beginBrief(MISSIONS.indexOf(missionState.mission));
      else if (actions & ACTION_PAUSE) screen = 'title';
    }
  }

  function step() {
    const now = elapsed;
    const control = input.control(now);
    control.wind = missionWind(missionState, plane.time);
    const notches = input.takeWheel();
    if (notches) plane.throttle = Math.min(1, Math.max(0, plane.throttle + notches * 0.07));
    const events = stepFlight(plane, control, STEP);
    if (updateMission(missionState, plane, STEP)) audio.gateChime();
    if (plane.stalled && !plane.onGround) {
      stallBeep -= STEP;
      if (stallBeep <= 0) {
        audio.stallWarning();
        stallBeep = 0.75;
      }
    }
    if ((events & EVENT_LANDED) && plane.outcome) {
      audio.touchdown(plane.outcome.quality);
      endTimer = 0.8;
    }
    if ((events & EVENT_CRASHED) && plane.outcome) {
      audio.crash();
      endTimer = 1.1;
    }
  }

  function shakeAmount() {
    if (!plane || plane.onGround || screen !== 'play') return 0;
    const gust = missionState.mission.wind.gust;
    return gust * 0.55 * Math.min(1, plane.speed / 50);
  }

  function frame(nowMs) {
    requestAnimationFrame(frame);
    const dt = Math.min((nowMs - last) / 1000, MAX_FRAME);
    last = nowMs;
    elapsed += dt;
    handleActions();
    if (screen === 'play' && plane && !plane.outcome) {
      accumulator += dt;
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== 'play' || plane.outcome) {
          accumulator = 0;
          break;
        }
      }
    } else if (screen === 'play' && plane && plane.outcome && endTimer > 0) {
      endTimer -= dt;
      if (endTimer <= 0) finishSortie();
    } else {
      accumulator = 0;
    }

    if (screen === 'title') {
      renderer.draw({ plane: null, time: elapsed, rings: null, nextRing: -1, shake: 0 });
      cockpit.draw(ctx, { screen: 'title', selected, bests, dt });
    } else {
      const objective = screen === 'play' || screen === 'paused' ? currentObjective(missionState, plane) : null;
      renderer.draw({
        plane,
        time: elapsed,
        rings: missionState.rings.length ? missionState.rings : null,
        nextRing: missionState.ringIndex,
        shake: shakeAmount(),
      });
      audio.update(plane, screen === 'play');
      cockpit.draw(ctx, {
        screen,
        plane,
        missionState,
        objective,
        dt,
        flash: missionState.flash,
        flashTime: missionState.flashTime,
        score,
        isBest,
        best: bests[missionState.mission.id] ?? 0,
      });
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') screen = 'paused';
  });

  announce('Kestrel Isles. Pick a sortie with 1, 2 or 3.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

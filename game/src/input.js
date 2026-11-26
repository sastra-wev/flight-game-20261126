// Keyboard and mouse, read as one honest control state. The stick is the arrow
// keys (or A and D to bank), the throttle is W and S, and the mouse is a second
// stick: hold it over the canvas and the nose follows where you point, with the
// wheel working the throttle. One-shot actions (confirm, pause, gear, mute,
// mission picks) are queued as bits and taken once by the game loop.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_GEAR = 4;
export const ACTION_MUTE = 8;
export const ACTION_ONE = 16;
export const ACTION_TWO = 32;
export const ACTION_THREE = 64;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyG: ACTION_GEAR,
  KeyM: ACTION_MUTE,
  Digit1: ACTION_ONE,
  Digit2: ACTION_TWO,
  Digit3: ACTION_THREE,
};

const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF', 'KeyB', 'KeyG', 'KeyP', 'KeyM',
]);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let wheelNotches = 0;
  const mouse = { x: 0, y: 0, inside: false, lastMove: -10, down: false };

  window.addEventListener('keydown', (event) => {
    if (GAME_KEYS.has(event.code) || event.code === 'Space') event.preventDefault();
    if (!event.repeat && KEY_ACTIONS[event.code]) actions |= KEY_ACTIONS[event.code];
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) / rect.width;
    mouse.y = (event.clientY - rect.top) / rect.height;
    mouse.inside = true;
    mouse.lastMove = performance.now() / 1000;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.down = true;
    if (event.button === 0) actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('pointerleave', () => {
    mouse.inside = false;
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    wheelNotches += event.deltaY < 0 ? 1 : -1;
  }, { passive: false });

  function keyPitch() {
    let axis = 0;
    if (held.has('ArrowDown')) axis += 1; // pull back: nose up
    if (held.has('ArrowUp')) axis -= 1;
    return axis;
  }

  function keyRoll() {
    let axis = 0;
    if (held.has('ArrowRight') || held.has('KeyD')) axis += 1;
    if (held.has('ArrowLeft') || held.has('KeyA')) axis -= 1;
    return axis;
  }

  /** The mouse counts as a stick for four seconds after it last moved. */
  function mouseAxes(now) {
    if (!mouse.inside || now - mouse.lastMove > 4) return { pitchAxis: 0, rollAxis: 0 };
    const dx = (mouse.x - 0.5) * 2;
    const dy = (mouse.y - 0.5) * 2;
    const dead = 0.09;
    return {
      pitchAxis: Math.abs(dy) < dead ? 0 : -dy * 1.15,
      rollAxis: Math.abs(dx) < dead ? 0 : dx * 1.25,
    };
  }

  return {
    /** Continuous control for one step: keyboard wins where it speaks, else the mouse. */
    control(now) {
      const fromMouse = mouseAxes(now);
      const pitch = keyPitch();
      const roll = keyRoll();
      return {
        pitchAxis: pitch !== 0 ? pitch : fromMouse.pitchAxis,
        rollAxis: roll !== 0 ? roll : fromMouse.rollAxis,
        throttleUp: held.has('KeyW') || held.has('KeyR'),
        throttleDown: held.has('KeyS') || held.has('KeyF'),
        brakes: held.has('KeyB'),
        mouseActive: fromMouse.pitchAxis !== 0 || fromMouse.rollAxis !== 0,
      };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeWheel() {
      const taken = wheelNotches;
      wheelNotches = 0;
      return taken;
    },
  };
}

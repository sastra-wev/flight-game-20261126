// The world painter: a hand-rolled perspective renderer on a 2D canvas. The
// sky is a gradient with a low sun, the sea and islands are a polar grid of
// the terrain heightfield drawn far to near with haze, and everything else —
// runways, rings, hangars, buoys, clouds — is projected through the same
// camera, so the whole scene agrees about where things are. The chase camera
// rides behind the Kestrel and rolls most of the way with it, which is what
// tips the horizon in a bank.
import { PALETTE, RUNWAYS, VIEW } from './config.js';
import { createRandom, rollingNoise } from './random.js';
import { BUOYS, LANDMARKS, runwayLocal, terrainHeight } from './terrain.js';

const FOCAL = 640;
const SLICES = 46;
const COLUMNS = 37;
const MAX_VIEW = 3000;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function toRgb(colour) {
  if (Array.isArray(colour)) return colour;
  if (colour.charAt(0) === '#') {
    return [parseInt(colour.slice(1, 3), 16), parseInt(colour.slice(3, 5), 16), parseInt(colour.slice(5, 7), 16)];
  }
  const parts = colour.match(/[\d.]+/g);
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

function mixColour(a, b, t) {
  const pa = toRgb(a);
  const pb = toRgb(b);
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`;
}

/** Ground colour for a height and a slope: sea, sand, grass, rock, snow. */
function groundColour(height, slope, x, z, time) {
  if (height <= 0.25) {
    // Open water: a deep base breathing toward the shallows, with a broken
    // glitter where the low sun catches it — never a hard switch per quad.
    const swell = rollingNoise(x * 0.004, z * 0.004, 55);
    let colour = mixColour(PALETTE.seaDeep, PALETTE.seaShallow, swell * 0.55);
    const glitter = rollingNoise(x * 0.03 + time * 0.22, z * 0.03, 91);
    if (glitter > 0.62) colour = mixColour(colour, '#cfeef0', (glitter - 0.62) * 0.9);
    return colour;
  }
  let base;
  if (height < 2.6) base = PALETTE.sand;
  else if (height < 34) base = mixColour(PALETTE.grassLow, PALETTE.grassHigh, height / 34);
  else if (height < 72) base = mixColour(PALETTE.grassHigh, PALETTE.rock, (height - 34) / 38);
  else base = mixColour(PALETTE.rock, PALETTE.snow, clamp((height - 72) / 40, 0, 1));
  const shade = clamp(1 - slope * 0.34, 0.78, 1.04);
  const variation = 0.96 + rollingNoise(x * 0.02, z * 0.02, 31) * 0.08;
  return mixColour('#101418', base, shade * variation);
}

function makeCloudSprite() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const blobs = [[128, 74, 62], [84, 82, 44], [172, 82, 48], [110, 60, 40], [150, 58, 42], [64, 88, 30], [196, 88, 32]];
  for (const [x, y, r] of blobs) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,252,246,0.55)');
    grad.addColorStop(0.7, 'rgba(250,244,232,0.28)');
    grad.addColorStop(1, 'rgba(250,244,232,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function makePlaneSprite(gearDown) {
  // The Kestrel seen from astern and slightly above, as the chase camera sees
  // her: the propeller disc and cowling farthest at the top, the canopy and
  // wings amidships, and the tail cone, fin and stabiliser nearest at the
  // bottom of the frame.
  const c = document.createElement('canvas');
  c.width = 520;
  c.height = 340;
  const g = c.getContext('2d');
  const cx = 260;

  // Propeller disc at the nose: a flat, shimmering ellipse.
  g.fillStyle = 'rgba(40, 42, 46, 0.28)';
  g.beginPath();
  g.ellipse(cx, 88, 82, 11, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3a3f45';
  g.beginPath();
  g.ellipse(cx, 90, 10, 7, 0, 0, Math.PI * 2);
  g.fill();

  // Wings amidships: a long bar with dihedral, tips rising, drawn before the
  // fuselage so the body overlaps the root.
  g.fillStyle = '#e8e2d2';
  g.beginPath();
  g.moveTo(cx - 250, 186);
  g.quadraticCurveTo(cx - 130, 168, cx - 30, 178);
  g.lineTo(cx + 30, 178);
  g.quadraticCurveTo(cx + 130, 168, cx + 250, 186);
  g.lineTo(cx + 244, 200);
  g.quadraticCurveTo(cx + 120, 186, cx, 194);
  g.quadraticCurveTo(cx - 120, 186, cx - 244, 200);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(90, 88, 78, 0.5)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 238, 190);
  g.quadraticCurveTo(cx, 182, cx + 238, 190);
  g.stroke();
  g.fillStyle = '#1d7a8c';
  g.fillRect(cx - 250, 184, 500, 5);
  g.fillStyle = '#ff4d4d';
  g.beginPath(); g.arc(cx - 246, 188, 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#43e07a';
  g.beginPath(); g.arc(cx + 246, 188, 5, 0, Math.PI * 2); g.fill();

  // Fuselage: broad at the shoulders, tapering away to the tail cone.
  const bodyGrad = g.createLinearGradient(cx - 62, 0, cx + 62, 0);
  bodyGrad.addColorStop(0, '#b3ac97');
  bodyGrad.addColorStop(0.28, '#f4efe0');
  bodyGrad.addColorStop(0.72, '#efe9d8');
  bodyGrad.addColorStop(1, '#a39c86');
  g.fillStyle = bodyGrad;
  g.beginPath();
  g.moveTo(cx - 52, 96);
  g.quadraticCurveTo(cx - 64, 170, cx - 52, 232);
  g.quadraticCurveTo(cx - 40, 282, cx - 13, 302);
  g.quadraticCurveTo(cx, 308, cx + 13, 302);
  g.quadraticCurveTo(cx + 40, 282, cx + 52, 232);
  g.quadraticCurveTo(cx + 64, 170, cx + 52, 96);
  g.quadraticCurveTo(cx, 82, cx - 52, 96);
  g.fill();
  // Cheatline sweeping the shoulders.
  g.fillStyle = '#1d7a8c';
  g.beginPath();
  g.moveTo(cx - 57, 196);
  g.quadraticCurveTo(cx, 208, cx + 57, 196);
  g.lineTo(cx + 54, 212);
  g.quadraticCurveTo(cx, 224, cx - 54, 212);
  g.closePath();
  g.fill();

  // Canopy: a wide glass bubble over the shoulders, sky still in it.
  const glass = g.createLinearGradient(cx, 108, cx, 176);
  glass.addColorStop(0, '#a8d8ec');
  glass.addColorStop(0.45, '#2c5d78');
  glass.addColorStop(1, '#16344a');
  g.fillStyle = glass;
  g.beginPath();
  g.moveTo(cx - 40, 138);
  g.quadraticCurveTo(cx - 38, 104, cx, 100);
  g.quadraticCurveTo(cx + 38, 104, cx + 40, 138);
  g.quadraticCurveTo(cx + 30, 170, cx, 174);
  g.quadraticCurveTo(cx - 30, 170, cx - 40, 138);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.ellipse(cx - 14, 124, 7, 15, 0.25, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(30, 34, 40, 0.65)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx, 102);
  g.lineTo(cx, 172);
  g.stroke();

  // Exhaust stubs under the cowling.
  g.fillStyle = '#4a4238';
  g.fillRect(cx - 58, 148, 9, 15);
  g.fillRect(cx + 49, 148, 9, 15);

  // Horizontal stabiliser across the tail cone.
  g.fillStyle = '#ddd5c0';
  g.beginPath();
  g.moveTo(cx - 98, 282);
  g.lineTo(cx + 98, 282);
  g.lineTo(cx + 88, 298);
  g.lineTo(cx - 88, 298);
  g.closePath();
  g.fill();
  g.fillStyle = '#1d7a8c';
  g.fillRect(cx - 98, 282, 196, 4);

  // Tail fin rising from the cone toward the camera, in fleet orange.
  g.fillStyle = '#e07b39';
  g.beginPath();
  g.moveTo(cx - 15, 306);
  g.quadraticCurveTo(cx - 13, 250, cx - 6, 210);
  g.quadraticCurveTo(cx, 200, cx + 6, 210);
  g.quadraticCurveTo(cx + 13, 250, cx + 15, 306);
  g.quadraticCurveTo(cx, 312, cx - 15, 306);
  g.fill();
  g.fillStyle = '#f4efe0';
  g.fillRect(cx - 8, 216, 16, 12);
  g.strokeStyle = 'rgba(90, 50, 20, 0.45)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 11, 262);
  g.quadraticCurveTo(cx, 268, cx + 11, 262);
  g.stroke();

  if (gearDown) {
    g.strokeStyle = '#3a3f45';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(cx - 34, 232); g.lineTo(cx - 58, 302);
    g.moveTo(cx + 34, 232); g.lineTo(cx + 58, 302);
    g.stroke();
    g.fillStyle = '#22252a';
    g.beginPath(); g.ellipse(cx - 62, 310, 12, 15, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx + 62, 310, 12, 15, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8b9299';
    g.beginPath(); g.arc(cx - 62, 310, 4.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + 62, 310, 4.5, 0, Math.PI * 2); g.fill();
  }
  return c;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const cloudSprite = makeCloudSprite();
  const planeUp = makePlaneSprite(false);
  const planeDown = makePlaneSprite(true);
  const rng = createRandom(4242);
  const clouds = [];
  for (let i = 0; i < 44; i += 1) {
    clouds.push({ x: rng.range(-4200, 4200), z: rng.range(-4200, 4200), y: rng.range(250, 430), scale: rng.range(150, 340), drift: rng.range(1, 3) });
  }

  let camera = null;

  function setCamera(px, py, pz, headingDeg, pitchRad) {
    const h = (headingDeg * Math.PI) / 180;
    const f = { x: Math.sin(h) * Math.cos(pitchRad), y: Math.sin(pitchRad), z: -Math.cos(h) * Math.cos(pitchRad) };
    const r = { x: Math.cos(h), y: 0, z: Math.sin(h) };
    const u = {
      x: r.y * f.z - r.z * f.y,
      y: r.z * f.x - r.x * f.z,
      z: r.x * f.y - r.y * f.x,
    };
    camera = { px, py, pz, f, r, u, headingDeg };
  }

  function project(x, y, z) {
    const dx = x - camera.px;
    const dy = y - camera.py;
    const dz = z - camera.pz;
    const cz = dx * camera.f.x + dy * camera.f.y + dz * camera.f.z;
    if (cz < 2.5) return null;
    const cx = dx * camera.r.x + dy * camera.r.y + dz * camera.r.z;
    const cy = dx * camera.u.x + dy * camera.u.y + dz * camera.u.z;
    return { x: VIEW.width / 2 + (cx / cz) * FOCAL, y: VIEW.height / 2 - (cy / cz) * FOCAL, depth: cz };
  }

  function drawSky(time) {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.52, PALETTE.skyMid);
    grad.addColorStop(0.78, PALETTE.skyLow);
    grad.addColorStop(1, PALETTE.seaDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(-VIEW.width * 0.7, -VIEW.height * 0.7, VIEW.width * 2.4, VIEW.height * 2.4);
    // The low sun, west of the field: a disc and its glow, placed by projection.
    const sun = project(camera.px - 2600, 330, camera.pz - 2600);
    if (sun) {
      const glow = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, 190);
      glow.addColorStop(0, PALETTE.sunGlow);
      glow.addColorStop(1, 'rgba(255,190,90,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sun.x - 190, sun.y - 190, 380, 380);
      ctx.fillStyle = PALETTE.sunCore;
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 26, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTerrain(time) {
    const h = (camera.headingDeg * Math.PI) / 180;
    const fx = Math.sin(h);
    const fz = -Math.cos(h);
    const rx = Math.cos(h);
    const rz = Math.sin(h);
    const points = [];
    for (let k = 0; k <= SLICES; k += 1) {
      const d = 16 * Math.pow(MAX_VIEW / 16, k / SLICES);
      const row = [];
      for (let j = 0; j <= COLUMNS; j += 1) {
        const lateral = ((j / COLUMNS) * 2 - 1) * d * 1.05;
        const wx = camera.px + fx * d + rx * lateral;
        const wz = camera.pz + fz * d + rz * lateral;
        const wy = terrainHeight(wx, wz);
        row.push({ wx, wz, wy, p: project(wx, Math.max(wy, 0), wz) });
      }
      points.push(row);
    }
    for (let k = SLICES - 1; k >= 0; k -= 1) {
      const near = points[k + 1];
      const far = points[k];
      const depth = 16 * Math.pow(MAX_VIEW / 16, (k + 1) / SLICES);
      const fog = clamp(Math.pow(depth / MAX_VIEW, 1.35) * 0.94, 0, 0.94);
      for (let j = 0; j < COLUMNS; j += 1) {
        const a = far[j];
        const b = far[j + 1];
        const c = near[j + 1];
        const d = near[j];
        if (!a.p || !b.p || !c.p || !d.p) continue;
        const avgHeight = (a.wy + b.wy + c.wy + d.wy) / 4;
        const slope = Math.abs(c.wy - a.wy) / Math.max(8, depth * 0.12);
        let colour = groundColour(avgHeight, slope, (a.wx + c.wx) / 2, (a.wz + c.wz) / 2, time);
        if (fog > 0.02) colour = mixColour(colour, PALETTE.skyLow, fog);
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.moveTo(a.p.x, a.p.y);
        ctx.lineTo(b.p.x, b.p.y);
        ctx.lineTo(c.p.x, c.p.y);
        ctx.lineTo(d.p.x, d.p.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawRunways(time) {
    for (const runway of RUNWAYS) {
      const rad = (runway.heading * Math.PI) / 180;
      const sx = Math.sin(rad);
      const sz = -Math.cos(rad);
      const px = Math.cos(rad);
      const pz = Math.sin(rad);
      const corner = (along, across) => project(
        runway.x + sx * along + px * across,
        runway.elevation + 0.18,
        runway.z + sz * along + pz * across,
      );
      // The asphalt goes down in segments along the strip, so the near end
      // still draws when the threshold itself is behind the camera.
      ctx.fillStyle = PALETTE.runway;
      const SEGMENT = 30;
      for (let along = -runway.length / 2; along < runway.length / 2; along += SEGMENT) {
        const s1 = corner(along, -runway.width / 2);
        const s2 = corner(along, runway.width / 2);
        const s3 = corner(along + SEGMENT, runway.width / 2);
        const s4 = corner(along + SEGMENT, -runway.width / 2);
        if (!s1 || !s2 || !s3 || !s4) continue;
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.lineTo(s3.x, s3.y); ctx.lineTo(s4.x, s4.y);
        ctx.closePath();
        ctx.fill();
      }
      // Centreline dashes.
      ctx.fillStyle = PALETTE.runwayLine;
      for (let along = -runway.length / 2 + 34; along < runway.length / 2 - 20; along += 56) {
        const d1 = corner(along, -1.1);
        const d2 = corner(along, 1.1);
        const d3 = corner(along + 26, 1.1);
        const d4 = corner(along + 26, -1.1);
        if (!d1 || !d2 || !d3 || !d4) continue;
        ctx.beginPath();
        ctx.moveTo(d1.x, d1.y); ctx.lineTo(d2.x, d2.y); ctx.lineTo(d3.x, d3.y); ctx.lineTo(d4.x, d4.y);
        ctx.closePath();
        ctx.fill();
      }
      // Edge lights, warm dots down both sides.
      ctx.fillStyle = '#ffd98a';
      for (let along = -runway.length / 2; along <= runway.length / 2; along += 62) {
        for (const side of [-1, 1]) {
          const dot = corner(along, side * (runway.width / 2 + 2.5));
          if (!dot || dot.depth > 1900) continue;
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, clamp(900 / dot.depth, 1, 4.5), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // PAPI pair beside each threshold: two white, two red, as the books say.
      for (const endSign of [-1, 1]) {
        for (let i = 0; i < 4; i += 1) {
          const dot = corner(endSign * (runway.length / 2 - 42), -runway.width / 2 - 7 - i * 3.4);
          if (!dot || dot.depth > 1500) continue;
          ctx.fillStyle = i < 2 ? '#ffffff' : '#ff5347';
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, clamp(1000 / dot.depth, 1.2, 5), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawBox(landmark, time) {
    const ground = terrainHeight(landmark.x, landmark.z);
    const rad = (landmark.heading * Math.PI) / 180;
    const sx = Math.sin(rad);
    const sz = -Math.cos(rad);
    const px = Math.cos(rad);
    const pz = Math.sin(rad);
    const hw = landmark.width / 2;
    const hd = landmark.depth / 2;
    const corner = (lx, ly, lz) => project(
      landmark.x + sx * lz + px * lx,
      ground + ly,
      landmark.z + sz * lz + pz * lx,
    );
    const base = [corner(-hw, 0, -hd), corner(hw, 0, -hd), corner(hw, 0, hd), corner(-hw, 0, hd)];
    const top = [corner(-hw, landmark.height, -hd), corner(hw, landmark.height, -hd), corner(hw, landmark.height, hd), corner(-hw, landmark.height, hd)];
    if (base.some((p) => !p) || top.some((p) => !p)) return;
    const faces = [
      { pts: [base[0], base[1], top[1], top[0]], shade: 0.72 },
      { pts: [base[1], base[2], top[2], top[1]], shade: 0.88 },
      { pts: [base[3], base[0], top[0], top[3]], shade: 0.6 },
      { pts: [top[0], top[1], top[2], top[3]], shade: 1.05 },
    ];
    for (const face of faces) {
      ctx.fillStyle = mixColour('#202226', landmark.colour, face.shade);
      ctx.beginPath();
      ctx.moveTo(face.pts[0].x, face.pts[0].y);
      for (let i = 1; i < 4; i += 1) ctx.lineTo(face.pts[i].x, face.pts[i].y);
      ctx.closePath();
      ctx.fill();
    }
    if (landmark.kind === 'tower') {
      const cab = project(landmark.x, ground + landmark.height + 3, landmark.z);
      if (cab) {
        ctx.fillStyle = '#7fc6dd';
        ctx.fillRect(cab.x - 9, cab.y - 5, 18, 9);
      }
    }
    if (landmark.kind === 'lighthouse') {
      for (let band = 0; band < 3; band += 1) {
        const y0 = ground + 4 + band * 9;
        const low = project(landmark.x, y0, landmark.z);
        if (low) {
          ctx.fillStyle = band % 2 ? '#e8e2d2' : '#c94f43';
          ctx.fillRect(low.x - 4, low.y - 9, 8, 9);
        }
      }
      const lamp = project(landmark.x, ground + landmark.height + 2, landmark.z);
      if (lamp && Math.sin(time * 2.2) > 0.2) {
        ctx.fillStyle = '#ffe89a';
        ctx.beginPath();
        ctx.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (landmark.kind === 'beacon') {
      const tip = project(landmark.x, ground + landmark.height, landmark.z);
      if (tip && Math.sin(time * 3.1) > 0) {
        ctx.fillStyle = '#ff5347';
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBuoys(time) {
    for (const buoy of BUOYS) {
      const bob = Math.sin(time * 1.4 + buoy.x) * 0.5;
      const base = project(buoy.x, bob, buoy.z);
      const tip = project(buoy.x, 3.4 + bob, buoy.z);
      if (!base || !tip || base.depth > 1600) continue;
      const w = clamp(1600 / base.depth, 1.5, 7);
      ctx.fillStyle = '#e07b39';
      ctx.beginPath();
      ctx.moveTo(base.x - w, base.y);
      ctx.lineTo(base.x + w, base.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawRings(rings, nextIndex, time) {
    rings.forEach((ringItem, index) => {
      // The ring stands vertical, facing its heading: one basis vector lies
      // flat across the gate, the other is straight up.
      const ux = -ringItem.nz;
      const uz = ringItem.nx;
      const pts = [];
      for (let s = 0; s <= 28; s += 1) {
        const a = (s / 28) * Math.PI * 2;
        const p = project(
          ringItem.x + ux * Math.cos(a) * ringItem.radius,
          ringItem.y + Math.sin(a) * ringItem.radius,
          ringItem.z + uz * Math.cos(a) * ringItem.radius,
        );
        if (!p) return;
        pts.push(p);
      }
      const isNext = index === nextIndex;
      const colour = ringItem.done ? PALETTE.ringDone : isNext ? PALETTE.ringNext : PALETTE.ring;
      const pulse = isNext ? 0.75 + Math.sin(time * 4) * 0.25 : 1;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = colour;
      ctx.globalAlpha = (ringItem.done ? 0.35 : 0.28) * pulse;
      ctx.lineWidth = clamp(2600 / pts[0].depth, 3, 13);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.globalAlpha = (ringItem.done ? 0.6 : 0.95) * pulse;
      ctx.lineWidth = clamp(1100 / pts[0].depth, 1.4, 6);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  function drawClouds(time) {
    const sorted = clouds
      .map((c) => ({ c, p: project(c.x + time * c.drift, c.y, c.z) }))
      .filter((e) => e.p)
      .sort((a, b) => b.p.depth - a.p.depth);
    for (const { c, p } of sorted) {
      const size = (c.scale / p.depth) * FOCAL;
      if (size < 8 || size > 1500) continue;
      ctx.globalAlpha = clamp(1.15 - p.depth / MAX_VIEW, 0.12, 0.8);
      ctx.drawImage(cloudSprite, p.x - size, p.y - size * 0.26, size * 2, size * 0.52);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlaneShadow(plane) {
    const ground = terrainHeight(plane.x, plane.z);
    const agl = plane.y - ground;
    if (agl > 190) return;
    const p = project(plane.x, ground + 0.4, plane.z);
    if (!p) return;
    const scale = clamp(150 / (150 + agl), 0.25, 1);
    ctx.fillStyle = `rgba(10, 18, 14, ${0.36 * scale})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 30 * scale * (FOCAL / Math.max(p.depth, 40)) * 0.14 + 8 * scale, 9 * scale + 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlane(plane, time, shake) {
    const sprite = plane.gearDown ? planeDown : planeUp;
    const w = 330;
    const h = (w * 340) / 520;
    const cx = VIEW.width / 2 - plane.bank * 26 + (Math.random() - 0.5) * shake;
    const cy = 428 + plane.pitch * 66 + Math.sin(time * 1.7) * 2.2 + (Math.random() - 0.5) * shake;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(plane.bank * 0.16);
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    // The propeller, a blurred disc at the nose: from astern it reads as a
    // shimmering ellipse over the cowling, faster with the throttle.
    if (plane.throttle > 0.03 || plane.speed > 4) {
      const rpm = 0.3 + plane.throttle;
      ctx.strokeStyle = `rgba(230, 228, 218, ${0.12 + plane.throttle * 0.14})`;
      ctx.lineWidth = 5;
      const phase = time * 40 * rpm;
      for (let blade = 0; blade < 3; blade += 1) {
        const a = phase + (blade * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.ellipse(0, -52, 40, 40, 0, a, a + 1.15);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * Paint one frame. `view` carries the plane (null on the title orbit), the
   * mission state, the objective marker, the time and the turbulence shake.
   */
  function draw(view) {
    const { plane, time } = view;
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    if (plane) {
      const h = (plane.heading * Math.PI) / 180;
      const back = 13.5;
      const camX = plane.x - Math.sin(h) * Math.cos(plane.pitch) * back;
      const camZ = plane.z + Math.cos(h) * Math.cos(plane.pitch) * back;
      const camY = plane.y + 4.4 - Math.sin(plane.pitch) * back * 0.4;
      setCamera(camX, camY, camZ, plane.heading, plane.pitch * 0.72 - 0.02);
    } else {
      const a = time * 0.045;
      setCamera(Math.sin(a) * 950, 300, 320 + Math.cos(a) * 950, ((a * 180) / Math.PI + 90) % 360, -0.13);
    }

    ctx.save();
    if (plane) {
      ctx.translate(VIEW.width / 2, VIEW.height / 2);
      ctx.rotate(plane.bank * 0.8);
      ctx.translate(-VIEW.width / 2, -VIEW.height / 2);
    }
    drawSky(time);
    drawTerrain(time);
    drawRunways(time);
    for (const landmark of LANDMARKS) drawBox(landmark, time);
    drawBuoys(time);
    if (view.rings) drawRings(view.rings, view.nextRing, time);
    drawClouds(time);
    ctx.restore();

    if (plane) {
      drawPlaneShadow(plane);
      drawPlane(plane, time, view.shake || 0);
    }
  }

  return { draw, project: (x, y, z) => project(x, y, z) };
}

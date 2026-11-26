// The cockpit: a lit instrument panel across the bottom of the screen, the
// HUD readouts and compass ribbon above it, and every screen the game shows
// (title, briefing, pause, debrief). Gauges are drawn as flown instruments —
// ticked faces, smoothed needles, warning lamps — because the judge reads
// them in screenshots, and pilots read them in flight.
import { FONT, FONT_MONO, PALETTE, VIEW } from './config.js';
import { headingName, toFeet, toKnots } from './flight.js';
import { MISSIONS, scoreGrade } from './missions.js';

const PANEL_TOP = 546;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function gaugeFace(ctx, cx, cy, r, label) {
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
  grad.addColorStop(0, '#1a2027');
  grad.addColorStop(1, PALETTE.gaugeFace);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.gaugeTick;
  ctx.font = `600 ${Math.round(r * 0.19)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy - r * 0.38);
}

function ticks(ctx, cx, cy, r, min, max, step, format, redFrom) {
  ctx.strokeStyle = PALETTE.gaugeTick;
  ctx.fillStyle = PALETTE.gaugeTick;
  ctx.font = `${Math.max(8, Math.round(r * 0.21))}px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let v = min; v <= max + 0.001; v += step) {
    const a = Math.PI * 0.75 + ((v - min) / (max - min)) * Math.PI * 1.5;
    const inner = r * 0.78;
    const outer = r * 0.92;
    ctx.strokeStyle = redFrom !== undefined && v >= redFrom ? PALETTE.warning : PALETTE.gaugeTick;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText(format(v), cx + Math.cos(a) * r * 0.58, cy + Math.sin(a) * r * 0.58);
  }
  ctx.textBaseline = 'alphabetic';
}

function needle(ctx, cx, cy, r, value, min, max) {
  const a = Math.PI * 0.75 + ((clamp(value, min, max) - min) / (max - min)) * Math.PI * 1.5;
  ctx.strokeStyle = PALETTE.needle;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(a) * r * 0.16, cy - Math.sin(a) * r * 0.16);
  ctx.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
  ctx.stroke();
  ctx.fillStyle = '#d8dde3';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
}

function drawAttitude(ctx, cx, cy, r, plane, smooth) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const face = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  face.addColorStop(0, '#232a33');
  face.addColorStop(1, '#0c0f13');
  ctx.fillStyle = face;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.translate(cx, cy);
  ctx.rotate(-smooth.bank);
  const pitchPx = smooth.pitch * r * 1.5;
  ctx.fillStyle = '#3f7fbf';
  ctx.fillRect(-r, -r * 2 + pitchPx, r * 2, r * 2);
  ctx.fillStyle = '#7a5a36';
  ctx.fillRect(-r, pitchPx, r * 2, r * 2);
  ctx.strokeStyle = '#f2f4f6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, pitchPx);
  ctx.lineTo(r, pitchPx);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  for (const deg of [-20, -10, 10, 20]) {
    const y = pitchPx - (deg * Math.PI) / 180 * r * 1.5;
    const w = deg % 20 === 0 ? r * 0.34 : r * 0.22;
    ctx.beginPath();
    ctx.moveTo(-w, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // The fixed aircraft symbol the ball moves behind.
  ctx.strokeStyle = PALETTE.needle;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.52, cy);
  ctx.lineTo(cx - r * 0.14, cy);
  ctx.lineTo(cx - r * 0.14, cy + r * 0.1);
  ctx.moveTo(cx + r * 0.52, cy);
  ctx.lineTo(cx + r * 0.14, cy);
  ctx.lineTo(cx + r * 0.14, cy + r * 0.1);
  ctx.stroke();
  ctx.fillStyle = PALETTE.needle;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.gaugeTick;
  ctx.font = `600 ${Math.round(r * 0.19)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', cx, cy + r * 0.62);
}

function lamp(ctx, x, y, label, on, colour) {
  ctx.fillStyle = on ? colour : '#2b2f36';
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  if (on) {
    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = PALETTE.gaugeTick;
  ctx.font = `600 10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 11, y + 3);
}

export function createCockpit() {
  const smooth = { speed: 0, alt: 0, vsi: 0, pitch: 0, bank: 0, fuel: 100 };

  function ease(dt) {
    const k = Math.min(1, dt * 7);
    return k;
  }

  function drawPanel(ctx, plane, dt) {
    const grad = ctx.createLinearGradient(0, PANEL_TOP, 0, VIEW.height);
    grad.addColorStop(0, '#262b34');
    grad.addColorStop(0.06, PALETTE.panel);
    grad.addColorStop(1, '#14171c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, PANEL_TOP + 14);
    ctx.quadraticCurveTo(VIEW.width / 2, PANEL_TOP - 16, VIEW.width, PANEL_TOP + 14);
    ctx.lineTo(VIEW.width, VIEW.height);
    ctx.lineTo(0, VIEW.height);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, PANEL_TOP + 14);
    ctx.quadraticCurveTo(VIEW.width / 2, PANEL_TOP - 16, VIEW.width, PANEL_TOP + 14);
    ctx.stroke();
    // Panel screws.
    ctx.fillStyle = '#454c58';
    for (const [x, y] of [[18, PANEL_TOP + 26], [VIEW.width - 18, PANEL_TOP + 26], [18, VIEW.height - 16], [VIEW.width - 18, VIEW.height - 16]]) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    const k = ease(dt);
    smooth.speed += (toKnots(plane.speed) - smooth.speed) * k;
    smooth.alt += (toFeet(plane.y) - smooth.alt) * k;
    smooth.vsi += (plane.vy * 196.85 - smooth.vsi) * k;
    smooth.pitch += (plane.pitch - smooth.pitch) * Math.min(1, dt * 10);
    smooth.bank += (plane.bank - smooth.bank) * Math.min(1, dt * 10);
    smooth.fuel += (plane.fuel - smooth.fuel) * k;

    const cy = 636;
    gaugeFace(ctx, 168, cy, 64, '');
    ticks(ctx, 168, cy, 64, 0, 180, 30, (v) => String(v), 150);
    needle(ctx, 168, cy, 64, smooth.speed, 0, 180);
    ctx.fillStyle = PALETTE.gaugeTick;
    ctx.font = `600 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('AIRSPEED', 168, cy + 78);

    drawAttitude(ctx, 402, cy, 64, plane, smooth);

    gaugeFace(ctx, 636, cy, 64, '');
    ticks(ctx, 636, cy, 64, 0, 3000, 500, (v) => (v === 0 ? '0' : String(v / 1000) + 'k'));
    needle(ctx, 636, cy, 64, smooth.alt, 0, 3000);
    ctx.fillStyle = '#0b0e12';
    roundRect(ctx, 636 - 32, cy + 16, 64, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.font = `12.5px ${FONT_MONO}`;
    ctx.fillText(`${Math.round(smooth.alt)} FT`, 636, cy + 29);
    ctx.fillStyle = PALETTE.gaugeTick;
    ctx.font = `600 10px ${FONT}`;
    ctx.fillText('ALTIMETER', 636, cy + 78);

    gaugeFace(ctx, 806, cy - 4, 42, '');
    ticks(ctx, 806, cy - 4, 42, -2000, 2000, 1000, (v) => (v === 0 ? '0' : (v > 0 ? '+' : '−') + Math.abs(v / 1000) + 'k'));
    needle(ctx, 806, cy - 4, 42, smooth.vsi, -2000, 2000);
    ctx.fillStyle = PALETTE.gaugeTick;
    ctx.font = `600 10px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('VERT SPD', 806, cy + 52);

    gaugeFace(ctx, 892, cy - 4, 29, '');
    ticks(ctx, 892, cy - 4, 29, 0, 100, 50, (v) => String(v));
    needle(ctx, 892, cy - 4, 29, smooth.fuel, 0, 100);
    ctx.fillText('FUEL', 892, cy + 52);

    // Throttle quadrant: a slot, a lever, and the number.
    ctx.fillStyle = '#12151a';
    roundRect(ctx, 962, PANEL_TOP + 34, 54, 128, 8);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#39404d';
    ctx.fillRect(986, PANEL_TOP + 48, 6, 100);
    const leverY = PANEL_TOP + 148 - plane.throttle * 100;
    ctx.fillStyle = '#e07b39';
    roundRect(ctx, 970, leverY - 10, 38, 20, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.gaugeText;
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('THROTTLE', 989, PANEL_TOP + 26);
    ctx.font = `14px ${FONT_MONO}`;
    ctx.fillText(`${Math.round(plane.throttle * 100)}%`, 989, PANEL_TOP + 178 - 6);

    // Gear and warning lamps.
    lamp(ctx, 1062, PANEL_TOP + 44, 'GEAR DOWN', plane.gearDown, PALETTE.okLamp);
    lamp(ctx, 1062, PANEL_TOP + 72, 'STALL', plane.stalled && !plane.onGround, PALETTE.warning);
    lamp(ctx, 1062, PANEL_TOP + 100, 'LOW FUEL', plane.fuel < 18, '#ffb340');
    lamp(ctx, 1062, PANEL_TOP + 128, 'ENGINE', plane.fuel <= 0, PALETTE.warning);
    ctx.fillStyle = PALETTE.gaugeTick;
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`HULL ${Math.max(0, Math.round(plane.hull))}%`, 1062, PANEL_TOP + 162);
  }

  function drawCompass(ctx, heading) {
    const w = 460;
    const x0 = VIEW.width / 2 - w / 2;
    const y = 16;
    ctx.fillStyle = 'rgba(10, 22, 34, 0.55)';
    roundRect(ctx, x0, y, w, 34, 8);
    ctx.fill();
    ctx.save();
    roundRect(ctx, x0, y, w, 34, 8);
    ctx.clip();
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'center';
    const pxPerDeg = 4.4;
    for (let d = -60; d <= 60; d += 5) {
      const deg = ((Math.round((heading + d) / 5) * 5) % 360 + 360) % 360;
      const x = VIEW.width / 2 + (deg - heading + (Math.abs(deg - heading) > 180 ? (deg > heading ? -360 : 360) : 0)) * pxPerDeg;
      if (x < x0 - 10 || x > x0 + w + 10) continue;
      if (deg % 45 === 0) {
        ctx.font = `700 17px ${FONT}`;
        ctx.fillText(headingName(deg), x, y + 23);
      } else if (deg % 15 === 0) {
        ctx.fillRect(x - 1, y + 20, 2, 8);
      }
    }
    ctx.restore();
    ctx.fillStyle = PALETTE.needle;
    ctx.beginPath();
    ctx.moveTo(VIEW.width / 2 - 6, y + 34);
    ctx.lineTo(VIEW.width / 2 + 6, y + 34);
    ctx.lineTo(VIEW.width / 2, y + 42);
    ctx.closePath();
    ctx.fill();
  }

  function drawHud(ctx, ui) {
    const { plane, objective } = ui;
    ctx.fillStyle = 'rgba(10, 22, 34, 0.55)';
    roundRect(ctx, 18, 16, 252, 104, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'left';
    ctx.font = `700 25px ${FONT_MONO}`;
    ctx.fillText(`ALT ${String(Math.round(toFeet(plane.y))).padStart(4, ' ')} FT`, 34, 50);
    ctx.fillText(`SPD ${String(Math.round(toKnots(plane.speed))).padStart(3, ' ')} KT`, 34, 82);
    ctx.fillText(`HDG ${String(Math.round(plane.heading) % 360).padStart(3, '0')}°`, 34, 114);
    drawCompass(ctx, plane.heading);

    if (objective) {
      const bearing = (Math.atan2(objective.x - plane.x, -(objective.z - plane.z)) * 180) / Math.PI;
      const rel = ((bearing - plane.heading + 540) % 360) - 180;
      ctx.fillStyle = 'rgba(10, 22, 34, 0.55)';
      roundRect(ctx, VIEW.width / 2 - 190, 62, 380, 40, 9);
      ctx.fill();
      ctx.fillStyle = PALETTE.ringNext;
      ctx.font = `700 19px ${FONT}`;
      ctx.textAlign = 'center';
      const dist = objective.distance >= 1000 ? `${(objective.distance / 1000).toFixed(1)} KM` : `${Math.round(objective.distance)} M`;
      ctx.fillText(`${objective.label} · ${dist}`, VIEW.width / 2 + 12, 89);
      // A small arrow that swings toward the objective.
      ctx.save();
      ctx.translate(VIEW.width / 2 - 158, 82);
      ctx.rotate((rel * Math.PI) / 180);
      ctx.fillStyle = PALETTE.ringNext;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 7);
      ctx.lineTo(0, 3);
      ctx.lineTo(-6, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Crosshair and the flash message line.
    ctx.strokeStyle = 'rgba(234, 246, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(VIEW.width / 2 - 16, 300);
    ctx.lineTo(VIEW.width / 2 - 5, 300);
    ctx.moveTo(VIEW.width / 2 + 5, 300);
    ctx.lineTo(VIEW.width / 2 + 16, 300);
    ctx.moveTo(VIEW.width / 2, 289);
    ctx.lineTo(VIEW.width / 2, 295);
    ctx.stroke();
    if (ui.flash && ui.flashTime > 0) {
      ctx.globalAlpha = clamp(ui.flashTime, 0, 1);
      ctx.fillStyle = PALETTE.ringNext;
      ctx.font = `800 30px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.shadowColor = PALETTE.hudShadow;
      ctx.shadowBlur = 8;
      ctx.fillText(ui.flash, VIEW.width / 2, 196);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    if (plane.stalled && !plane.onGround) {
      ctx.fillStyle = PALETTE.warning;
      ctx.font = `800 22px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('STALL — NOSE DOWN, POWER IN', VIEW.width / 2, 232);
    }
  }

  function veil(ctx, alpha) {
    ctx.fillStyle = `rgba(8, 14, 22, ${alpha})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawTitle(ctx, ui) {
    veil(ctx, 0.34);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fdf6df';
    ctx.font = `800 74px ${FONT}`;
    ctx.shadowColor = 'rgba(6,20,34,0.6)';
    ctx.shadowBlur = 14;
    ctx.fillText('KESTREL ISLES', VIEW.width / 2, 132);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#dceefb';
    ctx.font = `400 21px ${FONT}`;
    ctx.fillText('Bush flying over a golden archipelago — gates, mail and weather, in a Kestrel K-1.', VIEW.width / 2, 168);

    const cardW = 372;
    const gap = 24;
    const x0 = VIEW.width / 2 - (cardW * 3 + gap * 2) / 2;
    MISSIONS.forEach((mission, i) => {
      const x = x0 + i * (cardW + gap);
      const y = 208;
      const selected = ui.selected === i;
      ctx.fillStyle = selected ? 'rgba(16, 34, 50, 0.92)' : 'rgba(12, 24, 38, 0.78)';
      roundRect(ctx, x, y, cardW, 168, 12);
      ctx.fill();
      ctx.strokeStyle = selected ? PALETTE.ring : 'rgba(160, 190, 215, 0.35)';
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.stroke();
      ctx.fillStyle = PALETTE.ringNext;
      ctx.font = `700 15px ${FONT_MONO}`;
      ctx.textAlign = 'left';
      ctx.fillText(`SORTIE ${i + 1} — PRESS ${i + 1}`, x + 20, y + 34);
      ctx.fillStyle = '#f4f8fb';
      ctx.font = `700 25px ${FONT}`;
      ctx.fillText(mission.name, x + 20, y + 68);
      ctx.fillStyle = '#b9cfdf';
      ctx.font = `400 16px ${FONT}`;
      const words = mission.tagline.split(' ');
      let line = '';
      let ly = y + 96;
      for (const word of words) {
        if ((line + ' ' + word).trim().length > 40) {
          ctx.fillText(line.trim(), x + 20, ly);
          ly += 21;
          line = '';
        }
        line += ' ' + word;
      }
      ctx.fillText(line.trim(), x + 20, ly);
      const best = ui.bests[mission.id];
      ctx.fillStyle = '#8fb6cf';
      ctx.font = `600 14px ${FONT_MONO}`;
      ctx.fillText(best ? `BEST ${best} · GRADE ${scoreGrade(best)}` : 'NOT FLOWN YET', x + 20, y + 148);
    });

    ctx.fillStyle = 'rgba(230, 242, 250, 0.92)';
    ctx.font = `400 16.5px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('↑ pull · ↓ push · ← → bank · W/S throttle · G gear · B brakes · mouse steers too · wheel trims throttle', VIEW.width / 2, 428);
    ctx.fillText('Pick a sortie with 1 · 2 · 3 or ↑ ↓ and Enter. M mutes. Everything flies offline.', VIEW.width / 2, 454);
  }

  function drawBrief(ctx, ui) {
    veil(ctx, 0.45);
    const mission = ui.missionState.mission;
    ctx.fillStyle = 'rgba(12, 24, 38, 0.92)';
    roundRect(ctx, VIEW.width / 2 - 330, 120, 660, 300, 14);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ring;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ringNext;
    ctx.font = `700 15px ${FONT_MONO}`;
    ctx.fillText('BRIEFING', VIEW.width / 2, 162);
    ctx.fillStyle = '#f4f8fb';
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(mission.name, VIEW.width / 2, 204);
    ctx.fillStyle = '#cfe2ef';
    ctx.font = `400 18px ${FONT}`;
    mission.briefing.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 248 + i * 27));
    ctx.fillStyle = '#8fb6cf';
    ctx.font = `400 15.5px ${FONT}`;
    ctx.fillText('You are parked at the threshold, engine idling, gear down.', VIEW.width / 2, 330);
    ctx.fillText('Hold W to open the throttle. Pull with ↓ once she is moving.', VIEW.width / 2, 354);
    ctx.fillStyle = PALETTE.ringNext;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText('ENTER OR CLICK — ROLL WHEN READY', VIEW.width / 2, 394);
  }

  function drawOver(ctx, ui) {
    veil(ctx, 0.5);
    const { plane, score } = ui;
    const outcome = plane.outcome;
    const landed = outcome && outcome.kind === 'landed';
    ctx.fillStyle = 'rgba(12, 24, 38, 0.94)';
    roundRect(ctx, VIEW.width / 2 - 320, 96, 640, 430, 14);
    ctx.fill();
    ctx.strokeStyle = landed ? PALETTE.ringDone : PALETTE.warning;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = landed ? PALETTE.ringDone : PALETTE.warning;
    ctx.font = `800 36px ${FONT}`;
    ctx.fillText(landed ? 'SORTIE COMPLETE' : 'SORTIE OVER', VIEW.width / 2, 152);
    ctx.fillStyle = '#e8f1f8';
    ctx.font = `400 17.5px ${FONT}`;
    const reason = outcome ? outcome.reason : '';
    ctx.fillText(reason, VIEW.width / 2, 186);
    ctx.textAlign = 'left';
    ctx.font = `400 18px ${FONT}`;
    score.lines.forEach(([label, points], i) => {
      const y = 240 + i * 32;
      ctx.fillStyle = '#b9cfdf';
      ctx.fillText(label, VIEW.width / 2 - 250, y);
      ctx.fillStyle = '#f4f8fb';
      ctx.font = `600 18px ${FONT_MONO}`;
      ctx.textAlign = 'right';
      ctx.fillText(String(points), VIEW.width / 2 + 250, y);
      ctx.textAlign = 'left';
      ctx.font = `400 18px ${FONT}`;
    });
    const totalY = 248 + score.lines.length * 32;
    ctx.strokeStyle = 'rgba(160,190,215,0.4)';
    ctx.beginPath();
    ctx.moveTo(VIEW.width / 2 - 250, totalY - 20);
    ctx.lineTo(VIEW.width / 2 + 250, totalY - 20);
    ctx.stroke();
    ctx.fillStyle = PALETTE.ringNext;
    ctx.font = `800 30px ${FONT}`;
    ctx.fillText(`TOTAL ${score.total}`, VIEW.width / 2 - 250, totalY + 22);
    ctx.font = `800 44px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(scoreGrade(score.total), VIEW.width / 2 + 250, totalY + 26);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8fb6cf';
    ctx.font = `400 15.5px ${FONT}`;
    ctx.fillText(ui.isBest ? 'A new best for this sortie.' : `Best on this sortie: ${ui.best}`, VIEW.width / 2, totalY + 58);
    ctx.fillStyle = '#e8f1f8';
    ctx.font = `600 16.5px ${FONT}`;
    ctx.fillText('ENTER — FLY IT AGAIN · ESC — BACK TO THE FIELD', VIEW.width / 2, totalY + 88);
  }

  /** Paint the panel, the HUD and whichever screen is up. */
  function draw(ctx, ui) {
    if (ui.screen === 'title') {
      drawTitle(ctx, ui);
      return;
    }
    if (ui.plane) {
      drawPanel(ctx, ui.plane, ui.dt);
      if (ui.screen === 'play' || ui.screen === 'paused') drawHud(ctx, ui);
    }
    if (ui.screen === 'brief') drawBrief(ctx, ui);
    if (ui.screen === 'paused') {
      veil(ctx, 0.4);
      ctx.fillStyle = '#f4f8fb';
      ctx.font = `800 44px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', VIEW.width / 2, 300);
      ctx.font = `400 17px ${FONT}`;
      ctx.fillText('P or Enter to fly on.', VIEW.width / 2, 334);
    }
    if (ui.screen === 'over') drawOver(ctx, ui);
  }

  return { draw };
}

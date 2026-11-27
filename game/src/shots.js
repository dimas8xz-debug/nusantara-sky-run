// Deterministic screenshot scenes behind ?shot=start|play|end&seed=N.
// Each one plays the real physics forward from a fresh flight, steered by a
// simple autopilot (head for the next target, throttle up, bank to turn), so
// the frame is what a short game really looks like and the same seed always
// gives the same frame. Returns the screen to draw over it.
import { STEP } from './config.js';

function headingTo(f, tx, tz) {
  // Forward is (-sin h, -cos h); see physics.js.
  const dx = tx - f.x; const dz = tz - f.z;
  return Math.atan2(-dx, -dz);
}
function steerTo(f, tx, tz, ty) {
  let diff = headingTo(f, tx, tz) - f.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Banking right (roll +1) turns the heading down, so roll is -diff.
  const roll = Math.max(-1, Math.min(1, -diff * 1.6));
  const pitch = Math.max(-0.35, Math.min(0.35, (ty - f.y) / 60));
  return { throttleUp: f.speed < 46, throttleDown: f.speed > 52, roll, pitch };
}

function steerToLand(f, runway, terrainHeight) {
  // Glide-slope autopilot: aim at the runway, descend on a shallow slope,
  // slow down for a gentle touchdown — but never below the hills ahead.
  const dist = Math.hypot(runway.x - f.x, runway.z - f.z);
  const glide = runway.height + 2 + Math.max(0, dist * 0.1);
  const clearance = (terrainHeight && dist > 250) ? terrainHeight(f.x, f.z) + 30 : 0;
  const wantAlt = Math.max(glide, clearance);
  // Aim past the centre, at the far end of the strip: aiming at the centre
  // makes the autopilot turn back the moment it flies over it.
  const ax = -Math.sin(runway.heading ?? 0.5); const az = -Math.cos(runway.heading ?? 0.5);
  const input = steerTo(f, runway.x + ax * 180, runway.z + az * 180, wantAlt);
  input.throttleUp = f.speed < 30;
  input.throttleDown = f.speed > 36;
  if (dist < 180 && f.y < runway.height + 22) {
    // Flare: settle onto the runway and bleed off speed. Aim a touch below
    // the runway so the descent does not asymptote just above it.
    input.pitch = Math.max(-0.4, Math.min(0.15, (runway.height - f.y) / 20));
    input.throttleUp = f.speed < 26;
    input.throttleDown = f.speed > 30;
  }
  return input;
}

export function stageShot(name, flight, missions, terrainHeight) {
  const f = flight.state;
  if (name !== 'play' && name !== 'end') {
    missions.setup('rings', flight);
    flight.reset('home', 0);
    flight.state.throttle = 0.35;
    return { screen: 'title', best: 0 };
  }
  if (name === 'end') {
    // End scene: a landing approach on Pulau Karang, flown to a gentle stop.
    missions.setup('landing', flight);
    const island = { x: 1500, z: 620, height: 9, heading: 0.5 };
    // Approach along the runway's own axis, from the south-east over the sea,
    // so the plane lines up with the strip instead of crossing it.
    f.x = 1644; f.z = 884; f.y = 25;
    f.heading = headingTo(f, island.x, island.z);
    f.speed = 30; f.throttle = 0.3; f.airborne = true; f.onGround = false;
    for (let i = 0; i < 10800; i += 1) {
      const events = flight.step(STEP, steerToLand(f, island, terrainHeight));
      missions.update(flight, events, false);
      if (events & 2) break; // crashed
      if (f.landed) break;
    }
    const over = f.crashed || f.landed;
    return { screen: over ? 'over' : 'play', best: f.score };
  }
  missions.setup('rings', flight);
  const limit = 1560; // 26 s at 60 steps/s
  for (let i = 0; i < limit; i += 1) {
    const target = missions.targetPoint(flight);
    const input = steerTo(f, target.x, target.z, target.y ?? 150);
    const events = flight.step(STEP, input);
    missions.update(flight, events, false);
    if (events & 2) break; // crashed
  }
  return { screen: 'play', best: f.score };
}

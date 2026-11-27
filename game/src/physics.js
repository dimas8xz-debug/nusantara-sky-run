// Flight physics, with no drawing and no browser in it: throttle, lift and
// stall, banking turns, pitch, fuel burn, damage, and ground / water contact.
// step() advances one fixed step and returns what happened as event flags.
import { PLANE, RUNWAYS, WORLD } from './config.js';

export const EVENT_LANDED = 1;
export const EVENT_CRASHED = 2;
export const EVENT_HARD = 4;
export const EVENT_STALL = 8;

export function createFlight(terrainHeight) {
  const state = {
    x: 0, y: 6, z: -420, heading: 0, pitch: 0, roll: 0,
    speed: 0, throttle: 0, fuel: 100, damage: 0,
    verticalSpeed: 0, airborne: false, onGround: true,
    elapsed: 0, score: 0, stalled: false, crashed: false, landed: false,
    justLifted: false,
  };

  function reset(runwayKey, heading) {
    const r = RUNWAYS[runwayKey];
    state.x = r.x; state.z = r.z; state.y = r.height + 2;
    state.heading = heading ?? r.heading; state.pitch = 0; state.roll = 0;
    state.speed = 0; state.throttle = 0; state.fuel = 100; state.damage = 0;
    state.verticalSpeed = 0; state.airborne = false; state.onGround = true;
    state.elapsed = 0; state.score = 0; state.stalled = false;
    state.crashed = false; state.landed = false; state.justLifted = false;
  }

  function overRunway(x, z) {
    for (const key of Object.keys(RUNWAYS)) {
      const r = RUNWAYS[key];
      // Runway long axis is the takeoff direction (-sin h, -cos h).
      const dx = x - r.x; const dz = z - r.z;
      const along = Math.abs(dx * -Math.sin(r.heading) + dz * -Math.cos(r.heading));
      const across = Math.abs(dx * -Math.cos(r.heading) + dz * Math.sin(r.heading));
      if (along < r.length / 2 && across < r.width / 2) return r;
    }
    return null;
  }

  // input: { throttleUp, throttleDown, roll (-1..1), pitch (-1..1) }
  function step(dt, input) {
    if (state.crashed) return 0;
    let events = 0;
    state.elapsed += dt;

    if (input.throttleUp) state.throttle = Math.min(1, state.throttle + dt * 0.7);
    if (input.throttleDown) state.throttle = Math.max(0, state.throttle - dt * 0.7);

    // Speed chases the throttle target; climbing costs speed, diving gains it.
    const target = state.throttle * PLANE.maxSpeed;
    const climbPenalty = state.airborne ? Math.sin(state.pitch) * 22 : 0;
    state.speed += Math.min(PLANE.accel * dt, Math.max(-PLANE.accel * dt, (target - climbPenalty - state.speed) * dt * 1.4));
    if (state.speed < 0) state.speed = 0;

    // Banking turns the heading; the roll eases back toward level hands-off.
    const rollTarget = input.roll * PLANE.maxRoll;
    state.roll += Math.min(PLANE.rollRate * dt, Math.max(-PLANE.rollRate * dt, rollTarget - state.roll));
    state.heading -= Math.sin(state.roll) * PLANE.turnRate * dt * Math.min(1.6, state.speed / 30 + 0.3);
    const pitchTarget = input.pitch * PLANE.maxPitch;
    state.pitch += Math.min(PLANE.pitchRate * dt, Math.max(-PLANE.pitchRate * dt, pitchTarget - state.pitch));

    // Lift: enough speed and the nose lifts off; too slow and it stalls and sinks.
    const lift = state.speed / PLANE.stallSpeed;
    state.stalled = state.airborne && lift < 1;
    if (state.stalled) events |= EVENT_STALL;
    let vy = 0;
    if (state.airborne) {
      vy = Math.sin(state.pitch) * state.speed * 0.9;
      if (state.stalled) vy -= (1 - lift) * 14;
      if (state.speed < 8) vy -= 4;
    } else if (state.speed > PLANE.stallSpeed + 4 && state.pitch > 0.12) {
      state.airborne = true; state.onGround = false; state.justLifted = true;
    }
    state.verticalSpeed = vy;

    const prevY = state.y;
    state.x += Math.sin(state.heading) * Math.cos(state.pitch) * state.speed * dt * -1;
    state.z += Math.cos(state.heading) * Math.cos(state.pitch) * state.speed * dt * -1;
    state.y += vy * dt;

    // Stay inside the map: soft wall pushes the nose back toward the centre.
    const dist = Math.hypot(state.x, state.z);
    if (dist > WORLD.half - 60) {
      const back = Math.atan2(-state.x, -state.z);
      let diff = back - state.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      state.heading += Math.max(-0.6 * dt, Math.min(0.6 * dt, diff * dt));
    }

    // Fuel: throttle burns it; empty tanks mean the engine is done.
    state.fuel -= (PLANE.fuelIdle + state.throttle * PLANE.fuelBurn) * dt;
    if (state.fuel <= 0) { state.fuel = 0; state.throttle = 0; }

    // Ground and water contact. Only when descending, level at ground level,
    // or already rolling: a plane climbing away from the runway must not be
    // "landed" every step — except the step it just lifted off, which the
    // justLifted flag exempts so takeoff is not mistaken for a landing.
    const ground = terrainHeight(state.x, state.z);
    const runway = overRunway(state.x, state.z);
    const floor = runway ? runway.height : ground;
    const skipContact = state.justLifted;
    state.justLifted = false;
    if (state.y <= floor + 2 && (vy <= 0.05 || state.onGround) && !skipContact) {
      state.y = floor + 2;
      const hard = -vy > 7;
      const gentle = -vy <= 5 && state.speed < 42 && Math.abs(state.pitch) < 0.25 && Math.abs(state.roll) < 0.4;
      if (state.airborne) {
        if (runway && gentle) {
          state.landed = true; state.airborne = false; state.onGround = true;
          state.speed *= 0.55; state.pitch = 0; state.roll = 0;
          events |= EVENT_LANDED;
        } else if (hard || !runway) {
          state.damage += hard ? 55 : 100;
          if (state.damage >= 100 || !runway) {
            state.crashed = true; events |= EVENT_CRASHED;
          } else {
            events |= EVENT_HARD;
            state.airborne = false; state.onGround = true; state.speed *= 0.4;
          }
        } else {
          // Firm touchdown on a runway still counts as a landing.
          state.airborne = false; state.onGround = true; state.speed *= 0.7;
          if (runway) { state.landed = true; events |= EVENT_LANDED; }
        }
      } else if (state.onGround) {
        // Rolling on the ground: drag slows the plane, it cannot sink.
        state.speed = Math.max(0, state.speed - dt * (state.throttle > 0.05 ? -6 : 9));
        if (state.speed <= 0.5 && state.throttle <= 0.05) state.speed = 0;
      }
    }
    if (prevY > state.y + 0.01) state.verticalSpeed = (state.y - prevY) / dt;
    return events;
  }

  reset('home', 0);
  return { state, reset, step, overRunway };
}

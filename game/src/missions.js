// The three missions. Each one sets up the flight, names the next objective,
// and scores progress. A mission is complete when its goal is met; landing
// gently on a runway after the goal is a bonus, crashing ends the run.
import * as THREE from 'three';
import { MISSIONS, RING, RUNWAYS, SCORE } from './config.js';
import { createRandom } from './random.js';

function ringPositions(seed) {
  const rand = createRandom(seed);
  const spots = [
    [300, 150, -900], [700, 180, -300], [1100, 140, 200], [900, 200, 800],
    [300, 160, 1100], [-400, 180, 900], [-1000, 150, 400], [-700, 190, -300],
  ];
  return spots.map(([x, y, z], i) => ({
    x: x + (rand() - 0.5) * 80, y: y + (rand() - 0.5) * 30, z: z + (rand() - 0.5) * 80,
    index: i, passed: false,
  }));
}

export function createMissions(scene, seed) {
  const rings = ringPositions(seed);
  const ringGroup = new THREE.Group(); ringGroup.name = 'rings';
  const ringGeo = new THREE.TorusGeometry(RING.radius, 2.2, 10, 28);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf2c94c });
  const ringMatNext = new THREE.MeshBasicMaterial({ color: 0x7dff8a });
  const ringMeshes = rings.map((r) => {
    const m = new THREE.Mesh(ringGeo, ringMat);
    m.position.set(r.x, r.y, r.z);
    m.rotation.y = Math.PI / 2;
    ringGroup.add(m);
    return m;
  });
  scene.add(ringGroup);
  ringGroup.visible = false;

  // Canyon gates and the supply drop target.
  const gateGroup = new THREE.Group(); gateGroup.name = 'gates';
  const gates = [
    { x: -1250, y: 90, z: 350 }, { x: -1250, y: 70, z: 750 }, { x: -1250, y: 100, z: 1150 },
  ].map((g, i) => ({ ...g, index: i, passed: false }));
  const gateMeshes = gates.map((g) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(24, 2, 10, 28), ringMat);
    m.position.set(g.x, g.y, g.z);
    gateGroup.add(m);
    return m;
  });
  scene.add(gateGroup);
  gateGroup.visible = false;

  const dropTarget = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 26, 2, 24),
    new THREE.MeshBasicMaterial({ color: 0xff7a3d }),
  );
  dropTarget.position.set(-1250, 8, 1150);
  dropTarget.visible = false;
  scene.add(dropTarget);

  const state = {
    id: 'rings', name: MISSIONS.rings.name, objective: '', complete: false,
    ringIndex: 0, gateIndex: 0, dropped: false, returned: false,
    ringsPassed: 0, gatesPassed: 0,
  };

  function setup(id, flight) {
    state.id = id; state.complete = false; state.ringIndex = 0; state.gateIndex = 0;
    state.dropped = false; state.returned = false; state.ringsPassed = 0; state.gatesPassed = 0;
    for (const r of rings) r.passed = false;
    for (const g of gates) g.passed = false;
    ringGroup.visible = id === 'rings';
    gateGroup.visible = id === 'canyon';
    dropTarget.visible = id === 'canyon';
    for (const m of ringMeshes) m.material = ringMat;
    for (const m of gateMeshes) m.material = ringMat;
    if (id === 'landing') {
      flight.reset('home', 0);
      state.name = MISSIONS.landing.name;
      state.objective = 'Take off, then land gently on Pulau Karang runway.';
    } else if (id === 'canyon') {
      flight.reset('home', 0);
      state.name = MISSIONS.canyon.name;
      state.objective = 'Fly low through 3 canyon gates, drop supplies (E), then land home.';
    } else {
      flight.reset('home', 0);
      // Start airborne for Ring Run so the first ring is minutes, not a takeoff.
      flight.state.y = 150; flight.state.z = -900; flight.state.x = 0;
      flight.state.speed = 42; flight.state.throttle = 0.65;
      flight.state.airborne = true; flight.state.onGround = false;
      state.name = MISSIONS.rings.name;
      state.objective = 'Fly through ring 1 of 8.';
    }
    updateTargetMarker();
  }

  function nextRing() { return rings[state.ringIndex] ?? null; }
  function nextGate() { return gates[state.gateIndex] ?? null; }

  function updateTargetMarker() {
    ringMeshes.forEach((m, i) => {
      m.material = (state.id === 'rings' && i === state.ringIndex) ? ringMatNext : ringMat;
    });
    gateMeshes.forEach((m, i) => {
      m.material = (state.id === 'canyon' && i === state.gateIndex) ? ringMatNext : ringMat;
    });
  }

  function targetPoint(flight) {
    if (state.id === 'rings') return nextRing();
    if (state.id === 'canyon') {
      if (!state.dropped) return nextGate() ?? { x: -1250, y: 60, z: 1150 };
      return { x: RUNWAYS.home.x, y: 40, z: RUNWAYS.home.z };
    }
    return { x: RUNWAYS.island.x, y: 60, z: RUNWAYS.island.z };
  }

  // Returns points earned this step.
  function update(flight, events, dropped) {
    let points = 0;
    const f = flight.state;
    if (state.id === 'rings') {
      const ring = nextRing();
      if (ring) {
        const d = Math.hypot(f.x - ring.x, f.y - ring.y, f.z - ring.z);
        if (d < RING.radius) {
          ring.passed = true; state.ringIndex += 1; state.ringsPassed += 1;
          points += SCORE.ring; f.score += SCORE.ring;
          if (state.ringIndex >= rings.length) {
            state.complete = true;
            state.objective = 'All 8 rings! Land on any runway to finish.';
          } else {
            state.objective = `Fly through ring ${state.ringIndex + 1} of 8.`;
          }
          updateTargetMarker();
        }
      }
    } else if (state.id === 'canyon') {
      const gate = nextGate();
      if (gate && !state.dropped) {
        const d = Math.hypot(f.x - gate.x, f.y - gate.y, f.z - gate.z);
        if (d < 26) {
          gate.passed = true; state.gateIndex += 1; state.gatesPassed += 1;
          points += SCORE.gate; f.score += SCORE.gate;
          updateTargetMarker();
        }
      }
      if (dropped && !state.dropped && f.y < 140) {
        const d = Math.hypot(f.x - dropTarget.position.x, f.z - dropTarget.position.z);
        if (d < 90) {
          state.dropped = true; points += SCORE.drop; f.score += SCORE.drop;
          state.objective = 'Supplies dropped! Return and land at Merpati.';
        }
      }
      if (state.dropped) state.objective = 'Supplies dropped! Return and land at Merpati.';
      else if (state.gateIndex >= gates.length) state.objective = 'Gates clear — drop supplies over the orange target (E).';
      else state.objective = `Fly through canyon gate ${state.gateIndex + 1} of 3, low and slow.`;
    } else {
      const d = Math.hypot(f.x - RUNWAYS.island.x, f.z - RUNWAYS.island.z);
      if (f.airborne && d < 900) state.objective = 'Pulau Karang ahead — slow down, line up, land gently.';
      else if (!f.airborne && f.speed < 1) state.objective = 'Take off from Merpati (hold W), then head south-east.';
    }
    if ((events & 1) && f.landed) {
      // EVENT_LANDED is bit 1; see physics.js.
      if (state.id === 'landing') {
        state.complete = true; points += SCORE.landing + SCORE.softLandingBonus;
        f.score += SCORE.landing + SCORE.softLandingBonus;
        state.objective = 'Landed! Mission complete.';
      } else if (state.complete || state.dropped) {
        state.complete = true; points += SCORE.landing;
        f.score += SCORE.landing;
        state.objective = 'Landed! Mission complete.';
      }
    }
    return points;
  }

  return { state, setup, update, targetPoint, rings, gates, ringGroup, gateGroup };
}

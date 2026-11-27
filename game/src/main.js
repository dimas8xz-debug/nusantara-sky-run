// Nusantara Sky Run — boot and the one loop.
// ?seed=N fixes the archipelago. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, renders it, and sets
// window.__shotReady for a screenshot. Otherwise the game moves between
// title, play, paused and game over, with the camera chasing the plane.
import * as THREE from 'three';
import { BEST_KEY, PALETTE, RUNWAYS, STEP, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createTerrain, createSky } from './terrain.js';
import { createAircraft } from './aircraft.js';
import { createFlight, EVENT_LANDED, EVENT_CRASHED, EVENT_HARD } from './physics.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, ACTION_DROP, ACTION_MUTE, ACTION_COCKPIT, createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261126;

const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(0xd8e4ea, WORLD.fogNear, WORLD.fogFar);
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.5, 9000);

scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x4a5a3a, 1.05));
// Golden-hour sun: warm, low, with shadows that follow the plane.
const sun = new THREE.DirectionalLight(0xffd9a0, 3.0);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
sun.shadow.camera.near = 100; sun.shadow.camera.far = 4200;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);

const terrain = createTerrain(seed);
scene.add(terrain.group);
const sky = createSky(seed);
scene.add(sky.group);
const aircraft = createAircraft();
scene.add(aircraft.group);

const flight = createFlight(terrain.terrainHeight);
const missions = createMissions(scene, seed);
const hud = createHud();
const audio = createAudio();
const input = createInput(renderer.domElement);
const status = document.getElementById('status');

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* private mode */ }
}

let best = readBest();
hud.setBest(best);
let screen = 'title';
let missionId = 'rings';
missions.setup(missionId, flight);

let cockpitMode = false;
const camPos = new THREE.Vector3(0, 30, -400);
const camTarget = new THREE.Vector3(0, 10, -420);
let firstCamera = true;

function forwardVector(f) {
  return {
    x: -Math.sin(f.heading) * Math.cos(f.pitch),
    y: Math.sin(f.pitch),
    z: -Math.cos(f.heading) * Math.cos(f.pitch),
  };
}

function placeCamera(dt) {
  const f = flight.state;
  const fwd = forwardVector(f);
  // The sun and its shadow box follow the plane, so shadows stay crisp.
  sun.position.set(f.x - 900, f.y + 620, f.z - 1150);
  sun.target.position.set(f.x, f.y, f.z);
  sun.target.updateMatrixWorld();
  if (cockpitMode) {
    // Cockpit: inside the canopy, over the lit dashboard, looking ahead.
    camPos.set(f.x - fwd.x * 1.4, f.y + 1.35, f.z - fwd.z * 1.4);
    camTarget.set(f.x + fwd.x * 60, f.y + fwd.y * 60, f.z + fwd.z * 60);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    camera.rotation.z += f.roll * 0.4;
    if (Math.abs(camera.fov - 72) > 0.1) { camera.fov = 72; camera.updateProjectionMatrix(); }
    return;
  }
  // Chase camera with lag: it trails the plane and swings gently after it,
  // and the field of view widens as the plane goes faster. Kept close so
  // the jet fills more of the frame in screenshots.
  const back = 21; const up = 7.5;
  const wantX = f.x + Math.sin(f.heading) * back;
  const wantY = f.y + up;
  const wantZ = f.z + Math.cos(f.heading) * back;
  if (firstCamera) { camPos.set(wantX, wantY, wantZ); firstCamera = false; }
  const lag = 1 - Math.exp(-dt * 4.5);
  camPos.x += (wantX - camPos.x) * lag;
  camPos.y += (wantY - camPos.y) * lag;
  camPos.z += (wantZ - camPos.z) * lag;
  camTarget.set(f.x - Math.sin(f.heading) * 40, f.y + Math.sin(f.pitch) * 20, f.z - Math.cos(f.heading) * 40);
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
  camera.rotation.z += f.roll * 0.35;
  const wantFov = Math.min(82, 62 + f.speed * 0.28);
  if (Math.abs(camera.fov - wantFov) > 0.05) { camera.fov += (wantFov - camera.fov) * 0.1; camera.updateProjectionMatrix(); }
}

function setCockpitMode(on) {
  cockpitMode = on;
  aircraft.setCockpitMode(on);
  firstCamera = true;
  hud.showMessage(on ? 'Cockpit view — press C for chase view' : 'Chase view — press C for cockpit', 2);
}

function syncAircraft() {
  const f = flight.state;
  aircraft.group.position.set(f.x, f.y, f.z);
  // Plane faces -Z in its own space; heading 0 is -Z in world space.
  aircraft.group.rotation.set(0, 0, 0);
  aircraft.group.rotateY(f.heading);
  aircraft.group.rotateX(-f.pitch);
  aircraft.group.rotateZ(-f.roll);
  aircraft.update(1 / 60, f.speed);
}

function announce(message) { status.textContent = message; }

function showScreen(name) {
  for (const id of ['screen-title', 'screen-paused', 'screen-over']) {
    document.getElementById(id).classList.toggle('hidden', id !== `screen-${name}`);
  }
  document.getElementById('hud').classList.toggle('hidden', name === 'title');
}

function startGame() {
  audio.ensure(); audio.click();
  missions.setup(missionId, flight);
  screen = 'play';
  showScreen('play');
  announce(`${missions.state.name}. ${missions.state.objective}`);
  hud.showMessage(missions.state.objective, 4);
}

function endGame(crashed) {
  screen = 'over';
  if (flight.state.score > best) { best = flight.state.score; saveBest(best); hud.setBest(best); }
  const overTitle = document.getElementById('over-title');
  const overText = document.getElementById('over-text');
  if (crashed) {
    overTitle.textContent = 'Crashed!';
    overText.textContent = `The plane went down over the archipelago. Score ${flight.state.score} — best ${best}.`;
    audio.crash();
  } else if (missions.state.complete) {
    overTitle.textContent = 'Mission complete!';
    overText.textContent = `Beautiful flying. Score ${flight.state.score} — best ${best}.`;
    audio.land();
  } else {
    overTitle.textContent = 'Flight over';
    overText.textContent = `Score ${flight.state.score} — best ${best}. Fuel ${Math.round(flight.state.fuel)}% left.`;
  }
  showScreen('over');
  announce(`${overTitle.textContent} Score ${flight.state.score}.`);
}

function runShot(name) {
  // Screenshot mode renders at full pixel ratio for a sharper capture.
  renderer.setPixelRatio(2);
  document.body.classList.add('shot');
  const sceneShot = stageShot(name, flight, missions, terrain.terrainHeight);
  syncAircraft();
  placeCamera(0.1);
  terrain.update(0.1);
  sky.update(0.1);
  hud.update(flight.state, missions.state, 0);
  showScreen(sceneShot.screen === 'title' ? 'title' : 'play');
  if (sceneShot.screen === 'over') {
    if (flight.state.score > best) { best = flight.state.score; saveBest(best); hud.setBest(best); }
    document.getElementById('over-title').textContent = flight.state.crashed ? 'Crashed!' : 'Mission complete!';
    document.getElementById('over-text').textContent =
      flight.state.crashed
        ? `The plane went down over the archipelago. Score ${flight.state.score}.`
        : `Landed on Pulau Karang. Score ${flight.state.score} — best ${Math.max(best, flight.state.score)}.`;
    showScreen('over');
  }
  document.getElementById('hud').classList.remove('hidden');
  let painted = 0;
  function paint() {
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0; let last = performance.now();
  let dropQueued = false;

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      hud.showMessage(muted ? 'Sound off (M to turn on)' : 'Sound on', 2);
    }
    if (actions & ACTION_DROP) dropQueued = true;
    if (actions & ACTION_COCKPIT) setCockpitMode(!cockpitMode);
    if (actions & ACTION_RESTART && screen !== 'title') { startGame(); return; }
    if (actions & ACTION_CONFIRM && (screen === 'title' || screen === 'over')) { startGame(); return; }
    if (actions & ACTION_PAUSE && screen === 'play') {
      screen = 'paused'; showScreen('paused'); announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === 'paused') {
      screen = 'play'; showScreen('play'); announce('Playing.');
    }
  }

  function step() {
    const events = flight.step(STEP, input.read());
    const dropped = dropQueued; dropQueued = false;
    missions.update(flight, events, dropped);
    audio.update(flight.state.throttle, flight.state.speed, flight.state.airborne);
    if (events & EVENT_CRASHED) { endGame(true); return; }
    if (events & EVENT_LANDED) {
      hud.showMessage('Landed!', 3);
      if (missions.state.complete) { endGame(false); return; }
      if (missions.state.id === 'landing') { endGame(false); return; }
    }
    if (events & EVENT_HARD) hud.showMessage('Hard landing — damage!', 3);
    if (flight.state.fuel <= 0 && flight.state.airborne) hud.showMessage('Out of fuel — glide to a runway!', 2);
    if (missions.state.complete && screen === 'play' && flight.state.landed) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    handleActions();
    if (screen === 'play') {
      accumulator += dt;
      while (accumulator >= STEP) { step(); accumulator -= STEP; if (screen !== 'play') { accumulator = 0; break; } }
    } else if (screen === 'title') {
      // Title backdrop: the plane sits on the home runway, clouds drift.
      flight.state.y = RUNWAYS.home.height + 2;
    }
    syncAircraft();
    placeCamera(dt);
    terrain.update(dt);
    sky.update(dt);
    hud.update(flight.state, missions.state, dt);
    renderer.render(scene, camera);
  }

  // Mission picker on the title screen.
  document.querySelectorAll('[data-mission]').forEach((button) => {
    button.addEventListener('click', () => {
      missionId = button.dataset.mission;
      document.querySelectorAll('[data-mission]').forEach((b) => b.classList.toggle('selected', b === button));
      audio.ensure(); audio.click();
      hud.showMessage(`${missions.state.name} selected — press Space to fly.`, 2);
      missions.setup(missionId, flight);
    });
  });
  document.getElementById('btn-fly').addEventListener('click', startGame);
  document.getElementById('btn-resume').addEventListener('click', () => { screen = 'play'; showScreen('play'); });
  document.getElementById('btn-restart-paused').addEventListener('click', startGame);
  document.getElementById('btn-again').addEventListener('click', startGame);
  document.getElementById('btn-title').addEventListener('click', () => { screen = 'title'; showScreen('title'); missions.setup(missionId, flight); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') { screen = 'paused'; showScreen('paused'); }
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  showScreen('title');
  announce('Nusantara Sky Run. Choose a mission and press Space to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

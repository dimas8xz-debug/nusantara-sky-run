// Terrain: a seeded archipelago — sea, three islands, a volcano, rice terraces
// and two flat runways. terrainHeight(x, z) is the single source of truth:
// the mesh, the physics ground check and the landing check all use it.
// The land wears a procedural canvas texture (sand, grass, forest speckle,
// terrace bands) multiplied by vertex colours, plus instanced trees, small
// houses and a road near the home runway, and a smoking volcano.
import * as THREE from 'three';
import { PALETTE, RUNWAYS, WORLD } from './config.js';
import { createRandom, makeNoise } from './random.js';

const ISLANDS = [
  { x: 0, z: -300, r: 900, h: 95 },    // home island, with the volcano at its edge
  { x: 1500, z: 620, r: 620, h: 70 },  // Pulau Karang, island runway
  { x: -1250, z: 750, r: 700, h: 85 }, // canyon island, terraced hills
  { x: -900, z: -1300, r: 480, h: 55 },
  { x: 1100, z: -1400, r: 420, h: 48 },
];
const VOLCANO = { x: -260, z: -760, r: 320, h: 260 };

function bump(dx, dz, r, h) {
  const d = Math.sqrt(dx * dx + dz * dz) / r;
  if (d >= 1) return 0;
  const t = 1 - d * d;
  return h * t * t;
}

function flattenNearRunway(x, z, height) {
  for (const key of Object.keys(RUNWAYS)) {
    const r = RUNWAYS[key];
    const dx = x - r.x; const dz = z - r.z;
    const along = dx * -Math.sin(r.heading) + dz * -Math.cos(r.heading);
    const across = dx * -Math.cos(r.heading) + dz * Math.sin(r.heading);
    if (Math.abs(along) < r.length / 2 + 90 && Math.abs(across) < r.width / 2 + 90) {
      const edge = Math.max(Math.abs(along) / (r.length / 2 + 90), Math.abs(across) / (r.width / 2 + 90));
      const blend = Math.min(1, Math.max(0, (edge - 0.55) / 0.45));
      return height * blend + r.height * (1 - blend);
    }
    // Approach corridor: a gentle valley on the side planes land from.
    if (along < -r.length / 2 && along > -750 && Math.abs(across) < 110) {
      const out = -along - r.length / 2;
      const slopeTarget = r.height + out * 0.06;
      const wAcross = Math.min(1, Math.max(0, (110 - Math.abs(across)) / 30));
      const wAlong = Math.min(1, out / 150);
      const w = wAcross * wAlong;
      if (w > 0) return height * (1 - w) + Math.min(height, slopeTarget) * w;
    }
  }
  return height;
}

// Procedural ground texture: speckled sand / grass / forest, drawn once on a
// canvas and tiled over the terrain so the low-poly mesh reads as ground.
function makeGroundTexture(seed) {
  const rand = createRandom(seed * 31 + 7);
  const S = 1024; // HD ground texture: four times the pixels of the old 512 one.
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#6fae56'; g.fillRect(0, 0, S, S);
  const speckles = [
    ['#5da24a', 10400, 2, 6], ['#3f7d3a', 7200, 2, 8], ['#8fbf6a', 5600, 2, 6],
    ['#e8d29a', 3600, 4, 10], ['#7a6a55', 2800, 2, 6], ['#a8c86a', 3600, 2, 4],
    ['#2f7d4a', 2400, 1, 3], ['#d8c88a', 1600, 3, 7],
  ];
  for (const [color, count, rMin, rMax] of speckles) {
    g.fillStyle = color;
    for (let i = 0; i < count; i += 1) {
      const r = rMin + rand() * (rMax - rMin);
      g.beginPath(); g.arc(rand() * S, rand() * S, r, 0, Math.PI * 2); g.fill();
    }
  }
  // Faint contour strokes, like a survey map of the hills.
  g.strokeStyle = 'rgba(40,70,40,0.16)'; g.lineWidth = 2;
  for (let i = 0; i < 40; i += 1) {
    g.beginPath();
    const y0 = rand() * S;
    g.moveTo(0, y0);
    for (let x = 0; x <= S; x += 64) g.lineTo(x, y0 + Math.sin(x * 0.01 + i) * 44);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Anisotropic filtering keeps the ground sharp when seen at a low angle.
  tex.anisotropy = 8;
  return tex;
}

function softSpriteTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 8, 128, 128, 124);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTerrain(seed) {
  const noise = makeNoise(seed);
  const noise2 = makeNoise(seed + 101);
  const noise3 = makeNoise(seed + 207);
  function terrainHeight(x, z) {
    if (Math.abs(x) > WORLD.half || Math.abs(z) > WORLD.half) return 0;
    let h = 0;
    for (const isle of ISLANDS) h += bump(x - isle.x, z - isle.z, isle.r, isle.h);
    h += bump(x - VOLCANO.x, z - VOLCANO.z, VOLCANO.r, VOLCANO.h);
    const canyon = Math.exp(-Math.pow((x + 1250) / 130, 2));
    if (z > 250 && z < 1250) h = h * (1 - canyon * 0.75) + 4 * canyon;
    // Layered noise: broad hills, medium detail, fine ripple.
    h += noise(x * 0.004, z * 0.004) * 14 + noise2(x * 0.013, z * 0.013) * 6
      + noise3(x * 0.045, z * 0.045) * 1.6;
    if (h < 2) h = Math.max(0, h - 2);
    return flattenNearRunway(x, z, Math.max(0, h));
  }

  const group = new THREE.Group();
  group.name = 'terrain';

  const size = WORLD.size; const seg = 240;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  const cSand = new THREE.Color(PALETTE.sand); const cGrass = new THREE.Color(PALETTE.grass);
  const cForest = new THREE.Color(PALETTE.forest); const cRock = new THREE.Color(PALETTE.rock);
  const cVolc = new THREE.Color(PALETTE.volcano); const cTerrace = new THREE.Color(0x9fc46a);
  const tmp = new THREE.Color(); const vary = createRandom(seed + 55);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i); const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    if (h < 3) tmp.copy(cSand);
    else if (h < 45) tmp.copy(cGrass).lerp(cForest, Math.min(1, h / 45));
    else if (h < 150) tmp.copy(cForest).lerp(cRock, (h - 45) / 105);
    else tmp.copy(cRock).lerp(cVolc, Math.min(1, (h - 150) / 110));
    if (x > -1900 && x < -600 && z > 300 && z < 1300 && h > 8 && h < 60) {
      if (Math.floor(h / 7) % 2 === 0) tmp.lerp(cTerrace, 0.45);
    }
    // Per-vertex variation so the ground is never a flat wash of colour.
    const v = 0.92 + vary() * 0.16;
    colours[i * 3] = tmp.r * v; colours[i * 3 + 1] = tmp.g * v; colours[i * 3 + 2] = tmp.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: makeGroundTexture(seed), vertexColors: true, roughness: 0.95, metalness: 0,
  }));
  land.receiveShadow = true;
  land.name = 'land';
  group.add(land);

  // Sea: standard material with a specular sheen, gently animated waves.
  const seaGeo = new THREE.PlaneGeometry(size * 1.4, size * 1.4, 48, 48);
  seaGeo.rotateX(-Math.PI / 2);
  const seaBase = seaGeo.attributes.position.array.slice();
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({
    color: PALETTE.sea, roughness: 0.25, metalness: 0.55,
    transparent: true, opacity: 0.96,
  }));
  sea.position.y = WORLD.seaLevel; sea.name = 'sea'; sea.receiveShadow = true;
  group.add(sea);

  const lava = new THREE.Mesh(
    new THREE.CircleGeometry(46, 24),
    new THREE.MeshBasicMaterial({ color: PALETTE.lava }),
  );
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(VOLCANO.x, VOLCANO.h + 2, VOLCANO.z);
  group.add(lava);

  // Volcano smoke: soft sprites rising from the crater, looping.
  const smokeTex = softSpriteTexture();
  const smoke = [];
  for (let i = 0; i < 14; i += 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTex, color: 0xd8d4cc, transparent: true, opacity: 0.5, depthWrite: false,
    }));
    s.userData.phase = i / 14;
    s.position.set(VOLCANO.x, VOLCANO.h + 10, VOLCANO.z);
    smoke.push(s); group.add(s);
  }

  // Runway strips with centre dashes.
  for (const key of Object.keys(RUNWAYS)) {
    const r = RUNWAYS[key];
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(r.length, 1.5, r.width),
      new THREE.MeshStandardMaterial({ color: PALETTE.runway, roughness: 0.9 }),
    );
    strip.position.set(r.x, r.height, r.z);
    strip.rotation.y = r.heading + Math.PI / 2;
    strip.receiveShadow = true;
    strip.name = `runway-${key}`;
    group.add(strip);
    for (let d = -r.length / 2 + 40; d < r.length / 2 - 20; d += 70) {
      const dash = new THREE.Mesh(
        new THREE.BoxGeometry(28, 0.6, 3),
        new THREE.MeshBasicMaterial({ color: PALETTE.runwayLine }),
      );
      dash.position.set(r.x - Math.sin(r.heading) * d, r.height + 1, r.z - Math.cos(r.heading) * d);
      dash.rotation.y = r.heading + Math.PI / 2;
      group.add(dash);
    }
  }

  // A road from the home runway to a small village of houses.
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(320, 0.8, 10),
    new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 1 }),
  );
  road.position.set(180, 7, -260); road.rotation.y = 0.35; road.receiveShadow = true;
  group.add(road);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf2e8d5, roughness: 0.9 });
  const roofCols = [0xb03a2a, 0x1d4e89, 0x2f7d4a, 0xe07b24, 0x8e44ad, 0xc0392b];
  const rand = createRandom(seed + 77);
  for (let i = 0; i < 9; i += 1) {
    const hx = 60 + i * 34 + (rand() - 0.5) * 14;
    const hz = -180 - i * 12 + (rand() - 0.5) * 20;
    const hy = terrainHeight(hx, hz);
    const house = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(13, 8, 11), wallMat);
    walls.position.y = 4; walls.castShadow = true;
    const roofMat = new THREE.MeshStandardMaterial({ color: roofCols[i % roofCols.length], roughness: 0.85 });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 5, 4), roofMat);
    roof.position.y = 10.5; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
    house.add(walls, roof);
    house.position.set(hx, hy, hz);
    house.rotation.y = rand() * Math.PI;
    group.add(house);
  }

  // Accents: colourful sailboats on the sea, a red-and-white lighthouse on
  // the home island's shore, a windsock by the home runway, and palm trees
  // along the beaches — small pops of colour that read from the air.
  const boats = [];
  const sailCols = [0xe63946, 0xf2c94c, 0x2a9d8f, 0x4361ee];
  const boatSpots = [[420, -620, 0.6], [760, 240, 2.1], [-420, 1080, 4.0], [1180, -420, 5.2]];
  for (let i = 0; i < boatSpots.length; i += 1) {
    const [bx, bz, heading] = boatSpots[i];
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(16, 3, 5),
      new THREE.MeshStandardMaterial({ color: 0x7a4a2b, roughness: 0.8 }),
    );
    hull.position.y = 1; hull.castShadow = true;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 14, 6), new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.9 }));
    mast.position.y = 8;
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0); sailShape.lineTo(0, 12); sailShape.lineTo(9, 0); sailShape.closePath();
    const sail = new THREE.Mesh(
      new THREE.ShapeGeometry(sailShape),
      new THREE.MeshStandardMaterial({ color: sailCols[i], side: THREE.DoubleSide, roughness: 0.7 }),
    );
    sail.position.set(0.3, 2.5, 0);
    boat.add(hull, mast, sail);
    boat.position.set(bx, WORLD.seaLevel + 0.5, bz);
    boat.rotation.y = heading;
    boat.userData.phase = i * 1.7;
    boats.push(boat);
    group.add(boat);
  }
  // Lighthouse: striped tower on the shore east of the home runway.
  const lightX = 820; const lightZ = -560;
  const lightY = terrainHeight(lightX, lightZ);
  const lighthouse = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(5 - i * 0.6, 5.6 - i * 0.6, 7, 12),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xf2f2f2 : 0xd43d2a, roughness: 0.7 }),
    );
    band.position.y = 3.5 + i * 7; band.castShadow = true;
    lighthouse.add(band);
  }
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  lamp.position.y = 31;
  lighthouse.add(lamp);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softSpriteTexture(), color: 0xffe9a8, transparent: true, opacity: 0.8, depthWrite: false,
  }));
  lampGlow.position.y = 31; lampGlow.scale.set(40, 40, 1);
  lighthouse.add(lampGlow);
  lighthouse.position.set(lightX, lightY, lightZ);
  group.add(lighthouse);
  // Windsock by the home runway.
  const sockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 16, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6 }));
  sockPole.position.set(RUNWAYS.home.x + 60, RUNWAYS.home.height + 8, RUNWAYS.home.z - 40);
  group.add(sockPole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(2.2, 9, 10, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xff7b24, side: THREE.DoubleSide, roughness: 0.7 }),
  );
  sock.rotation.z = Math.PI / 2; sock.position.set(RUNWAYS.home.x + 64, RUNWAYS.home.height + 15, RUNWAYS.home.z - 40);
  sock.castShadow = true;
  group.add(sock);
  // Palm trees along the home island's beaches.
  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 });
  const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x3a9d4a, roughness: 1 });
  const palmSpots = [[-620, -880], [-480, -960], [240, -980], [520, -1020], [-900, 220], [980, 900], [1500, 1200]];
  for (const [px, pz] of palmSpots) {
    const py = terrainHeight(px, pz);
    if (py < 2 || py > 12) continue;
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 12, 6), palmTrunkMat);
    trunk.position.y = 6; trunk.rotation.z = 0.18; trunk.castShadow = true;
    palm.add(trunk);
    for (let a = 0; a < 5; a += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 4), palmLeafMat);
      leaf.position.set(Math.cos(a * 1.26) * 3.2, 12.5, Math.sin(a * 1.26) * 3.2);
      leaf.rotation.z = Math.cos(a * 1.26) * 1.1;
      leaf.rotation.x = -Math.sin(a * 1.26) * 1.1;
      palm.add(leaf);
    }
    palm.position.set(px, py, pz);
    group.add(palm);
  }

  // Forest: instanced low-poly trees on the grassy slopes, clear of runways.
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 420 && guard < 6000) {
    guard += 1;
    const x = (rand() - 0.5) * 3800; const z = (rand() - 0.5) * 3800;
    const h = terrainHeight(x, z);
    if (h < 6 || h > 55) continue;
    let nearRunway = false;
    for (const key of Object.keys(RUNWAYS)) {
      const r = RUNWAYS[key];
      if (Math.abs(x - r.x) < 420 && Math.abs(z - r.z) < 420) { nearRunway = true; break; }
    }
    if (!nearRunway) treeSpots.push([x, h, z]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 4, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const crownGeo = new THREE.ConeGeometry(4.2, 11, 7);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeSpots.length);
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  treeSpots.forEach(([x, h, z], i) => {
    const s = 0.8 + rand() * 0.9;
    sc.set(s, s, s);
    m4.compose(new THREE.Vector3(x, h + 2 * s, z), q, sc); trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, h + (4 + 5.5) * s, z), q, sc); crowns.setMatrixAt(i, m4);
  });
  trunks.castShadow = true; crowns.castShadow = true;
  group.add(trunks, crowns);

  let time = 0;
  return {
    group, terrainHeight, volcano: VOLCANO,
    update(dt) {
      time += dt;
      // Sea swell.
      const p = seaGeo.attributes.position;
      for (let i = 0; i < p.count; i += 1) {
        const bx = seaBase[i * 3]; const bz = seaBase[i * 3 + 2];
        p.setY(i, Math.sin(bx * 0.02 + time * 0.9) * 0.55 + Math.cos(bz * 0.017 + time * 0.7) * 0.55);
      }
      p.needsUpdate = true;
      seaGeo.computeVertexNormals();
      // Boats bob on the swell; the windsock swings gently.
      for (const b of boats) {
        b.position.y = WORLD.seaLevel + 0.5 + Math.sin(time * 0.8 + b.userData.phase) * 0.4;
        b.rotation.z = Math.sin(time * 0.6 + b.userData.phase) * 0.04;
      }
      sock.rotation.y = Math.sin(time * 0.5) * 0.5;
      lampGlow.material.opacity = 0.6 + Math.sin(time * 2) * 0.2;
      // Smoke rises, spreads and fades, then loops back to the crater.
      for (const s of smoke) {
        s.userData.phase += dt * 0.03;
        if (s.userData.phase > 1) s.userData.phase = 0;
        const ph = s.userData.phase;
        s.position.set(
          VOLCANO.x + Math.sin(ph * 9) * 18 + ph * 60,
          VOLCANO.h + 12 + ph * 190,
          VOLCANO.z + ph * 30,
        );
        const scale = 26 + ph * 70;
        s.scale.set(scale, scale, 1);
        s.material.opacity = 0.55 * (1 - ph) * Math.min(1, ph * 6);
      }
    },
  };
}

export function createSky(seed) {
  const group = new THREE.Group();
  group.name = 'sky';

  // Sky dome: a golden-hour gradient, warm at the horizon, deep blue above.
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2f5d8f');
  grad.addColorStop(0.45, '#7fb2d9');
  grad.addColorStop(0.72, '#f2c98a');
  grad.addColorStop(0.85, '#f7b96a');
  grad.addColorStop(1, '#e89a5a');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(c);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(6000, 32, 20),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  group.add(dome);

  // Sun disc with a soft glow sprite.
  const sunTex = softSpriteTexture();
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTex, color: 0xffe9a8, transparent: true, opacity: 0.95, fog: false, depthWrite: false,
  }));
  sunGlow.position.set(-2600, 620, -3400);
  sunGlow.scale.set(900, 900, 1);
  group.add(sunGlow);
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(70, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }),
  );
  sun.position.copy(sunGlow.position);
  group.add(sun);

  // Layered soft clouds: many sprites at three altitudes, drifting slowly.
  const rand = createRandom(seed + 13);
  const clouds = [];
  const cloudMat = new THREE.SpriteMaterial({
    map: sunTex, color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false,
  });
  for (let i = 0; i < 64; i += 1) {
    const layer = i % 3;
    const puff = new THREE.Sprite(cloudMat.clone());
    puff.material.opacity = 0.45 + rand() * 0.4;
    const w = 180 + rand() * 260;
    puff.scale.set(w, w * (0.32 + rand() * 0.18), 1);
    puff.position.set(
      (rand() - 0.5) * WORLD.size * 1.2,
      280 + layer * 130 + rand() * 60,
      (rand() - 0.5) * WORLD.size * 1.2,
    );
    puff.userData.speed = 2 + rand() * 4;
    clouds.push(puff);
    group.add(puff);
  }
  return {
    group, clouds,
    update(dt) {
      for (const cl of clouds) {
        cl.position.x += cl.userData.speed * dt;
        if (cl.position.x > WORLD.half + 400) cl.position.x = -WORLD.half - 400;
      }
    },
  };
}

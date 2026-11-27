// The aircraft, built only from primitives in the same style as the terrain,
// but with real shaping and shading: a lathe-turned fuselage, tapered
// extruded wings, a glass canopy, a propeller that blurs into a disc at
// speed, panel lines, livery, navigation lights and landing gear.
// A small cockpit dashboard (visible in cockpit mode) sits under the canopy.
import * as THREE from 'three';
import { PALETTE } from './config.js';

function softDiscTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(200,200,200,0)');
  grad.addColorStop(0.25, 'rgba(200,200,200,0.10)');
  grad.addColorStop(0.8, 'rgba(180,180,180,0.28)');
  grad.addColorStop(1, 'rgba(160,160,160,0.05)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function dashboardTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#1c222c'; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = '#3a4552'; g.lineWidth = 2; g.strokeRect(4, 4, 504, 152);
  // Six lit round instruments.
  for (let i = 0; i < 6; i += 1) {
    const x = 48 + i * 84; const y = 80;
    g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2);
    g.fillStyle = '#0e141c'; g.fill();
    g.strokeStyle = '#8b93a3'; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2);
    g.strokeStyle = '#f2c94c'; g.lineWidth = 1; g.stroke();
    g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + Math.cos(-2 + i * 0.7) * 22, y + Math.sin(-2 + i * 0.7) * 22);
    g.strokeStyle = '#ff5a4a'; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fillStyle = '#eef1f5'; g.fill();
  }
  // Glowing switches and a red warning light.
  for (let i = 0; i < 8; i += 1) {
    g.fillStyle = i === 3 ? '#ff3b30' : '#4fc3f7';
    g.beginPath(); g.arc(420 + i * 10, 22, 4, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function taperedWing(span, chordRoot, chordTip, thickness, material) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -chordRoot / 2);
  shape.lineTo(span / 2, -chordTip / 2);
  shape.lineTo(span / 2, chordTip / 2);
  shape.lineTo(0, chordRoot / 2);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.25, bevelSegments: 2,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

export function createAircraft() {
  const group = new THREE.Group();
  group.name = 'aircraft';
  const red = new THREE.MeshStandardMaterial({ color: PALETTE.planeRed, roughness: 0.45, metalness: 0.25 });
  const white = new THREE.MeshStandardMaterial({ color: PALETTE.planeWhite, roughness: 0.4, metalness: 0.15 });
  const gold = new THREE.MeshStandardMaterial({ color: PALETTE.planeGold, roughness: 0.35, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.6, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9fd8ef, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.55,
  });
  const panelLine = new THREE.MeshStandardMaterial({ color: 0x5a2a22, roughness: 0.7 });

  // Fuselage: lathe profile — pointed spinner nose, swelling cabin, tapering tail.
  const profile = [
    [0.02, -5.9], [0.55, -5.7], [0.95, -5.0], [1.25, -3.8], [1.45, -2.0],
    [1.5, -0.5], [1.42, 1.0], [1.2, 2.4], [0.85, 3.6], [0.45, 4.4], [0.02, 4.7],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 18), white);
  body.rotation.x = Math.PI / 2; // lathe axis Y -> forward -Z
  body.castShadow = true;
  group.add(body);
  // Red nose cone and gold cheatline stripe along the fuselage.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.02, 2.0, 18), red);
  nose.rotation.x = -Math.PI / 2; nose.position.z = -5.6; nose.castShadow = true;
  group.add(nose);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.51, 1.51, 0.9, 18, 1, true), gold);
  stripe.rotation.x = Math.PI / 2; stripe.position.z = 0.6;
  group.add(stripe);
  // Panel lines: thin dark rings around the fuselage.
  for (const z of [-2.6, 0.2, 2.2]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.03, 6, 24), panelLine);
    ring.position.z = z;
    group.add(ring);
  }
  // Canopy: a stretched glass dome with a frame.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12), glass);
  canopy.scale.set(0.82, 0.62, 1.7); canopy.position.set(0, 1.05, -1.1);
  group.add(canopy);
  // (No canopy frame ring: it sat right in the pilot's eyeline in cockpit mode.)

  // Tapered main wing, gold tips; tapered tailplane and fin.
  const wing = taperedWing(13.5, 2.6, 1.5, 0.22, red);
  wing.position.set(-6.75, -0.25, -0.4);
  group.add(wing);
  const tipGeo = new THREE.BoxGeometry(0.5, 0.3, 1.5);
  for (const x of [-6.85, 6.85]) {
    const tip = new THREE.Mesh(tipGeo, gold);
    tip.position.set(x, -0.25, -0.4); tip.castShadow = true;
    group.add(tip);
  }
  const tailWing = taperedWing(5.4, 1.7, 1.0, 0.18, white);
  tailWing.position.set(-2.7, 0.35, 3.6);
  group.add(tailWing);
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0); finShape.lineTo(1.9, 0.15); finShape.lineTo(1.9, 1.9); finShape.lineTo(0.4, 2.4); finShape.closePath();
  const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.18, bevelEnabled: false }), red);
  fin.rotation.y = Math.PI / 2; // shape X becomes the chord along Z, Y stays vertical
  fin.position.set(-0.09, 0.4, 3.4); fin.castShadow = true;
  group.add(fin);

  // Propeller: hub, two shaped blades, and a translucent blur disc that
  // fades in as the engine spins up.
  const prop = new THREE.Group(); prop.position.set(0, 0, -6.1);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), dark);
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.42, 3.6, 0.12);
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Mesh(bladeGeo, dark);
    blade.rotation.z = angle; blade.castShadow = true;
    prop.add(blade);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.1, 32),
    new THREE.MeshBasicMaterial({
      map: softDiscTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  prop.add(disc);
  group.add(prop);

  // Landing gear: struts, wheels with gold hubs, and a tail wheel.
  for (const [x, z] of [[-1.15, -1.2], [1.15, -1.2]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6), dark);
    leg.position.set(x, -1.4, z); group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.32, 12), dark);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, -1.95, z); wheel.castShadow = true; group.add(wheel);
    const hubcap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 8), gold);
    hubcap.rotation.z = Math.PI / 2; hubcap.position.set(x, -1.95, z); group.add(hubcap);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 10), dark);
  tailWheel.rotation.z = Math.PI / 2; tailWheel.position.set(0, -1.1, 3.9); group.add(tailWheel);

  // Navigation lights: red left, green right, white tail strobe.
  const lightL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  lightL.position.set(-6.9, -0.2, -0.4); group.add(lightL);
  const lightR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  lightR.position.set(6.9, -0.2, -0.4); group.add(lightR);
  const lightT = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  lightT.position.set(0, 0.4, 4.7); group.add(lightT);

  // Cockpit: dashboard with lit instruments, glareshield, side panels.
  // Hidden in chase view; shown in cockpit mode.
  const cockpit = new THREE.Group();
  cockpit.name = 'cockpit';
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.5, 0.35),
    new THREE.MeshStandardMaterial({ map: dashboardTexture(), roughness: 0.6 }),
  );
  dash.position.set(0, 0.75, -2.9);
  cockpit.add(dash);
  const glare = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.18, 0.9), dark);
  glare.position.set(0, 1.55, -2.7); glare.rotation.x = 0.25;
  cockpit.add(glare);
  for (const x of [-1.7, 1.7]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 2.6), dark);
    side.position.set(x, 0.55, -1.6);
    cockpit.add(side);
  }
  cockpit.visible = false;
  group.add(cockpit);

  return {
    group, prop, disc, cockpit,
    // In cockpit mode the canopy glass and its frame would sit right in
    // front of the camera, so hide them and show the dashboard instead.
    setCockpitMode(on) {
      cockpit.visible = on;
      canopy.visible = !on;
    },
    update(dt, speed) {
      prop.rotation.z += dt * (4 + speed * 0.9);
      disc.material.opacity = Math.min(0.55, Math.max(0, (speed - 12) / 60));
      // Strobe blink.
      lightT.visible = (Math.floor(performance.now() / 700) % 2 === 0);
    },
  };
}

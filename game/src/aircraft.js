// The aircraft — a modern jet, built only from primitives, in the same
// style as the terrain: a long, sleek lathe fuselage, swept-back tapered
// wings with winglets, twin under-wing jet nacelles with glowing exhausts,
// a tall swept tail fin, a tinted glass canopy, panel lines, livery,
// navigation lights and slim landing gear.
// A small cockpit dashboard (visible in cockpit mode) sits under the canopy.
import * as THREE from 'three';
import { PALETTE } from './config.js';

function glowTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,220,140,0.95)');
  grad.addColorStop(0.35, 'rgba(255,140,40,0.55)');
  grad.addColorStop(0.8, 'rgba(255,80,20,0.18)');
  grad.addColorStop(1, 'rgba(255,60,10,0)');
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

// Full-span swept wing, symmetric about the fuselage: wide chord at the
// root (centre) tapering to a narrow chord at both tips, tips swept aft.
function sweptWing(span, chordRoot, chordTip, thickness, sweep, material) {
  const shape = new THREE.Shape();
  shape.moveTo(-span / 2, -chordTip / 2 + sweep);
  shape.lineTo(0, -chordRoot / 2);
  shape.lineTo(span / 2, -chordTip / 2 + sweep);
  shape.lineTo(span / 2, chordTip / 2 + sweep);
  shape.lineTo(0, chordRoot / 2);
  shape.lineTo(-span / 2, chordTip / 2 + sweep);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.2, bevelSegments: 2,
  });
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

export function createAircraft() {
  const group = new THREE.Group();
  group.name = 'aircraft';
  const silver = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.25, metalness: 0.55 });
  const white = new THREE.MeshStandardMaterial({ color: PALETTE.planeWhite, roughness: 0.35, metalness: 0.3 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x1d4e89, roughness: 0.35, metalness: 0.4 });
  const red = new THREE.MeshStandardMaterial({ color: PALETTE.planeRed, roughness: 0.45, metalness: 0.25 });
  const gold = new THREE.MeshStandardMaterial({ color: PALETTE.planeGold, roughness: 0.35, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.55, metalness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x1e3a55, roughness: 0.06, metalness: 0.6, transparent: true, opacity: 0.8,
  });
  const panelLine = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.7 });

  // Fuselage: long sleek lathe — pointed nose, slim cabin, tapering tail.
  const profile = [
    [0.02, -6.4], [0.45, -6.2], [0.85, -5.4], [1.15, -4.2], [1.3, -2.5],
    [1.35, -0.8], [1.3, 0.8], [1.1, 2.4], [0.8, 3.6], [0.45, 4.4], [0.02, 4.8],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), silver);
  body.rotation.x = Math.PI / 2; // lathe axis Y -> forward -Z
  body.castShadow = true;
  group.add(body);
  // Dark radome nose tip.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.82, 1.7, 18), dark);
  nose.rotation.x = -Math.PI / 2; nose.position.z = -6.1; nose.castShadow = true;
  group.add(nose);
  // Blue cheatline + gold stripe along the fuselage.
  const stripeBlue = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.36, 0.5, 20, 1, true), blue);
  stripeBlue.rotation.x = Math.PI / 2; stripeBlue.position.z = 0.9;
  group.add(stripeBlue);
  const stripeGold = new THREE.Mesh(new THREE.CylinderGeometry(1.37, 1.37, 0.16, 20, 1, true), gold);
  stripeGold.rotation.x = Math.PI / 2; stripeGold.position.z = 0.55;
  group.add(stripeGold);
  // Panel lines: thin dark rings around the fuselage.
  for (const z of [-2.6, 0.2, 2.2]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.33, 0.025, 6, 24), panelLine);
    ring.position.z = z;
    group.add(ring);
  }
  // Canopy: low, tinted, stretched glass dome.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12), glass);
  canopy.scale.set(0.75, 0.48, 2.0); canopy.position.set(0, 0.95, -1.4);
  group.add(canopy);

  // Swept main wing (low-mounted), red tips and winglets.
  const wing = sweptWing(11.5, 3.2, 1.2, 0.2, 1.8, silver);
  wing.position.set(0, -0.3, -0.3);
  group.add(wing);
  for (const x of [-5.75, 5.75]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 1.2), red);
    tip.position.set(x, -0.3, 1.35); tip.castShadow = true;
    group.add(tip);
    const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 0.9), red);
    winglet.position.set(x, 0.15, 1.6); winglet.rotation.z = x < 0 ? 0.35 : -0.35;
    winglet.castShadow = true;
    group.add(winglet);
  }
  // Swept tailplane and tall swept fin.
  const tailWing = sweptWing(4.6, 1.8, 0.9, 0.16, 1.1, white);
  tailWing.position.set(0, 0.3, 3.5);
  group.add(tailWing);
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0); finShape.lineTo(2.1, 0.15); finShape.lineTo(1.3, 2.7); finShape.lineTo(0.35, 2.8); finShape.closePath();
  const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.16, bevelEnabled: false }), red);
  fin.rotation.y = Math.PI / 2; // shape X becomes the chord along Z, Y stays vertical
  fin.position.set(-0.08, 0.4, 3.3); fin.castShadow = true;
  group.add(fin);
  const finStripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 1.6), white);
  finStripe.position.set(0, 2.2, 4.0); finStripe.rotation.x = -0.45;
  group.add(finStripe);

  // Twin jet engines under the wings: nacelle, dark intake, nozzle,
  // and a glowing exhaust disc that brightens with speed.
  const engines = new THREE.Group();
  const exhausts = [];
  const glowTex = glowTexture();
  for (const x of [-2.2, 2.2]) {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 3.4, 14), silver);
    nacelle.rotation.x = Math.PI / 2; nacelle.position.set(x, -0.75, -0.2); nacelle.castShadow = true;
    engines.add(nacelle);
    const intake = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.09, 8, 16), dark);
    intake.position.set(x, -0.75, -1.95);
    engines.add(intake);
    const intakeInner = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), dark);
    intakeInner.position.set(x, -0.75, -1.94); intakeInner.rotation.y = Math.PI;
    engines.add(intakeInner);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.42, 0.7, 14), dark);
    nozzle.rotation.x = Math.PI / 2; nozzle.position.set(x, -0.75, 1.65);
    engines.add(nozzle);
    const exhaust = new THREE.Mesh(
      new THREE.CircleGeometry(0.46, 16),
      new THREE.MeshBasicMaterial({
        map: glowTex, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    exhaust.position.set(x, -0.75, 2.02);
    engines.add(exhaust);
    exhausts.push(exhaust);
  }
  group.add(engines);
  // Pitot tube under the nose.
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), dark);
  pitot.rotation.x = Math.PI / 2; pitot.position.set(0.5, -0.9, -5.2);
  group.add(pitot);

  // Landing gear: slim struts, small wheels with gold hubs, tail wheel.
  for (const [x, z] of [[-1.0, -0.8], [1.0, -0.8]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6), dark);
    leg.position.set(x, -1.35, z); group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12), dark);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, -1.85, z); wheel.castShadow = true; group.add(wheel);
    const hubcap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 8), gold);
    hubcap.rotation.z = Math.PI / 2; hubcap.position.set(x, -1.85, z); group.add(hubcap);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10), dark);
  tailWheel.rotation.z = Math.PI / 2; tailWheel.position.set(0, -1.0, 3.9); group.add(tailWheel);

  // Navigation lights: red left, green right, white tail strobe.
  const lightL = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  lightL.position.set(-5.75, -0.25, 1.35); group.add(lightL);
  const lightR = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  lightR.position.set(5.75, -0.25, 1.35); group.add(lightR);
  const lightT = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  lightT.position.set(0, 0.4, 4.8); group.add(lightT);

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
    group, prop: engines, disc: exhausts[0], cockpit,
    // In cockpit mode the canopy glass would sit right in front of the
    // camera, so hide it and show the dashboard instead.
    setCockpitMode(on) {
      cockpit.visible = on;
      canopy.visible = !on;
    },
    update(dt, speed) {
      // Exhaust glow brightens (and flickers slightly) with speed.
      const glow = Math.min(0.85, Math.max(0.08, (speed - 10) / 55));
      const flicker = 1 + Math.sin(performance.now() / 90) * 0.08;
      for (const ex of exhausts) ex.material.opacity = glow * flicker;
      // Strobe blink.
      lightT.visible = (Math.floor(performance.now() / 700) % 2 === 0);
    },
  };
}

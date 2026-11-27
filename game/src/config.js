// Nusantara Sky Run — every tuning number in one place.
// World units are metres. The play area is a 4.4 km square of sea and islands.
export const WORLD = { size: 4400, half: 2200, seaLevel: 0, fogNear: 400, fogFar: 3200 };

export const PLANE = {
  maxSpeed: 68,        // m/s at full throttle
  cruiseSpeed: 42,
  stallSpeed: 17,      // below this the wing stops lifting and the nose drops
  accel: 14,           // m/s^2 toward the throttle target speed
  climbRate: 9,
  turnRate: 0.55,      // rad/s at full bank
  pitchRate: 0.45,
  rollRate: 1.9,
  maxPitch: 0.55,
  maxRoll: 1.1,
  fuelBurn: 0.35,      // % per second at full throttle
  fuelIdle: 0.05,
};

export const RUNWAYS = {
  home:   { x: 0,    z: -420, heading: 0,   length: 560, width: 34, height: 6,  name: 'Bandara Merpati' },
  island: { x: 1500, z: 620,  heading: 0.5, length: 480, width: 30, height: 9,  name: 'Bandara Pulau Karang' },
};

export const MISSIONS = {
  rings:   { id: 'rings',   name: 'Ring Run',       blurb: 'Fly through 8 golden rings in order over the islands.' },
  landing: { id: 'landing', name: 'Island Landing', blurb: 'Take off from Merpati, cross the sea and land gently on Pulau Karang.' },
  canyon:  { id: 'canyon',  name: 'Canyon Supply',  blurb: 'Fly low through the canyon, drop supplies, then return home.' },
};

export const RING = { count: 8, radius: 20, points: 250 };
export const SCORE = { ring: 250, gate: 150, drop: 400, landing: 1000, softLandingBonus: 500 };
export const BEST_KEY = 'nusantara-sky-run.best';
export const STEP = 1 / 60;

export const PALETTE = {
  sky: 0x8ec9e8, fog: 0xbcd9e8, sea: 0x1e6f8e, seaDeep: 0x145a78,
  sand: 0xe8d29a, grass: 0x5da24a, forest: 0x2f6b34, rock: 0x8a7f72,
  volcano: 0x5d4a42, lava: 0xe85d26, runway: 0x3a3f46, runwayLine: 0xf2f2f2,
  planeRed: 0xd43d2a, planeWhite: 0xf5f2ea, planeGold: 0xf2c94c,
  ring: 0xf2c94c, cloud: 0xffffff,
};

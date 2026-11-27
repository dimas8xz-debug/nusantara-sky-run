// HUD: a DOM overlay (so it shows in screenshots, unlike canvas text).
// Altitude, speed and heading, throttle / fuel / damage bars, mission,
// timer, score, and real instruments: round speed and altitude gauges with
// needles, a compass strip, and an artificial horizon that banks and pitches
// with the plane.
export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = {
    alt: el('hud-alt'), speed: el('hud-speed'), heading: el('hud-heading'),
    throttle: el('hud-throttle'), fuel: el('hud-fuel'), damage: el('hud-damage'),
    fuelBar: el('fuel-bar'), damageBar: el('damage-bar'), throttleBar: el('throttle-bar'),
    mission: el('hud-mission'), objective: el('hud-objective'),
    timer: el('hud-timer'), score: el('hud-score'), best: el('hud-best'),
    horizon: el('horizon'), horizonBall: el('horizon-ball'),
    message: el('hud-message'), stall: el('hud-stall'),
    needleSpeed: el('needle-speed'), needleAlt: el('needle-alt'),
    gaugeSpeedVal: el('gauge-speed-val'), gaugeAltVal: el('gauge-alt-val'),
    compassInner: el('compass-inner'),
  };
  let messageTimer = 0;

  // Compass strip: cardinal points every 45°, ticks every 15°, built once.
  // The strip is three copies wide so it can slide and wrap around 360°.
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  let stripHtml = '';
  for (let deg = -360; deg < 720; deg += 15) {
    const norm = ((deg % 360) + 360) % 360;
    const label = deg % 45 === 0 ? points[Math.round(norm / 45) % 8] : '·';
    stripHtml += `<span>${label}</span>`;
  }
  hud.compassInner.innerHTML = stripHtml;

  // Gauge tick marks around each dial.
  for (const gauge of document.querySelectorAll('.gauge')) {
    for (let a = -120; a <= 120; a += 30) {
      const tick = document.createElement('div');
      tick.className = 'tick';
      tick.style.transform = `rotate(${a}deg)`;
      gauge.appendChild(tick);
    }
  }

  function showMessage(text, seconds = 3) {
    hud.message.textContent = text;
    hud.message.style.opacity = '1';
    messageTimer = seconds;
  }
  function compass(heading) {
    const deg = ((heading * 180 / Math.PI) % 360 + 360) % 360;
    return `${String(Math.round(deg)).padStart(3, '0')}° ${points[Math.round(deg / 45) % 8]}`;
  }
  // A gauge needle sweeps -120°..+120° across its range.
  function needleAngle(value, max) {
    return -120 + 240 * Math.max(0, Math.min(1, value / max));
  }
  function update(f, mission, dt) {
    if (messageTimer > 0) {
      messageTimer -= dt;
      if (messageTimer <= 0) hud.message.style.opacity = '0';
    }
    const altFt = Math.round(f.y * 3.281);
    const speedKt = Math.round(f.speed * 1.944);
    hud.alt.textContent = `${altFt} ft`;
    hud.speed.textContent = `${speedKt} kt`;
    hud.heading.textContent = compass(f.heading);
    hud.throttle.textContent = `${Math.round(f.throttle * 100)}%`;
    hud.fuel.textContent = `${Math.round(f.fuel)}%`;
    hud.damage.textContent = `${Math.round(f.damage)}%`;
    hud.fuelBar.style.width = `${Math.max(0, f.fuel)}%`;
    hud.fuelBar.style.background = f.fuel < 25 ? '#e5534b' : '#4fc3f7';
    hud.damageBar.style.width = `${Math.max(0, f.damage)}%`;
    hud.throttleBar.style.width = `${Math.round(f.throttle * 100)}%`;
    hud.mission.textContent = mission.name;
    hud.objective.textContent = mission.objective;
    const t = Math.floor(f.elapsed);
    hud.timer.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    hud.score.textContent = String(f.score);
    hud.stall.style.display = f.stalled ? 'block' : 'none';
    // Gauges.
    hud.needleSpeed.style.transform = `rotate(${needleAngle(speedKt, 140)}deg)`;
    hud.needleAlt.style.transform = `rotate(${needleAngle(altFt, 2500)}deg)`;
    hud.gaugeSpeedVal.textContent = String(speedKt);
    hud.gaugeAltVal.textContent = String(altFt);
    // Compass strip: 60 px per 15°, centre marker stays fixed.
    const deg = ((f.heading * 180 / Math.PI) % 360 + 360) % 360;
    const pxPerDeg = 4; // 60 px / 15°
    // The heading's tick sits at (deg + 360) * 4 + 30 px inside the strip;
    // slide it to the strip's centre (170 px).
    const offset = 170 - ((deg + 360) * pxPerDeg + 30);
    hud.compassInner.style.transform = `translateX(${offset}px)`;
    // Artificial horizon: the ball rolls with the plane and slides with pitch.
    hud.horizonBall.style.transform =
      `rotate(${-f.roll}rad) translateY(${f.pitch * 90}px)`;
  }
  function setBest(best) { hud.best.textContent = String(best); }
  return { update, showMessage, setBest };
}

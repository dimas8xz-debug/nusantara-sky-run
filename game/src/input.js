// Keyboard + mouse (+ touch drag) input. Held keys give steering; one-shot
// presses (start, pause, restart, drop) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_DROP = 8;
export const ACTION_MUTE = 16;
export const ACTION_COCKPIT = 32;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let dragX = 0; let dragY = 0; let dragging = false; let lastX = 0; let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyR') actions |= ACTION_RESTART;
    else if (event.code === 'KeyE') actions |= ACTION_DROP;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'KeyC') actions |= ACTION_COCKPIT;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  // Mouse drag steers: drag left/right to bank, up/down to pitch.
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true; lastX = event.clientX; lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    dragX += event.clientX - lastX; dragY += event.clientY - lastY;
    lastX = event.clientX; lastY = event.clientY;
  });
  function endDrag() { dragging = false; dragX = 0; dragY = 0; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  return {
    read() {
      const left = keys.has('ArrowLeft') || keys.has('KeyA');
      const right = keys.has('ArrowRight') || keys.has('KeyD');
      const up = keys.has('ArrowUp');
      const down = keys.has('ArrowDown');
      let roll = (right ? 1 : 0) - (left ? 1 : 0);
      // Arcade pitch: Up climbs, Down descends; drag up climbs too.
      let pitch = (up ? 1 : 0) - (down ? 1 : 0);
      // Drag adds to the keyboard steering, then fades as the drag ends.
      if (dragging) {
        roll += Math.max(-1, Math.min(1, dragX / 120));
        pitch += Math.max(-1, Math.min(1, -dragY / 120));
        dragX *= 0.85; dragY *= 0.85;
      }
      return {
        throttleUp: keys.has('KeyW'),
        throttleDown: keys.has('KeyS'),
        roll: Math.max(-1, Math.min(1, roll)),
        pitch: Math.max(-1, Math.min(1, pitch)),
      };
    },
    takeActions() { const taken = actions; actions = 0; return taken; },
    queueDrop() { actions |= ACTION_DROP; },
  };
}

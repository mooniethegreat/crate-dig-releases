'use strict';
(() => {
  const disc = document.querySelector('.outro-record');
  const image = disc?.querySelector('img');
  if (!image) return;
  let rotation = 0, pointer = null, previous = 0, lastTime = 0, velocity = 0, frame = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const noMomentum = () => reduced.matches || window.CrateAccessibility?.motionDisabled;
  const paint = () => { image.style.transform = `rotate(${rotation}deg)`; };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; velocity = 0; };
  const angle = e => {
    const box = disc.getBoundingClientRect();
    return Math.atan2(e.clientY - box.top - box.height / 2, e.clientX - box.left - box.width / 2) * 180 / Math.PI;
  };
  disc.addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0 || pointer !== null) return;
    stop(); pointer = e.pointerId; previous = angle(e); lastTime = e.timeStamp;
    disc.setPointerCapture(pointer); disc.classList.add('dragging');
  });
  disc.addEventListener('pointermove', e => {
    if (e.pointerId !== pointer) return;
    const current = angle(e);
    const delta = ((current - previous + 540) % 360) - 180;
    velocity = Math.max(-1.5, Math.min(1.5, delta / Math.max(8, e.timeStamp - lastTime)));
    rotation += delta; previous = current; lastTime = e.timeStamp; paint();
  });
  function release(e) {
    if (e.pointerId !== pointer) return;
    pointer = null; disc.classList.remove('dragging');
    if (disc.hasPointerCapture(e.pointerId)) disc.releasePointerCapture(e.pointerId);
    if (e.type !== 'pointerup' || e.timeStamp - lastTime > 100 || noMomentum()) { stop(); return; }
    let last = performance.now();
    function coast(now) {
      const dt = Math.min(40, now - last); last = now;
      rotation += velocity * dt; velocity *= Math.pow(.94, dt / 16.67); paint();
      if (Math.abs(velocity) > .005 && !noMomentum()) frame = requestAnimationFrame(coast);
      else stop();
    }
    frame = requestAnimationFrame(coast);
  }
  ['pointerup','pointercancel','lostpointercapture'].forEach(name => disc.addEventListener(name, release));
  disc.addEventListener('dragstart', e => e.preventDefault());
  disc.addEventListener('click', e => { if (e.detail === 0) { stop(); rotation += 30; paint(); } });
  disc.addEventListener('keydown', e => {
    if (!['ArrowLeft','ArrowRight','Home'].includes(e.key)) return;
    e.preventDefault(); stop(); rotation = e.key === 'Home' ? 0 : rotation + (e.key === 'ArrowLeft' ? -15 : 15); paint();
  });
  reduced.addEventListener('change', stop);
  addEventListener('crate-a11y-change', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
})();

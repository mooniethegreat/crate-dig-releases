'use strict';
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const motionOff = () => reduced.matches || Boolean(window.CrateAccessibility?.motionDisabled);
  const $ = s => document.querySelector(s);
  const all = s => [...document.querySelectorAll(s)];
  const boot = window.CrateBoot;
  // A skipped or timed-out startup must never pop back over an already visible page.
  if (boot && !boot.active) return;
  const animations = new Set();
  const run = (el, frames, options) => {
    if (motionOff()) return Promise.resolve();
    const animation = el.animate(frames, options);
    animations.add(animation);
    return animation.finished.catch(() => {}).finally(() => animations.delete(animation));
  };
  // Animate children of the scroll-driven elements so the two timelines never fight.
  const arrivals = all('.header > *, .hero-copy > *, .record-tag, .hero-bottom > *');
  const vinyls = all('.hero-art .record img');
  const reveals = all('.statement > .eyebrow, .statement-bottom > *, .section-heading > *, .preview-tabs > button, .daw-heading, .daw-ticker, .principles > div:first-child > *, .principle-list > article, .checkout > :not(.outro-record), footer > *');
  let observer;
  if (!motionOff() && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
    }), { threshold: .12 });
    reveals.forEach((el, i) => {
      el.classList.add('reveal-pending');
      el.style.setProperty('--reveal-delay', (i % 3) * 75 + 'ms');
      observer.observe(el);
    });
  }
  const skipRoulette = motionOff() || (location.hash && location.hash !== '#top') || scrollY > 40 || !Element.prototype.animate;
  if (skipRoulette) {
    // Deep links and motion preferences still pass through the initial loader.
    Promise.allSettled([
      ...vinyls.map(img => img.decode()), document.fonts.ready, boot?.minimum()
    ]).then(() => boot?.release());
    return;
  }
  const focusBefore = document.activeElement;
  const background = all('body > *').filter(el => el.id !== 'site-boot' && !['SCRIPT', 'LINK'].includes(el.tagName));
  const oldInert = background.map(el => el.inert);
  let stopped = false, overlay, flight, watchdog, loadDeadline;
  function finish() {
    if (stopped) return;
    stopped = true;
    clearTimeout(watchdog); clearTimeout(loadDeadline);
    boot?.release();
    animations.forEach(a => a.cancel()); animations.clear();
    root.classList.remove('intro-lock');
    [...arrivals, ...vinyls].forEach(el => el.classList.remove('entrance-pending'));
    background.forEach((el, i) => { el.inert = oldInert[i]; });
    const hadFocus = overlay?.contains(document.activeElement);
    overlay?.remove(); flight?.remove();
    if (hadFocus) (focusBefore && focusBefore !== document.body ? focusBefore : $('.hero-copy .button')).focus({preventScroll:true});
    removeEventListener('keydown', key); removeEventListener('resize', finish);
  }
  function key(e) { if (e.key === 'Escape') finish(); else if (e.key === 'Tab' && !stopped) { e.preventDefault(); overlay.querySelector('button').focus(); } }
  addEventListener('crate-a11y-change', () => { if (motionOff()) { finish(); observer?.disconnect(); reveals.forEach(el => el.classList.remove('reveal-pending')); } });
  reduced.addEventListener('change', () => {
    if (motionOff()) {
      finish(); observer?.disconnect(); reveals.forEach(el => el.classList.remove('reveal-pending'));
    }
  });
  async function intro() {
    overlay = document.createElement('section');
    overlay.className = 'site-intro intro-loading';
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Crate Roulette introduction');
    overlay.innerHTML = `<div class="intro-top"><span><img src="assets/crate-dig-logo-mark.svg" alt="">CRATE DIG</span><button class="intro-skip">Skip intro ↗</button></div><div class="intro-heading"><p>CRATE ROULETTE</p><h2>Something good is <em>in here.</em></h2></div><div class="intro-lane"><div class="intro-needle"></div><div class="intro-reel" aria-hidden="true"></div></div><p class="intro-status" role="status">DIGGING THROUGH THE STACKS…</p><p class="intro-bottom">YOUR NEXT IDEA. ALREADY IN YOUR COLLECTION.</p>`;
    const loader = document.createElement('div');
    loader.className = 'intro-loader';
    loader.innerHTML = '<img src="assets/vinyl.svg" width="120" height="120" alt=""><p role="status">LOADING THE STACKS…</p>';
    overlay.append(loader);
    const names = ['Banger #67', '2021 Nostalgia', 'Final_final_v9', '3AM Bad Decisions', 'Your Next Hit'];
    // Sleeve tones from the app's static/media.css roulette cards.
    const colors = ['#aa4b20', '#23b9ea', '#d8c29d', '#b95d69', '#72858c'];
    const reel = overlay.querySelector('.intro-reel');
    for (let i = 0; i < 25; i++) {
      const n = i === 19 ? 4 : i % names.length;
      const card = document.createElement('article'); card.className = 'intro-card';
      card.style.setProperty('--sleeve', colors[n]);
      card.innerHTML = `<img src="assets/vinyl.svg" width="200" height="200" alt=""><small>FROM THE COLLECTION</small><strong>${names[n]}</strong><span>PROJECT / ${String(i + 1).padStart(2, '0')}</span>`;
      reel.append(card);
    }
    document.body.append(overlay);
    root.classList.add('intro-lock');
    background.forEach(el => { el.inert = true; });
    [...arrivals, ...vinyls].forEach(el => el.classList.add('entrance-pending'));
    // The full-screen intro now owns the loading state; hand off in this same frame.
    boot?.release();
    overlay.querySelector('button').addEventListener('click', finish);
    overlay.querySelector('button').focus({preventScroll:true});
    addEventListener('keydown', key); addEventListener('resize', finish);
    watchdog = setTimeout(finish, 13000);
    // Decode the actual visible images before starting the reel clock.
    const openingImages = [...overlay.querySelectorAll('img'), ...vinyls];
    const ready = Promise.allSettled([
      ...openingImages.map(img => img.decode()),
      document.fonts.ready,
      boot?.minimum()
    ]);
    const timedOut = await Promise.race([
      ready.then(() => false),
      new Promise(resolve => { loadDeadline = setTimeout(() => resolve(true), 6000); })
    ]);
    clearTimeout(loadDeadline);
    if (stopped) return;
    // If assets never arrive, expose the usable page instead of an empty reel.
    if (timedOut) { finish(); return; }
    const cards = [...reel.children], winner = cards[19];
    const center = card => innerWidth / 2 - card.offsetLeft - card.offsetWidth / 2;
    const start = center(cards[1]), end = center(winner);
    reel.style.transform = `translateX(${start}px)`;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (stopped) return;
    overlay.classList.remove('intro-loading');
    await run(loader, [{opacity:1},{opacity:0}], {duration:300,fill:'forwards'});
    loader.remove();
    if (stopped) return;
    watchdog = (clearTimeout(watchdog), setTimeout(finish, 6500));

    reel.style.transform = `translateX(${end}px)`;
    await run(reel, [{transform:`translateX(${start}px)`}, {transform:`translateX(${end}px)`}], {duration:2350,easing:'cubic-bezier(.08,.72,.08,1)'});
    if (stopped) return;
    winner.classList.add('selected');
    overlay.querySelector('.intro-status').innerHTML = '<strong>YOUR NEXT HIT</strong>YOU HAD IT ALL ALONG.';
    await run(winner, [{scale:1},{scale:1.035},{scale:1}], {duration:420,easing:'ease-out'});
    if (stopped) return;
    const from = winner.querySelector('img').getBoundingClientRect();
    const to = vinyls[2].getBoundingClientRect();
    flight = document.createElement('img'); flight.src = 'assets/vinyl.svg'; flight.alt = ''; flight.className = 'intro-flight';
    Object.assign(flight.style, {left:from.left+'px',top:from.top+'px',width:from.width+'px',transformOrigin:'50% 50%'});
    document.body.append(flight); winner.querySelector('img').style.opacity = '0';
    // Use the unrotated record box; the destination scroll transform is already applied.
    const parent = vinyls[2].parentElement;
    const targetWidth = parent.offsetWidth;
    const dx = to.left + to.width/2 - from.left - from.width/2;
    const dy = to.top + to.height/2 - from.top - from.height/2;
    run(overlay, [{opacity:1},{opacity:0}], {duration:650,fill:'forwards',easing:'ease-in-out'});
    await run(flight, [{transform:'translate(0,0) scale(1) rotate(0deg)'},{transform:`translate(${dx}px,${dy}px) scale(${targetWidth/from.width}) rotate(348deg)`}], {duration:800,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
    if (stopped) return;
    flight.remove(); vinyls[2].classList.remove('entrance-pending');
    const pops = vinyls.slice(0,2).map((el,i) => {
      el.classList.remove('entrance-pending');
      return run(el,[{transform:`translate(${i ? -100 : 100}px,75px) scale(.35) rotate(${i ? -35 : 35}deg)`,opacity:0},{transform:'none',opacity:1}],{duration:700,delay:i*80,fill:'backwards',easing:'cubic-bezier(.16,1,.3,1)'});
    });
    arrivals.forEach((el,i) => {
      el.classList.remove('entrance-pending');
      pops.push(run(el,[{transform:'translateY(22px)',opacity:0},{transform:'translateY(0)',opacity:1}],{duration:650,delay:Math.min(i*45,420),fill:'backwards',easing:'cubic-bezier(.22,1,.36,1)'}));
    });
    overlay.style.pointerEvents = 'none';
    await Promise.all(pops); finish();
  }
  intro().catch(finish);
})();

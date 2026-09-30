'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const all = s => [...document.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  let keyboardPreview = false;
  const motionOff = () => reduced.matches || Boolean(window.CrateAccessibility?.motionDisabled) || keyboardPreview;
  const product = $('.product'), pin = $('.product-pin'), stage = $('.product-stage');
  const heading = $('.section-heading'), controls = $('.chapter-controls');
  const origin = $('.record-origin'), record = $('.handoff-record'), dock = $('.record-dock');
  const roulette = $('.roulette-copy'), bar = $('.scroll-track span');
  const buttons = all('[data-preview]'), screens = all('[data-screen]');
  const phases = ['library', 'crates', 'roulette'];
  const descriptions = [
    'Your projects, versions, and samples. Together in one clean view.',
    'Pull your favorites into My Crates. Keep the ideas you want to finish together.',
    'Let Crate Roulette choose. Rediscover a project you might have passed over.'
  ];
  const labels = ['YOUR LIBRARY', 'MY CRATES', 'CRATE ROULETTE'];
  const clamp = n => Math.max(0, Math.min(1, n));
  const frameLoads = new Map();
  function loadFrame(url) {
    if (!frameLoads.has(url)) frameLoads.set(url, new Promise(resolve => {
      const image = new Image(); image.onload = () => resolve(true); image.onerror = () => resolve(false); image.src = url;
    }));
    return frameLoads.get(url);
  }
  function scrubFrames(target, kind, progress, count) {
    const frame = 1 + Math.round(clamp(progress) * (count - 1));
    const url = n => 'assets/roulette-frames/' + kind + '-' + String(n).padStart(2, '0') + '.webp';
    if (target.dataset.frame === String(frame)) return;
    target.dataset.frame = String(frame);
    loadFrame(url(frame)).then(loaded => { if (loaded && target.dataset.frame === String(frame)) target.src = url(frame); });
    for (let n = Math.max(1, frame - 2); n <= Math.min(count, frame + 4); n++) loadFrame(url(n));
  }
  const ease = n => n * n * (3 - 2 * n);
  let currentPhase = 0, lastScrollPhase = -1, pending = false, didDock = false;
  const themeButton = $('#theme-toggle');
  function setTheme(theme) {
    root.dataset.theme = theme;
    themeButton.textContent = theme === 'dark' ? 'Light mode ☼' : 'Dark mode ☾';
    themeButton.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    themeButton.setAttribute('aria-pressed', String(theme === 'light'));
    $('meta[name="theme-color"]').content = theme === 'dark' ? '#101210' : '#f2f3ee';
  }
  let savedTheme;
  try { savedTheme = localStorage.getItem('crate-dig-theme'); } catch {}
  setTheme(savedTheme === 'light' ? 'light' : 'dark');
  themeButton.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(theme);
    try { localStorage.setItem('crate-dig-theme', theme); } catch {}
  });
  function selectPhase(index) {
    currentPhase = index;
    buttons.forEach((b, i) => {
      b.classList.toggle('active', i === index);
      b.setAttribute('aria-pressed', String(i === index));
    });
    screens.forEach((screen, i) => {
      screen.classList.toggle('active', i === index);
      screen.setAttribute('aria-hidden', String(i !== index));
    });
    $('#preview-description').textContent = descriptions[index];
    $('#chapter-count').textContent = '0' + (index + 1) + ' / 03';
    $('#window-label').textContent = labels[index];
  }
  const chapterStops = [.19, .43, .68].map(p => p * .52);
  function goToProgress(p) {
    const y = scrollY + product.getBoundingClientRect().top + (product.offsetHeight - pin.offsetHeight) * p;
    scrollTo({ top: y, behavior: motionOff() ? 'instant' : 'smooth' });
  }
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    selectPhase(index);
    if (!motionOff()) goToProgress(chapterStops[index]);
  }));
  const rouletteDescriptions = ['Pull from your collection. Follow the needle as the reel slows down.', 'Preview your find. Pick up where inspiration left off.', 'Pull up Add to My Crates. Keep the sample with the ideas you want to finish.'];
  function selectRoulette(index) {
    all('[data-roulette-step]').forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-pressed',String(i===index));});
    all('[data-roulette-view]').forEach((el,i)=>{el.classList.toggle('shown',i===index);el.setAttribute('aria-hidden',String(i!==index));});
    if ($('#roulette-step-description').textContent !== rouletteDescriptions[index]) $('#roulette-step-description').textContent = rouletteDescriptions[index];
  }
  all('[data-roulette-step]').forEach((button, index) => button.addEventListener('click', () => {
    if (!motionOff()) goToProgress([.64,.80,.95][index]);
    else { selectPhase(2); selectRoulette(index); }
  }));
  all('a[href="#roulette"]').forEach(link => link.addEventListener('click', event => {
    if (!motionOff()) { event.preventDefault(); goToProgress(.64); }
  }));
  const wordHeading = $('.word-reveal');
  const text = wordHeading.textContent;
  wordHeading.replaceChildren(...text.split(' ').map((word, i) => {
    const span = document.createElement('span'); span.textContent = (i ? ' ' : '') + word; return span;
  }));
  const words = [...wordHeading.children], heroRecords = all('.hero-art .record');
  const track = $('.daw-track'), group = $('.daw-group');
  const duplicate = group.cloneNode(true);
  duplicate.setAttribute('aria-hidden', 'true'); track.append(duplicate);
  let tickerInView = false, tickerPaused = false;
  function syncTicker() {
    track.classList.toggle('running', tickerInView && !tickerPaused && !motionOff() && !document.hidden);
  }
  const tickerButton = $('#ticker-toggle');
  tickerButton.addEventListener('click', () => {
    tickerPaused = !tickerPaused;
    tickerButton.setAttribute('aria-pressed', String(tickerPaused));
    tickerButton.textContent = tickerPaused ? 'Play ticker ▶' : 'Pause ticker Ⅱ';
    syncTicker();
  });
  new IntersectionObserver(entries => {
    tickerInView = entries[0].isIntersecting; syncTicker();
  }).observe($('.daw-section'));
  document.addEventListener('visibilitychange', syncTicker);
  function render() {
    pending = false;
    root.classList.toggle('motion', !motionOff());
    if (motionOff()) {
      [stage, record, heading, controls, roulette, ...heroRecords, $('.outro-record')].forEach(el => {
        el.style.removeProperty('transform'); el.style.removeProperty('opacity');
      });
      roulette.inert = false; roulette.removeAttribute('aria-hidden'); controls.inert = false;
      $('.roulette-chapter').inert = false; $('.roulette-chapter').removeAttribute('aria-hidden');
      $('.roulette-chapter').style.opacity = '1';
      $('.roulette-chapter').style.removeProperty('transform');
      heading.removeAttribute('aria-hidden');
      return syncTicker();
    }
    const vh = innerHeight;
    const heroBox = $('.hero').getBoundingClientRect();
    if (heroBox.bottom > 0) {
      const p = clamp(-heroBox.top / (vh * .8)), spread = innerWidth <= 760 ? 85 : 115;
      heroRecords[0].style.transform = 'translate(' + (-spread - p * 110) + 'px,' + (23 + p * 40) + 'px) rotate(' + (-34 - p * 45) + 'deg)';
      heroRecords[1].style.transform = 'translate(' + (spread + p * 110) + 'px,' + (23 + p * 35) + 'px) rotate(' + (28 + p * 50) + 'deg)';
      heroRecords[2].style.transform = 'translateY(' + (p * 70) + 'px) rotate(' + (-12 + p * 55) + 'deg)';
    }
    const s = $('.statement').getBoundingClientRect();
    const wordProgress = clamp((vh * .8 - s.top) / (s.height * .72));
    words.forEach((word, i) => word.classList.toggle('lit', i / words.length <= wordProgress));
    const box = product.getBoundingClientRect();
    if (box.top < vh && box.bottom > 0) {
      const total = clamp(-box.top / Math.max(1, product.offsetHeight - pin.offsetHeight));
      const p = clamp(total / .52);
      const nextChapter = ease(clamp((total - .51) / .09));
      const roulettePanel = $('.roulette-chapter');
      roulettePanel.style.opacity = String(nextChapter);
      roulettePanel.inert = nextChapter < .8;
      roulettePanel.setAttribute('aria-hidden', String(nextChapter < .8));
      const rouletteStep = total < .73 ? 0 : total < .87 ? 1 : 2;
      selectRoulette(rouletteStep);
      const sampleProgress = clamp((total - .735) / .125);
      if (total > .28 && total < .735) scrubFrames($('#roulette-reel-capture'), 'reel', clamp((total - .57) / .155), 13);
      if (total > .68) scrubFrames($('#roulette-capture'), 'sample', sampleProgress, 40);
      const phase = p < .32 ? 0 : p < .57 ? 1 : 2;
      if (phase !== lastScrollPhase) { lastScrollPhase = phase; selectPhase(phase); }
      const boundaries = [0, .32, .57, .79];
      buttons.forEach((button, i) => {
        const local = clamp((p - boundaries[i]) / (boundaries[i + 1] - boundaries[i]));
        button.style.setProperty('--step-progress', String(local));
      });
      const depart = ease(clamp((p - .77) / .17));
      const carry = depart * (1 - nextChapter);
      heading.style.opacity = String(1 - depart);
      heading.setAttribute('aria-hidden', String(depart > .9));
      controls.style.opacity = String(1 - depart);
      controls.inert = depart > .9;
      heading.style.transform = 'translateY(' + (-35 * carry) + 'px)';
      controls.style.transform = 'translateY(' + (-35 * carry) + 'px)';
      const mobile = innerWidth <= 760;
      // Keep the mobile preview and copy together, using the pinned viewport's
      // actual height (Safari's browser chrome can make innerHeight different).
      const mobileGap = 24;
      const mobilePreviewHeight = Math.max(1, pin.clientHeight - roulette.offsetHeight - mobileGap - 80);
      const desiredWidth = mobile ? Math.min(pin.clientWidth * .92, mobilePreviewHeight * stage.offsetWidth / stage.offsetHeight) : Math.min(pin.clientWidth * .59, 570);
      const scale = desiredWidth / stage.offsetWidth;
      const desiredLeft = mobile ? (pin.clientWidth - desiredWidth) / 2 : pin.clientWidth - desiredWidth;
      const desiredTop = mobile ? Math.max(24, (pin.clientHeight - stage.offsetHeight * scale - mobileGap - roulette.offsetHeight) / 2) : (vh - stage.offsetHeight * scale) / 2 + 30;
      roulette.style.setProperty('--mobile-copy-top', (desiredTop + stage.offsetHeight * scale + mobileGap) + 'px');
      // The second chapter has its own heading and controls. Do not position
      // its preview using the hidden first chapter's remaining layout space.
      const chapterScale = mobile ? Math.min(1, Math.max(1, pin.clientHeight - roulettePanel.offsetHeight - mobileGap - 80) / stage.offsetHeight) : 1;
      const chapterTop = mobile ? Math.max(22, (pin.clientHeight - roulettePanel.offsetHeight - mobileGap - stage.offsetHeight * chapterScale) / 2) : roulettePanel.offsetTop;
      const chapterX = mobile ? (pin.clientWidth - stage.offsetWidth * chapterScale) / 2 - stage.offsetLeft : 0;
      const chapterY = mobile ? chapterTop + roulettePanel.offsetHeight + mobileGap - stage.offsetTop : 0;
      roulettePanel.style.transform = 'translateY(' + ((chapterTop - roulettePanel.offsetTop) * nextChapter) + 'px)';
      stage.style.transform = 'translate(' + ((desiredLeft - stage.offsetLeft) * carry + chapterX * nextChapter) + 'px,' + ((desiredTop - stage.offsetTop) * carry + chapterY * nextChapter) + 'px) scale(' + (1 + (scale - 1) * carry + (chapterScale - 1) * nextChapter) + ')';
      roulette.style.opacity = String(carry);
      roulette.style.transform = mobile ? 'translateY(' + ((1 - carry) * 55) + 'px)' : 'translateY(calc(-50% + ' + ((1 - carry) * 65) + 'px))';
      roulette.classList.toggle('visible', carry > .85);
      roulette.inert = carry < .85;
      roulette.setAttribute('aria-hidden', String(carry < .85));
      // Land on the screenshot's actual Crate Dig logo, then dissolve into it.
      const d = ease(clamp(p / .16));
      if (p < .22) {
        const from = origin.getBoundingClientRect(), to = dock.getBoundingClientRect();
        const dx = to.left + to.width / 2 - from.left - from.width / 2;
        const dy = to.top + to.height / 2 - from.top - from.height / 2;
        record.style.transform = 'translate(' + (dx * d) + 'px,' + (dy * d) + 'px) scale(' + (1 + (to.width / from.width - 1) * d) + ') rotate(' + (d * 360) + 'deg)';
      }
      record.style.opacity = String(1 - clamp((p - .15) / .035));
      if (p >= .16 && !didDock) { dock.classList.add('arrived'); didDock = true; }
      if (p < .1) { dock.classList.remove('arrived'); didDock = false; }
      bar.style.transform = 'scaleX(' + total + ')';
    }
    const end = $('.checkout').getBoundingClientRect();
    if (end.top < vh && end.bottom > 0) $('.outro-record').style.transform = 'rotate(' + (-20 + clamp((vh - end.top) / vh) * 65) + 'deg)';
  }
  function schedule() { if (!pending) { pending = true; requestAnimationFrame(render); } }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  reduced.addEventListener('change', () => { schedule(); syncTicker(); });
  addEventListener('crate-a11y-change', () => { schedule(); syncTicker(); });
  document.addEventListener('focusin', event => {
    if (root.classList.contains('a11y-keyboard') && event.target.closest?.('.product-pin') && !keyboardPreview) {
      keyboardPreview = true; root.setAttribute('data-a11y-static',''); schedule(); syncTicker();
    }
  });
  document.addEventListener('pointerdown', () => {
    if (keyboardPreview) { keyboardPreview = false; if (!window.CrateAccessibility?.motionDisabled) root.removeAttribute('data-a11y-static'); schedule(); syncTicker(); }
  });
  selectPhase(0);
  selectRoulette(0);
  render();
})();

'use strict';
(() => {
  const root = document.documentElement;
  const key = 'crate-dig-accessibility-v1';
  const defaults = {text: 1, contrast: false, grayscale: false, links: false, spacing: false, cursor: false, reduce: false, pause: false};
  let settings = {...defaults};
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    for (const name of Object.keys(defaults)) {
      if (name === 'text' && Number.isFinite(saved.text)) settings.text = Math.max(.9, Math.min(2, saved.text));
      else if (typeof saved[name] === 'boolean') settings[name] = saved[name];
    }
  } catch {}
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  window.CrateAccessibility = {
    get motionDisabled() { return settings.reduce || settings.pause || systemMotion.matches || settings.text !== 1 || settings.spacing; }
  };
  function applyAttributes() {
    for (const name of ['contrast','grayscale','links','spacing','cursor','pause']) root.toggleAttribute('data-a11y-' + name, settings[name]);
    root.toggleAttribute('data-a11y-reduce', settings.reduce || systemMotion.matches);
    root.toggleAttribute('data-a11y-readable', settings.text !== 1 || settings.spacing);
    root.toggleAttribute('data-a11y-static', window.CrateAccessibility.motionDisabled);
  }
  applyAttributes();
  const ready = () => {
    const host = document.createElement('div');
    host.className = 'a11y-ui';
    const toggles = [['contrast','High contrast'],['grayscale','Grayscale'],['links','Highlight links'],['spacing','Increase text spacing'],['cursor','Larger cursor'],['reduce','Reduce motion'],['pause','Pause animations']];
    host.innerHTML = `<button type="button" class="a11y-trigger" aria-haspopup="dialog" aria-expanded="false" aria-controls="a11y-panel">Accessibility Options</button>
      <dialog id="a11y-panel" aria-labelledby="a11y-title" aria-describedby="a11y-description">
        <div class="a11y-panel-header"><h2 id="a11y-title">Accessibility Options</h2><button type="button" data-close aria-label="Close accessibility options">×</button></div>
        <p id="a11y-description">Adjust the website’s appearance based on your preferences.</p>
        <div class="a11y-size" role="group" aria-label="Text size"><button type="button" data-size="-1">Decrease text size</button><output id="a11y-size-value" aria-live="polite">100%</output><button type="button" data-size="1">Increase text size</button></div>
        <div class="a11y-options">${toggles.map(([name,label])=>`<button type="button" data-option="${name}" aria-pressed="false">${label}<span aria-hidden="true"></span></button>`).join('')}</div>
        <p id="a11y-motion-note" class="a11y-note"></p><button type="button" class="a11y-reset">Reset all settings</button><p class="a11y-feedback" role="status"></p>
      </dialog>
      <dialog id="a11y-assistance" aria-labelledby="a11y-assistance-title"><div class="a11y-panel-header"><h2 id="a11y-assistance-title">Accessibility Assistance</h2><button type="button" data-close aria-label="Close accessibility assistance">×</button></div><p>Need assistance accessing this website? Contact us at <a href="mailto:cratedig@reply.munarmade.com">cratedig@reply.munarmade.com</a>, and we’ll be happy to assist you.</p></dialog>`;
    document.body.append(host);
    const panel = host.querySelector('#a11y-panel');
    const trigger = host.querySelector('.a11y-trigger');
    const assistance = host.querySelector('#a11y-assistance');
    const footerLink = document.createElement('a');
    footerLink.href = '#a11y-assistance'; footerLink.textContent = 'Accessibility Assistance';
    footerLink.setAttribute('aria-haspopup','dialog');
    document.querySelector('footer')?.append(footerLink);
    function wireDialog(dialog) {
      let opener;
      dialog.addEventListener('close', () => { trigger.setAttribute('aria-expanded','false'); opener?.focus({preventScroll:true}); });
      dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
      dialog.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return;
        const items = [...dialog.querySelectorAll('button:not(:disabled),a[href]')].filter(el=>el.getClientRects().length);
        const first=items[0], last=items.at(-1);
        if (e.shiftKey && document.activeElement===first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement===last) { e.preventDefault(); first.focus(); }
      });
      return from => { opener=from; dialog.showModal(); dialog.querySelector('[data-close]').focus(); };
    }
    const openPanel=wireDialog(panel), openAssistance=wireDialog(assistance);
    trigger.addEventListener('click',()=>{openPanel(trigger);trigger.setAttribute('aria-expanded','true');});
    footerLink.addEventListener('click',e=>{e.preventDefault();openAssistance(footerLink);});
    const originalSizes = new Map();
    function scaleText() {
      originalSizes.forEach((style,el)=>{if(style.value)el.style.setProperty('font-size',style.value,style.priority);else el.style.removeProperty('font-size');});
      originalSizes.clear();
      if (settings.text === 1) return;
      const nodes=[...document.querySelectorAll('body *')].filter(el=>!el.closest('.a11y-ui,svg,.site-intro') && !['SCRIPT','STYLE','LINK'].includes(el.tagName));
      const sizes=nodes.map(el=>parseFloat(getComputedStyle(el).fontSize));
      nodes.forEach((el,i)=>{originalSizes.set(el,{value:el.style.getPropertyValue('font-size'),priority:el.style.getPropertyPriority('font-size')});el.style.setProperty('font-size',sizes[i]*settings.text+'px','important');});
    }
    function sync(save=true) {
      applyAttributes(); scaleText();
      panel.querySelectorAll('[data-option]').forEach(b=>b.setAttribute('aria-pressed',String(settings[b.dataset.option])));
      panel.querySelector('#a11y-size-value').textContent = Math.round(settings.text*100)+'%';
      panel.querySelector('[data-size="-1"]').disabled=settings.text<=.9;
      panel.querySelector('[data-size="1"]').disabled=settings.text>=2;
      panel.querySelector('#a11y-motion-note').textContent=systemMotion.matches?'Your device’s reduced-motion preference is active.': 'Settings are saved only in this browser.';
      if(save)try{localStorage.setItem(key,JSON.stringify(settings));}catch{panel.querySelector('.a11y-feedback').textContent='Preferences apply now, but this browser could not save them.';}
      window.dispatchEvent(new Event('crate-a11y-change'));
    }
    panel.querySelectorAll('[data-option]').forEach(b=>b.addEventListener('click',()=>{settings[b.dataset.option]=!settings[b.dataset.option];sync();}));
    panel.querySelectorAll('[data-size]').forEach(b=>b.addEventListener('click',()=>{settings.text=Math.max(.9,Math.min(2,Math.round((settings.text+Number(b.dataset.size)*.1)*10)/10));sync();}));
    panel.querySelector('.a11y-reset').addEventListener('click',()=>{settings={...defaults};sync();panel.querySelector('.a11y-feedback').textContent='Settings reset. Your device’s motion preference is still respected.';});
    systemMotion.addEventListener('change',()=>sync(false));
    let resize; window.addEventListener('resize',()=>{clearTimeout(resize);resize=setTimeout(scaleText,150);});
    sync(false);
    document.querySelectorAll('.skip').forEach(link=>link.addEventListener('click',()=>document.querySelector('main')?.focus({preventScroll:true})));
    // Keep keyboard navigation into scroll scenes usable without changing pointer-driven animation.
    document.addEventListener('keydown',e=>{if(e.key==='Tab')root.classList.add('a11y-keyboard');},true);
    document.addEventListener('pointerdown',()=>root.classList.remove('a11y-keyboard'),true);
    document.querySelectorAll('.support-form').forEach(form=>{
      const summary=document.createElement('p'); summary.className='a11y-form-errors';summary.setAttribute('role','alert');summary.hidden=true;form.prepend(summary);
      form.addEventListener('invalid',e=>{
        const input=e.target;input.setAttribute('aria-invalid','true');
        const id=input.id+'-error';let error=document.getElementById(id);
        if(!error){error=document.createElement('span');error.id=id;error.className='a11y-field-error';input.after(error);}
        error.textContent=input.validationMessage;
        const refs=(input.getAttribute('aria-describedby')||'').split(' ').filter(Boolean);if(!refs.includes(id))refs.push(id);input.setAttribute('aria-describedby',refs.join(' '));
        summary.hidden=false;summary.textContent='Please correct the highlighted fields before sending.';
      },true);
      form.addEventListener('input',e=>{const input=e.target;if(input.validity?.valid){input.removeAttribute('aria-invalid');const error=document.getElementById(input.id+'-error');if(error)error.remove();input.setAttribute('aria-describedby',(input.getAttribute('aria-describedby')||'').split(' ').filter(id=>id!==input.id+'-error').join(' '));}if(!form.querySelector('[aria-invalid="true"]'))summary.hidden=true;});
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();

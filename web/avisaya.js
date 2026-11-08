// Avisaya: pestañas en la cabecera, animaciones que van entrando al bajar (como tasteskill.dev),
// secciones fijas que avanzan con el scroll y cuadros animados siempre en marcha y centrados.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sections = [...document.querySelectorAll('main > section[data-tab]')];
  const tabs = [...new Set(sections.map(s => s.dataset.tab)), 'contact'];
  const links = [...document.querySelectorAll('.nav__links a.nav__link[href^="#"]')];
  const alias = { top: 'inicio' };
  const tabOf = id => { id = alias[id] || id; if (tabs.includes(id)) return id; const el = document.getElementById(id); return el && el.dataset.tab ? null : null; };

  // 1. textos que entran al bajar: títulos palabra a palabra; párrafos, tarjetas y capturas suben con desenfoque
  const split = el => {
    let i = 0;
    const walk = node => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const part of child.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { frag.append(part); continue; }
            const w = document.createElement('span'); w.className = 'av-w'; w.setAttribute('aria-hidden', 'true');
            const inner = document.createElement('span'); inner.textContent = part; inner.style.setProperty('--i', i++);
            w.append(inner); frag.append(w);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      }
    };
    el.setAttribute('aria-label', el.textContent.trim());
    walk(el);
    el.classList.add('av-split');
  };
  let io = null;
  const blocks = [...sections.filter(s => !s.classList.contains('hero') && !s.classList.contains('drum')), document.querySelector('footer.closing')];
  if (!reduced && 'IntersectionObserver' in window) {
    for (const sec of blocks) {
      const h2 = sec.querySelector('h2:not(.t-label)');
      if (h2) split(h2);
      const ups = sec.querySelectorAll(':scope .section-head > p, :scope .t-lead, :scope .grid > div > p, :scope .card, :scope .app, :scope .frame, :scope .desplegables > details, :scope .faq__panel, :scope .closing__cta > .btn, :scope .rows, :scope .closing__links, :scope .todo__card, :scope .t-label, :scope .story__steps, :scope .story__stage');
      let d = 0;
      for (const u of ups) { if (u.closest('.av-up')) continue; u.classList.add('av-up'); u.style.setProperty('--d', Math.min(d++, 6)); }
    }
    document.documentElement.classList.add('av-anim');
    io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('av-in'); io.unobserve(e.target); }
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
  }
  const replay = els => {
    if (!io) return;
    const list = els.flatMap(el => [...el.querySelectorAll('.av-split, .av-up')]);
    for (const el of list) { el.classList.remove('av-in'); io.unobserve(el); }
    requestAnimationFrame(() => requestAnimationFrame(() => list.forEach(el => io.observe(el))));
  };

  // 2. pestañas: cada apartado por separado; el pie (con el contacto) va debajo de todos
  let current = null;
  const show = (tab, push) => {
    if (!tabs.includes(tab)) tab = 'inicio';
    if (tab === current) { if (lenis) lenis.scrollTo(0, { duration: 1.2 }); else scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); return; }
    current = tab;
    const shown = [];
    for (const s of sections) {
      const on = s.dataset.tab === tab;
      s.classList.toggle('av-off', !on);
      if (on) { s.removeAttribute('aria-hidden'); s.removeAttribute('inert'); shown.push(s); }
      else { s.setAttribute('aria-hidden', 'true'); s.setAttribute('inert', ''); }
    }
    const foot = document.querySelector('footer.closing');
    shown.push(foot);
    for (const a of links) {
      if (a.getAttribute('href') === '#' + tab) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true }); else scrollTo(0, 0);
    const first = shown[0];
    first.classList.remove('av-tab-in'); void first.offsetWidth; first.classList.add('av-tab-in');
    replay(shown);
    if (push) history.pushState(null, '', tab === 'inicio' ? location.pathname + location.search : '#' + tab);
    dispatchEvent(new Event('resize'));
    requestAnimationFrame(onScroll);
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = alias[a.getAttribute('href').slice(1)] || a.getAttribute('href').slice(1);
    if (!tabs.includes(id)) return;            // un ancla dentro de la pestaña: baja con suavidad
    e.preventDefault();
    show(id, true);
    const nav = document.querySelector('.nav.is-open');
    if (nav) nav.querySelector('.nav__toggle')?.click();
  });
  addEventListener('popstate', () => show(location.hash.slice(1) || 'inicio', false));

  // desplazamiento suave, como en tasteskill.dev (solo con ratón o trackpad; el móvil usa el suyo)
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, smoothWheel: true });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    document.documentElement.style.scrollBehavior = 'auto';
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]'); if (!a || e.defaultPrevented) return;
      const t = document.getElementById(a.getAttribute('href').slice(1)); if (!t) return;
      e.preventDefault(); lenis.scrollTo(t, { duration: 1.4 });
    });
  }

  // 3. secciones fijas que avanzan con el scroll
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const progress = el => { const r = el.getBoundingClientRect(); const run = r.height - innerHeight; return run > 0 ? clamp(-r.top / run, 0, 1) : 0; };
  const drum = document.querySelector('.drum');
  const items = drum ? [...drum.querySelectorAll('.drum__item')] : [];
  const count = drum?.querySelector('.drum__count b'), cap = drum?.querySelector('.drum__cap');
  const story = document.querySelector('.story');
  const steps = story ? [...story.querySelectorAll('.story__step')] : [];
  const shots = story ? [...story.querySelectorAll('.story__shot')] : [];
  const badge = story?.querySelector('.story__badge b');
  let lastDrum = -1, lastStep = -1, drumPos = 0, drumTarget = 0, drumRaf = 0;
  const paintDrum = () => {
    drumRaf = 0;
    drumPos += (drumTarget - drumPos) * 0.14;
    if (Math.abs(drumTarget - drumPos) < 0.001) drumPos = drumTarget;
    const fs = parseFloat(getComputedStyle(items[0]).fontSize) || 60;
    items.forEach((li, i) => {
      const o = i - drumPos, a = Math.abs(o);
      li.style.transform = `translateY(calc(-50% + ${(o * fs * 1.25).toFixed(2)}px)) rotateX(${clamp(-o * 22, -80, 80).toFixed(2)}deg) scale(${(1 - Math.min(a, 3) * 0.08).toFixed(4)})`;
      li.style.opacity = clamp(1 - a * 0.32, 0, 1).toFixed(3);
      li.classList.toggle('is-on', a < 0.5);
    });
    const k = Math.round(drumPos);
    if (k !== lastDrum) { lastDrum = k; if (count) count.textContent = k + 1; if (cap) { cap.style.opacity = 0; setTimeout(() => { cap.textContent = items[k].dataset.cap; cap.style.opacity = 1; }, 160); } }
    if (drumPos !== drumTarget) drumRaf = requestAnimationFrame(paintDrum);
  };
  function onScroll() {
    if (drum && !drum.classList.contains('av-off')) {
      drumTarget = progress(drum) * (items.length - 1);
      if (!drumRaf) drumRaf = requestAnimationFrame(paintDrum);
    }
    if (story && !story.classList.contains('av-off')) {
      const k = Math.min(steps.length - 1, Math.floor(progress(story) * steps.length * 0.999));
      if (k !== lastStep) {
        lastStep = k;
        steps.forEach((s, i) => s.classList.toggle('is-on', i === k));
        shots.forEach((s, i) => s.classList.toggle('is-on', i === k));
        if (badge) badge.textContent = k + 1;
      }
    }
  }
  let ticking = false;
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); }); } }, { passive: true });
  addEventListener('resize', onScroll);

  show((alias[location.hash.slice(1)] || location.hash.slice(1)) || 'inicio', false);
  onScroll();

  // 4. cuadros animados centrados en su recuadro (a la altura de su primera imagen)
  const centre = () => {
    for (const c of document.querySelectorAll('.stage.av-stage > .av-c')) {
      const stage = c.parentElement, h = c.offsetHeight, H = stage.clientHeight;
      if (!H || !h) continue;
      c.style.setProperty('--top', Math.max(16, (H - h) / 2) + 'px');
    }
  };
  addEventListener('resize', centre);
  addEventListener('load', centre);
  setTimeout(centre, 800);

  // 5. los cuadros se mueven siempre (también en el móvil)
  if (reduced) return;

  // chat y lista: la historia entera, despacio, y vuelta a empezar (solo mientras se ven)
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const seen = new WeakMap();
  const vis = new IntersectionObserver(es => es.forEach(e => seen.set(e.target, e.isIntersecting)), { threshold: 0.15 });
  const whenSeen = async el => { while (!seen.get(el) || el.closest('.av-off')) await sleep(250); };
  const chatLoop = async root => {
    vis.observe(root);
    const body = root.querySelector('.ui-chat__body');
    const rows = [...body.children].filter(el => el.matches('.ui-msg, .ui-chat__day'));
    const ph = root.querySelector('.ui-chat__ph'), ph0 = ph ? ph.textContent : '', send = root.querySelector('.ui-chat__send');
    const typing = document.createElement('div'); typing.className = 'av-typing'; typing.innerHTML = '<i></i><i></i><i></i>';
    for (;;) {
      rows.forEach(r => r.classList.add('is-hidden'));
      await sleep(500); await whenSeen(root);
      for (const r of rows) {
        await whenSeen(root);
        if (r.matches('.ui-msg--me') && ph) {
          const text = r.textContent.trim(); ph.classList.add('is-typing');
          for (let i = 1; i <= text.length; i += 2) { ph.textContent = text.slice(0, i); await sleep(28); }
          await sleep(350); send?.classList.add('is-press'); await sleep(180); send?.classList.remove('is-press');
          ph.textContent = ph0; ph.classList.remove('is-typing');
          r.classList.remove('is-hidden'); await sleep(900);
        } else if (r.matches('.ui-msg--bot')) {
          r.before(typing); await sleep(1500); typing.remove();
          r.classList.remove('is-hidden'); await sleep(900);
        } else { r.classList.remove('is-hidden'); await sleep(600); }
      }
      await sleep(3200);
    }
  };
  const checksLoop = async root => {
    vis.observe(root);
    const items = [...root.querySelectorAll('.ui-check')], bar = root.querySelector('[data-checks-bar]'), count = root.querySelector('[data-checks-count]');
    const c0 = count ? count.textContent : '';
    const set = n => { if (bar) bar.style.setProperty('--k', n / items.length); if (count) count.textContent = c0.replace(/\d+/, String(n)); };
    for (;;) {
      items.forEach(i => i.classList.remove('is-done', 'is-now')); set(0); root.classList.remove('is-fading');
      await sleep(700); await whenSeen(root);
      for (let n = 0; n < items.length; n++) {
        await whenSeen(root);
        items[n].classList.add('is-now', 'is-done'); set(n + 1);
        await sleep(1000); items[n].classList.remove('is-now'); await sleep(150);
      }
      await sleep(2600); root.classList.add('is-fading'); await sleep(600);
    }
  };
  document.querySelectorAll('[data-av="chat"]').forEach(chatLoop);
  document.querySelectorAll('[data-av="checks"]').forEach(checksLoop);
  const frags = [...document.querySelectorAll('[data-ui]')];
  let tries = 0;
  const wake = async () => {
    if (frags.some(f => !f.__ui) && tries++ < 60) return setTimeout(wake, 250);
    const ui = (await import(new URL('assets/ui/ui.js', document.baseURI).href)).default;
    for (const f of frags) {
      const still = f.closest('[data-ui-still]');
      if (!still && f.__ui) continue;
      document.querySelectorAll('[data-ui-still]').forEach(el => { if (el === f || el.contains(f)) el.removeAttribute('data-ui-still'); });
      if (f.__ui) { try { f.__ui.destroy(); } catch {} f.__ui = null; }
      let opts = {}; try { opts = JSON.parse(f.dataset.uiOpts || '{}'); } catch {}
      ui.start(f, opts);
    }
    setTimeout(centre, 300);
  };
  wake();
})();

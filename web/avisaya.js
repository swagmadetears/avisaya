// Avisaya: un apartado por pestaña (elegido en la cabecera), textos que entran y cuadros que se mueven siempre.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const panels = [...document.querySelectorAll('main > section[id], footer.closing[id]')];
  const ids = panels.map(p => p.id);
  const links = [...document.querySelectorAll('.nav__links a.nav__link[href^="#"]')];
  const alias = { top: 'inicio' };

  // 1. textos que entran: los títulos palabra a palabra, el resto sube poco a poco
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
  if (!reduced && 'IntersectionObserver' in window) {
    for (const sec of panels) {
      if (sec.classList.contains('hero')) continue;
      const h2 = sec.querySelector('h2');
      if (h2 && !h2.closest('[data-moment]')) split(h2);
      const ups = sec.querySelectorAll(':scope .section-head > p, :scope .t-lead, :scope .grid > div > p, :scope .card, :scope .app, :scope .frame, :scope .desplegables > details, :scope .faq__panel, :scope .closing__cta > .btn, :scope .rows, :scope .closing__links');
      let d = 0;
      for (const u of ups) { if (u.closest('.av-up')) continue; u.classList.add('av-up'); u.style.setProperty('--d', Math.min(d++, 6)); }
    }
    document.documentElement.classList.add('av-anim');
    io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('av-in'); io.unobserve(e.target); }
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
  }
  const replay = panel => {
    if (!io) return;
    for (const el of panel.querySelectorAll('.av-split, .av-up')) { el.classList.remove('av-in'); io.unobserve(el); }
    requestAnimationFrame(() => requestAnimationFrame(() => { for (const el of panel.querySelectorAll('.av-split, .av-up')) io.observe(el); }));
  };

  // 2. pestañas: solo se ve el apartado elegido
  let current = null;
  const show = (id, push) => {
    id = alias[id] || id;
    if (!ids.includes(id)) id = 'inicio';
    if (id === current) { scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); return; }
    current = id;
    for (const p of panels) {
      const on = p.id === id;
      p.classList.toggle('av-off', !on);
      if (on) { p.removeAttribute('aria-hidden'); p.removeAttribute('inert'); }
      else { p.setAttribute('aria-hidden', 'true'); p.setAttribute('inert', ''); }
    }
    for (const a of links) {
      if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
    const panel = document.getElementById(id);
    scrollTo(0, 0);
    panel.classList.remove('av-tab-in'); void panel.offsetWidth; panel.classList.add('av-tab-in');
    replay(panel);
    if (push) history.pushState(null, '', id === 'inicio' ? location.pathname + location.search : '#' + id);
    dispatchEvent(new Event('resize'));
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (!ids.includes(alias[id] || id)) return;
    e.preventDefault();
    show(id, true);
    const nav = document.querySelector('.nav.is-open');
    if (nav) nav.querySelector('.nav__toggle')?.click();
  });
  addEventListener('popstate', () => show(location.hash.slice(1) || 'inicio', false));
  show(location.hash.slice(1) || 'inicio', false);

  // 3. los cuadros se mueven siempre (también en el móvil): se vuelven a arrancar sin «quieto»
  if (reduced) return;
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
  };
  wake();
})();

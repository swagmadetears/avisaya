// Avisaya: la sección actual en la cabecera y los textos que entran al llegar a cada sección.
(() => {
  const nav = document.querySelector('.nav');
  const links = [...document.querySelectorAll('.nav__links a.nav__link[href^="#"]')];
  const targets = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);

  // 1. la cabecera marca la sección que ocupa el centro de la pantalla
  const mark = () => {
    const mid = window.innerHeight * 0.45;
    let cur = null;
    for (const t of targets) { const r = t.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) cur = t; }
    for (const a of links) {
      if (cur && a.getAttribute('href') === '#' + cur.id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  };
  let ticking = false;
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; mark(); }); } }, { passive: true });
  addEventListener('resize', mark);
  mark();

  // 2. textos que entran (nunca con «reducir movimiento»)
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

  // parte un título en palabras, cada una sube desde su máscara; respeta los <span> de dentro
  const split = el => {
    let i = 0;
    const walk = node => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const part of child.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { frag.append(part); continue; }
            const w = document.createElement('span'); w.className = 'av-w';
            const inner = document.createElement('span'); inner.textContent = part; inner.style.setProperty('--i', i++);
            w.append(inner); frag.append(w);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      }
    };
    el.setAttribute('aria-label', el.textContent.trim());
    walk(el);
    for (const w of el.querySelectorAll('.av-w')) w.setAttribute('aria-hidden', 'true');
    el.classList.add('av-split');
  };

  const blocks = [];
  for (const sec of document.querySelectorAll('main > section:not(.hero), footer.closing')) {
    const h2 = sec.querySelector('h2');
    if (h2 && !h2.closest('[data-moment]')) split(h2);
    const ups = sec.querySelectorAll(':scope .section-head > p, :scope .t-lead, :scope .grid > div > p, :scope .card, :scope .app, :scope .frame, :scope .desplegables > details, :scope .faq__panel, :scope .closing__cta > .btn, :scope .rows');
    let d = 0;
    for (const u of ups) { if (u.closest('.av-up')) continue; u.classList.add('av-up'); u.style.setProperty('--d', Math.min(d++, 6)); }
    blocks.push(sec);
  }
  document.documentElement.classList.add('av-anim');

  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('av-in'); io.unobserve(e.target); }
  }, { threshold: 0, rootMargin: '0px 0px -18% 0px' });
  for (const el of document.querySelectorAll('.av-split, .av-up')) io.observe(el);
})();

// La app Avisaya en movimiento, hecha con HTML: cuatro pantallas (nuevo parte, lista del técnico,
// el parte del técnico y el detalle) que se animan despacio, como si alguien la estuviese usando.
// En la portada, los cuatro móviles cuentan un parte a la vez; en «Así llega una avería», un móvil
// enseña el paso en el que estás.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const I = {
    drop: svg('<path d="M12 3c-3.3 4-5.5 7.1-5.5 10.2a5.5 5.5 0 0 0 11 0C17.5 10.1 15.3 7 12 3z"/>'),
    zap: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
    snow: svg('<path d="M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17M9 4l3 2 3-2M9 20l3-2 3 2"/>'),
    tv: svg('<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    bed: svg('<path d="M3 19v-7h18v7M3 15h18M6 12V9h5v3"/>'),
    warn: svg('<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/>'),
    building: svg('<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-4h4v4"/>'),
    x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    send: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
    check: svg('<path d="M5 12.5l4.2 4.2L19 7"/>'),
    alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16h.01"/>'),
    wrench: svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>'),
    inbox: svg('<path d="M3 13h5l1 3h6l1-3h5M5 5h14l2 8v6H3v-6z"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
    go: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  };
  const tiles = [['Fontanería', I.drop, '#dfeafb', '#2f6fd6'], ['Electricidad', I.zap, '#fdf1d6', '#d99a0b'], ['Climatización', I.snow, '#d9f1f3', '#0e9aa7'],
    ['TV / WiFi', I.tv, '#ece4fb', '#7c4ddb'], ['Cerraduras', I.lock, '#e6eae9', '#4f5d59'], ['Mobiliario', I.bed, '#f6e7da', '#b06a35'], ['Otro', I.warn, '#e6eae9', '#5a6b66']];
  const STATES = {
    avisado: { tag: 'AVISADO', n: 1, c: '#d93a2b' },
    camino: { tag: 'TÉCNICO DE CAMINO', n: 2, c: '#2563c9' },
    reparando: { tag: 'REPARANDO', n: 3, c: '#c26a12' },
    resuelto: { tag: 'RESUELTO', n: 4, c: '#1e8a5a' },
  };
  const steps = () => `<div class="ph__steps"><span></span><span></span><span></span><span></span></div>
    <div class="ph__stepnames"><span>Avisado</span><span>De camino</span><span>Reparando</span><span>Resuelto</span></div>`;

  const scene1 = () => `<div class="ph__scene" data-s="1">
    <div class="ph1__head"><div class="ph1__kicker">NUEVO PARTE</div><div class="ph1__title">¿Qué hay que arreglar?</div>
      <span class="ph__chip">${I.building}Hotel Sol Playa</span><span class="ph1__x">${I.x}</span></div>
    <div class="ph__pad">
      <div class="ph__label">Habitación o zona</div>
      <div class="ph__box ph1__room" data-f="room"><span data-t></span><i class="ph__caret"></i></div>
      <div class="ph__label">Tipo de avería</div>
      <div class="ph1__tiles">${tiles.map(([t, ic, bg, fg]) => `<div class="ph1__tile" data-tile="${t}"><span class="ph1__ico" style="background:${bg};color:${fg}">${ic}</span>${t}</div>`).join('')}</div>
      <div class="ph__label">Qué pasa</div>
      <div class="ph__box ph1__desc" data-f="desc"><span><span data-t></span><i class="ph__caret"></i></span></div>
    </div>
    <div class="ph1__send">${I.send}Enviar a Hotel Sol Playa</div>
    <div class="ph__toast">${I.check}Parte enviado al técnico</div>
  </div>`;

  const card = (hab, type, ico, what, state, extra = '') => `<div class="ph__card is-urgent ${extra}" style="--c:${STATES[state].c}">
      <div class="ph__row"><div class="ph__hab"><div><small>HAB.</small><b>${hab}</b></div></div>
        <div><div class="ph__type"><i>${ico}</i>${type}</div><div class="ph__tags"><span class="ph__tag st-${state}" data-tag>${STATES[state].tag}</span><span class="ph__tag ph__tag--urg">URGENTE</span></div></div></div>
      <div class="ph__what">${what}</div>${steps()}</div>`;

  const scene2 = () => `<div class="ph__scene" data-s="2">
    <div class="ph__banner is-urg" data-banner><i>${I.alert}</i><div><div class="app"><span>AVISAYA</span><span>AHORA</span></div>
      <b>Urgente · Hotel Sol Playa · Hab. 312</b><span class="t">Climatización — El aire acondicionado hace mucho ruido y no enfría</span></div></div>
    <div class="ph__top"><div class="ph__hello">Buenos días,</div><div class="ph__name">Javi · Mantenimiento</div></div>
    <div class="ph__stats">
      <div class="ph__stat"><i style="background:#fde8e5;color:#d93a2b">${I.inbox}</i><div><b data-n="pend">1</b><span>Sin asignar</span></div></div>
      <div class="ph__stat"><i style="background:#fde8e5;color:#d93a2b">${I.alert}</i><div><b data-n="urg">1</b><span>Urgentes</span></div></div>
      <div class="ph__stat"><i style="background:#e3ecfb;color:#2563c9">${I.user}</i><div><b data-n="mios">0</b><span>Míos</span></div></div>
      <div class="ph__stat"><i style="background:#e0f2e9;color:#1e8a5a">${I.check}</i><div><b data-n="hechos">0</b><span>Hechos hoy</span></div></div>
    </div>
    <div class="ph__search">${I.search}Buscar habitación, avería, nombre…</div>
    <div class="ph__chips"><span class="is-on">Por hacer</span><span>Míos</span><span>Todos</span></div>
    <div class="ph__list">
      ${card('312', 'Climatización', I.snow, 'El aire acondicionado hace mucho ruido y no enfría', 'avisado', 'ph__card--new')}
      ${card('108', 'Fontanería', I.drop, 'Fuga en el lavabo', 'avisado')}
    </div>
  </div>`;

  const scene3 = () => `<div class="ph__scene" data-s="3">
    <div class="ph4__head"><div class="ph4__code">PT-DF35DF88 · HOTEL SOL PLAYA</div><div class="ph4__title">Tu parte</div><span class="ph1__x">${I.x}</span></div>
    <div class="ph__list" style="margin-top:1em">${card('312', 'Climatización', I.snow, 'El aire acondicionado hace mucho ruido y no enfría', 'avisado')}</div>
    <div class="ph3__btn" data-btn><em>Voy para allá</em><span class="ph__tap"></span></div>
    <div class="ph3__info">
      <div><span>Avisó</span><b>Lucía (Recepción)</b></div>
      <div><span>Hora del aviso</span><b>09:12</b></div>
      <div><span>Prioridad</span><b style="color:#d93a2b">Urgente</b></div>
      <div><span>Habitación bloqueada</span><b>No</b></div>
    </div>
  </div>`;

  const hist = [['Lucía (Recepción) abre el parte', '07/11/2026, 09:12'], ['Javi va de camino', '07/11/2026, 09:18'], ['Javi empieza la reparación', '07/11/2026, 09:27'], ['Javi lo marca resuelto', '07/11/2026, 09:59']];
  const scene4 = () => `<div class="ph__scene" data-s="4">
    <div class="ph4__head"><div class="ph4__code">PT-DF35DF88</div><div class="ph4__title">Detalle del parte</div><span class="ph1__x">${I.x}</span></div>
    <div class="ph4__rows">
      <div><span>Tipo de avería</span><b>Climatización</b></div>
      <div><span>Prioridad</span><b>Urgente</b></div>
      <div><span>Avisó</span><b>Lucía (Recepción)</b></div>
      <div><span>Técnico</span><b data-v="tec">—</b></div>
      <div><span>Resuelto</span><b data-v="res">—</b></div>
    </div>
    <div class="ph4__times">
      <div><span>Hasta que salió el técnico</span><b data-v="t1">—</b></div>
      <div><span>Reparación</span><b data-v="t2">—</b></div>
      <div><span>Total</span><b data-v="t3">—</b></div>
    </div>
    <div class="ph4__hist"><h4>Historial</h4><ol>${hist.map(([a, b]) => `<li><b>${a}</b><small>${b}</small></li>`).join('')}</ol></div>
  </div>`;

  const phone = (cls, inner) => `<div class="ph ${cls}"><div class="ph__body"><div class="ph__screen"><div class="ph__notch"></div>${inner}</div></div></div>`;

  // pequeñas herramientas de animación, que se cancelan cuando la escena vuelve a empezar
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const typer = async (box, text, ms, alive) => {
    const t = box.querySelector('[data-t]'); box.classList.add('is-typing');
    for (let i = 1; i <= text.length; i++) { if (!alive()) return; t.textContent = text.slice(0, i); await sleep(ms); }
    await sleep(250); box.classList.remove('is-typing');
  };
  const countTo = async (el, to, suffix, alive) => {
    for (let v = 0; v <= to; v += Math.max(1, Math.round(to / 18))) { if (!alive()) return; el.textContent = v + suffix; await sleep(40); }
    el.textContent = to + suffix;
  };
  const bump = (el, v) => { el.textContent = v; el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump'); };
  const setState = (cardEl, s) => {
    const st = STATES[s]; cardEl.style.setProperty('--c', st.c);
    const tag = cardEl.querySelector('[data-tag]'); tag.className = `ph__tag st-${s}`; tag.textContent = st.tag;
    cardEl.querySelectorAll('.ph__steps span').forEach((x, i) => x.classList.toggle('is-on', i < st.n));
    cardEl.querySelectorAll('.ph__stepnames span').forEach((x, i) => x.classList.toggle('is-on', i === st.n - 1));
  };

  // cada pantalla: volver al principio y sus pasos
  const ctl = {
    1: root => ({
      reset() {
        root.querySelectorAll('[data-t]').forEach(t => (t.textContent = ''));
        root.querySelectorAll('.ph1__tile').forEach(t => t.classList.remove('is-on'));
        root.querySelector('.ph1__send').classList.remove('is-ready', 'is-press');
        root.querySelector('.ph__toast').classList.remove('is-on');
      },
      async play(alive) {
        await sleep(500); if (!alive()) return;
        await typer(root.querySelector('[data-f="room"]'), '312', 160, alive); if (!alive()) return;
        await sleep(450); root.querySelector('[data-tile="Climatización"]').classList.add('is-on');
        await sleep(700); if (!alive()) return;
        await typer(root.querySelector('[data-f="desc"]'), 'El aire acondicionado hace mucho ruido y no enfría', 42, alive); if (!alive()) return;
        const send = root.querySelector('.ph1__send'); send.classList.add('is-ready');
        await sleep(650); send.classList.add('is-press'); await sleep(220); send.classList.remove('is-press');
        await sleep(200); root.querySelector('.ph__toast').classList.add('is-on');
      },
      final() { root.querySelector('[data-f="room"] [data-t]').textContent = '312'; root.querySelector('[data-tile="Climatización"]').classList.add('is-on');
        root.querySelector('[data-f="desc"] [data-t]').textContent = 'El aire acondicionado hace mucho ruido y no enfría'; root.querySelector('.ph1__send').classList.add('is-ready'); },
    }),
    2: root => {
      const nw = root.querySelector('.ph__card--new'), banner = root.querySelector('[data-banner]');
      const n = k => root.querySelector(`[data-n="${k}"]`);
      return {
        reset() { nw.classList.remove('is-in', 'is-settled'); banner.classList.remove('is-on'); setState(nw, 'avisado');
          n('pend').textContent = '1'; n('urg').textContent = '1'; n('mios').textContent = '0'; n('hechos').textContent = '0';
          root.querySelectorAll('.ph__card:not(.ph__card--new)').forEach(c => setState(c, 'avisado')); },
        async play(alive) {
          await sleep(300); if (!alive()) return;
          banner.classList.add('is-on'); await sleep(700); if (!alive()) return;
          bump(n('pend'), 2); await sleep(250); bump(n('urg'), 2);
          await sleep(500); nw.classList.add('is-in');
          await sleep(2300); if (!alive()) return; banner.classList.remove('is-on');
          await sleep(900); nw.classList.add('is-settled');
        },
        state(s) { setState(nw, s); if (s === 'camino') { bump(n('pend'), 1); bump(n('mios'), 1); } if (s === 'resuelto') { bump(n('mios'), 0); bump(n('hechos'), 1); bump(n('urg'), 1); } },
        final() { nw.classList.add('is-in', 'is-settled'); n('pend').textContent = '2'; n('urg').textContent = '2'; },
      };
    },
    3: root => {
      const c = root.querySelector('.ph__card'), btn = root.querySelector('[data-btn]'), label = btn.querySelector('em'), tap = btn.querySelector('.ph__tap');
      const look = { avisado: ['Voy para allá', '#e4561b'], camino: ['Empezar a reparar', '#2563c9'], reparando: ['Marcar resuelto', '#1e8a5a'], resuelto: ['Resuelto', '#9aa8a4'] };
      const paint = s => { setState(c, s); label.style.opacity = 0; setTimeout(() => { label.textContent = look[s][0]; label.style.opacity = 1; }, 220); btn.style.setProperty('--b', look[s][1]); };
      return {
        reset() { setState(c, 'avisado'); label.textContent = look.avisado[0]; label.style.opacity = 1; btn.style.setProperty('--b', look.avisado[1]); },
        async tapTo(s, alive) {
          if (!alive()) return; tap.classList.remove('is-on'); void tap.offsetWidth; tap.classList.add('is-on');
          btn.classList.add('is-press'); await sleep(200); btn.classList.remove('is-press'); paint(s);
        },
        final() { setState(c, 'camino'); label.textContent = look.camino[0]; btn.style.setProperty('--b', look.camino[1]); },
      };
    },
    4: root => {
      const li = [...root.querySelectorAll('.ph4__hist li')], v = k => root.querySelector(`[data-v="${k}"]`);
      return {
        reset() { li.forEach(l => l.classList.remove('is-on')); ['tec', 'res', 't1', 't2', 't3'].forEach(k => (v(k).textContent = '—')); },
        async step(i, alive) {
          if (!alive()) return; li[i].classList.add('is-on');
          if (i === 1) { v('tec').textContent = 'Javi'; await countTo(v('t1'), 6, ' min', alive); }
          if (i === 3) { v('res').textContent = '07/11/2026, 09:59'; await countTo(v('t2'), 32, ' min', alive); await countTo(v('t3'), 47, ' min', alive); }
        },
        final() { li.forEach(l => l.classList.add('is-on')); v('tec').textContent = 'Javi'; v('res').textContent = '07/11/2026, 09:59'; v('t1').textContent = '6 min'; v('t2').textContent = '32 min'; v('t3').textContent = '47 min'; },
      };
    },
  };

  // en pantalla y en la pestaña visible
  const seen = new WeakMap();
  const io = new IntersectionObserver(es => es.forEach(e => seen.set(e.target, e.isIntersecting)), { threshold: 0.2 });
  const visible = el => seen.get(el) && !el.closest('.av-off');
  const untilVisible = async el => { while (!visible(el)) await sleep(250); };

  // portada: los cuatro móviles cuentan un parte entero, sincronizados
  const hero = document.querySelector('[data-phones="hero"]');
  if (hero) {
    hero.innerHTML = phone('ph--1', scene1()) + phone('ph--2', scene2()) + phone('ph--3', scene3()) + phone('ph--4', scene4());
    const s = [null, ...[1, 2, 3, 4].map(k => ctl[k](hero.querySelector(`[data-s="${k}"]`)))];
    io.observe(hero);
    if (reduced) { s[1].final(); s[2].final(); s[3].final(); s[4].final(); }
    else (async () => {
      const alive = () => true;
      for (;;) {
        s.forEach(c => c && c.reset()); hero.classList.remove('is-reset');
        await untilVisible(hero);
        await s[1].play(alive);
        s[2].play(alive); await sleep(400); await s[4].step(0, alive);
        await sleep(2600); await untilVisible(hero);
        await s[3].tapTo('camino', alive); s[2].state('camino'); await s[4].step(1, alive);
        await sleep(2600); await untilVisible(hero);
        await s[3].tapTo('reparando', alive); s[2].state('reparando'); await s[4].step(2, alive);
        await sleep(2600); await untilVisible(hero);
        await s[3].tapTo('resuelto', alive); s[2].state('resuelto'); await s[4].step(3, alive);
        await sleep(4200);
        hero.classList.add('is-reset'); await sleep(800);
      }
    })();
  }

  // «Así llega una avería»: un móvil, una pantalla por paso, que se repite mientras estás en él
  const one = document.querySelector('[data-phones="story"]');
  if (one) {
    one.innerHTML = phone('ph--story', scene1() + scene2() + scene3() + scene4());
    const scenes = [1, 2, 3, 4].map(k => one.querySelector(`[data-s="${k}"]`));
    const s = scenes.map((el, i) => ctl[i + 1](el));
    io.observe(one);
    let gen = 0;
    const solo = async (k, my) => {
      const alive = () => my === gen;
      for (;;) {
        s[k].reset(); if (k === 2) s[1].reset(); if (k === 3) s[3].reset();
        await sleep(500); await untilVisible(one); if (!alive()) return;
        if (k === 0) await s[0].play(alive);
        if (k === 1) await s[1].play(alive);
        if (k === 2) { await sleep(700); await s[2].tapTo('camino', alive); }
        if (k === 3) { for (let i = 0; i < 4; i++) { await s[3].step(i, alive); await sleep(700); } }
        if (!alive()) return; await sleep(3200); if (!alive()) return;
      }
    };
    window.AvPhones = {
      show(k) {
        scenes.forEach((el, i) => { el.style.opacity = i === k ? 1 : 0; el.style.zIndex = i === k ? 2 : 1; });
        const my = ++gen;
        if (reduced) { s[k].final(); return; }
        solo(k, my);
      },
    };
    window.AvPhones.show(0);
  }
})();

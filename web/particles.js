// Fondo de partículas muy difuminadas: flotan despacio detrás de toda la web y se apartan
// con suavidad al paso del ratón (o del dedo). Un solo <canvas> fijo, a la resolución justa.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas');
  cv.className = 'av-particles'; cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  const ctx = cv.getContext('2d');

  // una mancha de luz pintada una vez y reutilizada (naranja y blanco cálido)
  const sprite = (r, g, b) => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(.25, `rgba(${r},${g},${b},.45)`);
    gr.addColorStop(.6, `rgba(${r},${g},${b},.08)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return c;
  };
  const SPR = [sprite(228, 86, 27), sprite(255, 140, 80), sprite(255, 236, 214), sprite(120, 190, 175)];

  let W = 0, H = 0, dpr = 1, parts = [];
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: false };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const make = () => {
    const n = Math.round(Math.min(90, Math.max(36, (W * H) / 26000)));
    parts = Array.from({ length: n }, () => {
      const big = Math.random() < 0.24;
      const z = rnd(0.3, 1);                                    // profundidad: lo lejano es más pequeño, lento y tenue
      return {
        x: rnd(0, W), y: rnd(0, H), vx: rnd(-0.12, 0.12) * z, vy: rnd(-0.18, -0.03) * z,
        r: big ? rnd(80, 180) : rnd(8, 30) * z, z, a: big ? rnd(0.09, 0.17) : rnd(0.25, 0.65) * z,
        s: SPR[big ? (Math.random() < 0.7 ? 0 : 1) : Math.floor(Math.random() * (Math.random() < 0.15 ? 4 : 3))],
        ox: 0, oy: 0, ph: rnd(0, Math.PI * 2), sp: rnd(0.0004, 0.0012),
      };
    });
  };
  const size = () => {
    dpr = Math.min(1.5, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!parts.length) make();
  };
  size();
  addEventListener('resize', () => { const n = parts.length; size(); if (Math.abs(n - (W * H) / 26000) > 20) make(); });
  addEventListener('pointermove', e => { mouse.tx = e.clientX; mouse.ty = e.clientY; if (!mouse.on) { mouse.x = mouse.tx; mouse.y = mouse.ty; mouse.on = true; } }, { passive: true });
  addEventListener('mouseout', e => { if (!e.relatedTarget) { mouse.on = false; mouse.tx = mouse.ty = -9999; } });

  let last = performance.now(), scrollY0 = scrollY;
  const frame = now => {
    const dt = Math.min(48, now - last); last = now;
    mouse.x += (mouse.tx - mouse.x) * 0.08; mouse.y += (mouse.ty - mouse.y) * 0.08;
    const dy = (scrollY - scrollY0) * 0.15; scrollY0 = scrollY;     // al bajar, las partículas se mueven un poco (parallax)
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      p.ph += p.sp * dt;
      p.x += (p.vx + Math.cos(p.ph) * 0.08 * p.z) * dt * 0.06;
      p.y += (p.vy + Math.sin(p.ph * 0.8) * 0.06 * p.z) * dt * 0.06 - dy * p.z;
      // el ratón las aparta con suavidad; vuelven solas a su sitio
      const dx = p.x + p.ox - mouse.x, dyy = p.y + p.oy - mouse.y, d2 = dx * dx + dyy * dyy, R = 240;
      if (mouse.on && d2 < R * R) {
        const d = Math.sqrt(d2) || 1, f = (1 - d / R) ** 2 * 26 * (0.4 + p.z);
        p.ox += (dx / d) * f * 0.12; p.oy += (dyy / d) * f * 0.12;
      }
      p.ox *= 0.94; p.oy *= 0.94;
      const m = p.r * 2;
      if (p.y < -m) p.y = H + m; if (p.y > H + m) p.y = -m;
      if (p.x < -m) p.x = W + m; if (p.x > W + m) p.x = -m;
      // cerca del ratón brillan un poco más
      const glow = mouse.on ? Math.max(0, 1 - Math.sqrt(d2) / 320) * 0.35 : 0;
      ctx.globalAlpha = Math.min(1, p.a + glow * p.z);
      ctx.drawImage(p.s, p.x + p.ox - p.r, p.y + p.oy - p.r, p.r * 2, p.r * 2);
    }
    ctx.globalAlpha = 1;
    if (!document.hidden) requestAnimationFrame(frame);
  };
  if (reduced) { frame(performance.now()); return; }
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); requestAnimationFrame(frame); } });
})();

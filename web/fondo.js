// Fondo del cuerpo de la web: grandes masas de color muy difuminadas que se mueven despacio, como un
// degradado que va cambiando, y que se acercan un poco al ratón (o al dedo). Se pinta a poca resolución
// y se difumina con CSS, así cuesta muy poco.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas');
  cv.className = 'av-bg'; cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  const ctx = cv.getContext('2d');
  const SCALE = 0.18;                       // se pinta pequeño: el difuminado hace el resto

  // masas: color, tamaño (en fracción de la pantalla), trayectoria lenta y cuánto las atrae el ratón
  const blobs = [
    { c: [228, 86, 27], a: 0.5, r: 0.5, cx: 0.25, cy: 0.35, ax: 0.22, ay: 0.18, sx: 1 / 31, sy: 1 / 23, ph: 0.0, pull: 0.18 },
    { c: [150, 52, 14], a: 0.45, r: 0.6, cx: 0.75, cy: 0.7, ax: 0.2, ay: 0.2, sx: 1 / 37, sy: 1 / 29, ph: 1.7, pull: 0.1 },
    { c: [255, 138, 76], a: 0.32, r: 0.38, cx: 0.65, cy: 0.25, ax: 0.25, ay: 0.15, sx: 1 / 19, sy: 1 / 27, ph: 3.1, pull: 0.3 },
    { c: [16, 70, 62], a: 0.6, r: 0.6, cx: 0.15, cy: 0.85, ax: 0.18, ay: 0.12, sx: 1 / 41, sy: 1 / 33, ph: 4.4, pull: 0.06 },
    { c: [70, 24, 8], a: 0.5, r: 0.45, cx: 0.5, cy: 0.5, ax: 0.3, ay: 0.25, sx: 1 / 47, sy: 1 / 39, ph: 2.3, pull: 0.12 },
  ];

  let W = 0, H = 0;
  const size = () => {
    W = Math.max(1, Math.round(innerWidth * SCALE)); H = Math.max(1, Math.round(innerHeight * SCALE));
    cv.width = W; cv.height = H;
  };
  size(); addEventListener('resize', size);

  const m = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, k: 0, tk: 0 };
  addEventListener('pointermove', e => { m.tx = e.clientX / innerWidth; m.ty = e.clientY / innerHeight; m.tk = 1; }, { passive: true });
  addEventListener('mouseout', e => { if (!e.relatedTarget) m.tk = 0; });

  const t0 = performance.now();
  const draw = now => {
    const t = (now - t0) / 1000;
    m.x += (m.tx - m.x) * 0.03; m.y += (m.ty - m.y) * 0.03; m.k += (m.tk - m.k) * 0.03;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0a0e0d'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const D = Math.sqrt(W * H) * 1.1;   // tamaño según el área: igual de suave en móvil y en ordenador
    for (const b of blobs) {
      let x = b.cx + Math.sin(t * Math.PI * 2 * b.sx + b.ph) * b.ax;
      let y = b.cy + Math.cos(t * Math.PI * 2 * b.sy + b.ph * 1.3) * b.ay;
      x += (m.x - x) * b.pull * m.k; y += (m.y - y) * b.pull * m.k;     // el ratón las atrae con suavidad
      const r = b.r * D * (1 + Math.sin(t * 0.21 + b.ph) * 0.12);        // respiran un poco
      const g = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, r);
      const [R, G, B] = b.c;
      g.addColorStop(0, `rgba(${R},${G},${B},${b.a})`);
      g.addColorStop(0.45, `rgba(${R},${G},${B},${b.a * 0.45})`);
      g.addColorStop(1, `rgba(${R},${G},${B},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (!reduced && !document.hidden) requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !reduced) requestAnimationFrame(draw); });
})();

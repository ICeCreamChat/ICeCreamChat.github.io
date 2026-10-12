// An analytic phase illustration, not a numerical reproduction of a paper.
export function initWave() {
  const canvas = document.querySelector('#wave-canvas');
  const context = canvas?.getContext('2d');
  if (!context) return;
  const stage = canvas.closest('.wave-stage');
  const range = document.querySelector('#wave-number');
  const output = document.querySelector('#wave-number-value');
  const armsButton = document.querySelector('#wave-arms');
  const motionButton = document.querySelector('#wave-motion');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const size = matchMedia('(max-width: 680px)').matches ? 240 : 320;
  canvas.width = canvas.height = size;
  const frame = context.createImageData(size, size);
  const radii = new Float32Array(size * size);
  const angles = new Float32Array(size * size);
  const edge = new Float32Array(size * size);
  let phase = 0;
  let arms = 1;
  let waveNumber = 5;
  let playing = !reducedMotion.matches;
  let inView = true;
  let request = null;
  let lastTime = 0;
  const cyan = [104, 215, 210];
  const amber = [236, 193, 128];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      const nx = (x + .5 - size / 2) / (size * .455);
      const ny = (size / 2 - y - .5) / (size * .455);
      radii[index] = Math.hypot(nx, ny);
      angles[index] = Math.atan2(ny, nx);
      edge[index] = Math.min(1, Math.max(0, (1 - radii[index]) * 18));
    }
  }
  function draw() {
    const pixels = frame.data;
    for (let i = 0; i < radii.length; i++) {
      const offset = i * 4;
      if (!edge[i]) { pixels[offset + 3] = 0; continue; }
      const value = Math.sin(2 * Math.PI * waveNumber * radii[i] + arms * angles[i] - phase);
      const strength = Math.pow(Math.abs(value), 5) * (.42 + .58 * Math.min(1, radii[i] * 6));
      const color = value > 0 ? cyan : amber;
      pixels[offset] = 12 + (color[0] - 12) * strength;
      pixels[offset + 1] = 30 + (color[1] - 30) * strength;
      pixels[offset + 2] = 50 + (color[2] - 50) * strength;
      pixels[offset + 3] = 255 * edge[i];
    }
    context.putImageData(frame, 0, 0);
    context.strokeStyle = '#96c0cd20';
    context.lineWidth = .7;
    [ .25, .5, .75 ].forEach(radius => {
      context.beginPath();
      context.arc(size / 2, size / 2, size * .455 * radius, 0, Math.PI * 2);
      context.stroke();
    });
    context.fillStyle = '#eef4fa';
    context.beginPath(); context.arc(size / 2, size / 2, 1.8, 0, Math.PI * 2); context.fill();
  }
  function tick(now) {
    request = null;
    if (!playing || document.hidden || !inView) { lastTime = 0; return; }
    if (!lastTime || now - lastTime >= 50) {
      const elapsed = lastTime ? Math.min(now - lastTime, 100) / 1000 : 0;
      phase += elapsed * .6;
      draw();
      lastTime = now;
    }
    request = requestAnimationFrame(tick);
  }
  function updateMotion() {
    motionButton.textContent = playing ? '暂停' : '播放';
    motionButton.setAttribute('aria-pressed', String(playing));
    motionButton.setAttribute('aria-label', playing ? '暂停螺旋波动画' : '播放螺旋波动画');
    if (request !== null) { cancelAnimationFrame(request); request = null; }
    lastTime = 0;
    if (playing && !document.hidden && inView) request = requestAnimationFrame(tick);
  }
  range.addEventListener('input', () => {
    waveNumber = Number(range.value);
    output.value = waveNumber.toFixed(1);
    canvas.setAttribute('aria-label', `波数 ${waveNumber.toFixed(1)}、${arms === 1 ? '单' : '双'}旋臂螺旋波相位示意图`);
    draw();
  });
  armsButton.addEventListener('click', () => {
    arms = arms === 1 ? 2 : 1;
    armsButton.textContent = arms === 1 ? '双旋臂' : '单旋臂';
    armsButton.setAttribute('aria-pressed', String(arms === 2));
    canvas.setAttribute('aria-label', `波数 ${waveNumber.toFixed(1)}、${arms === 1 ? '单' : '双'}旋臂螺旋波相位示意图`);
    draw();
  });
  motionButton.addEventListener('click', () => { playing = !playing; updateMotion(); });
  reducedMotion.addEventListener('change', () => { playing = !reducedMotion.matches; updateMotion(); });
  document.addEventListener('visibilitychange', updateMotion);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      updateMotion();
    }, { threshold: .05 }).observe(canvas);
  }
  draw();
  stage.classList.add('is-ready');
  document.querySelector('.wave-interaction').hidden = false;
  updateMotion();
}

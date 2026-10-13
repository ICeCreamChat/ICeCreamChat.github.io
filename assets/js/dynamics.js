import { defaults, SpiralModel, CollectiveModel } from './models.js';

const models = {
  spiral: {
    name: '螺旋波', file: 'spiral-wave', title: '螺旋波的相位结构',
    description: '波纹密度决定螺旋的疏密，臂数改变螺旋结构。点击图形可以移动波心。',
    equation: 'u(r, θ, t) = sin(2πkr + mθ − ωt)',
    note: '用解析相位场展示螺旋的几何结构，不求解具体的反应扩散方程。这里的模型演示不代表论文中的数值结果。',
    hint: '点击或触摸图形移动波心；聚焦图形后，也可使用方向键。', reset: '恢复初始', scale: '相位场 u', range: '−1 至 1'
  },
  turing: {
    name: '图灵斑图', file: 'turing-pattern', title: '扩散如何产生斑点',
    description: '两种物质的扩散速度不同，小扰动可以生长成斑图。先看形成后的斑点，或点“重新扰动”观察形成过程。',
    equation: '∂ₜu = 0.16∇²u + 0.2(0.1 − u + u²v)\n∂ₜv = Dᵥ∇²v + 0.2(0.9 − u²v)',
    note: 'Schnakenberg 反应扩散模型。均匀平衡点为 (1, 0.9)，边界相连。改参数后，从相同扰动演化到 t = 264，便于比较。颜色固定对应 u = 0 至 4，超出色阶的值按端点着色。这里的演示不代表论文中的数值结果。',
    hint: '颜色表示物质 u 的浓度；边界相连。重新扰动后，点击开始演化。', reset: '重新扰动', scale: '浓度 u', range: '0 至 4'
  },
  collective: {
    name: '集群行为', file: 'collective-motion', title: '从局部对齐到集体运动',
    description: '每个粒子跟随邻域内的平均方向，同时受到噪声影响。箭头表示朝向，虚线圈标出一个粒子的对齐邻域。',
    equation: 'θᵢ(t+1) = arg Σⱼ∈Nᵢ eⁱᶿʲ⁽ᵗ⁾ + ηξᵢ\nxᵢ(t+1) = xᵢ(t) + v₀(cos θᵢ, sin θᵢ)',
    note: 'Vicsek 模型。ξ 在 [−1/2, 1/2] 内均匀取值，速度固定为 0.006，边界相连。改参数后，从相同初始状态演化 240 步。方向一致度是所有单位方向向量的平均长度。这里的演示不代表论文中的数值结果。',
    hint: '粒子离开一侧后从另一侧进入。点“打散方向”，再观察它们重新对齐。', reset: '打散方向', scale: '箭头表示朝向', range: '周期边界'
  }
};

export function initDynamics() {
  const canvas = document.querySelector('#dynamics-canvas');
  const context = canvas?.getContext('2d');
  if (!context) return;
  const lab = document.querySelector('#dynamics-lab');
  const selectButtons = [...document.querySelectorAll('[data-dynamics]')];
  const fieldsets = [...document.querySelectorAll('[data-model-controls]')];
  const play = document.querySelector('#model-play');
  const step = document.querySelector('#model-step');
  const reset = document.querySelector('#model-reset');
  const status = document.querySelector('#model-status');
  const loading = document.querySelector('#plot-loading');
  const metric = document.querySelector('#model-metric');
  const bitmap = document.createElement('canvas');
  const bitmapContext = bitmap.getContext('2d');
  const parameters = Object.fromEntries(Object.entries(defaults).map(([name, values]) => [name, { ...values }]));
  let selected = 'spiral', seed = 330, revision = 0;
  let model = new SpiralModel(parameters.spiral);
  let field, fieldSize, modelTime = 0;
  let worker, workerFailed = false, warming = false, pending = false;
  let running = false, animationId, lastFrame = 0, parameterTimer;
  let colors;

  function readColors() {
    const style = getComputedStyle(document.documentElement);
    const rgb = name => style.getPropertyValue(name).trim().match(/[\da-f]{2}/gi).map(hex => parseInt(hex, 16));
    colors = {
      low: rgb('--plot-low'), middle: rgb('--plot-mid'), high: rgb('--plot-high'),
      background: style.getPropertyValue('--surface').trim(),
      grid: style.getPropertyValue('--line').trim(),
      ink: style.getPropertyValue('--text').trim(), accent: style.getPropertyValue('--cyan').trim()
    };
  }
  function paintField(values, size, min, max) {
    if (bitmap.width !== size) { bitmap.width = size; bitmap.height = size; }
    const pixels = bitmapContext.createImageData(size, size);
    for (let i = 0; i < values.length; i++) {
      const value = Math.max(0, Math.min(1, (values[i] - min) / (max - min)));
      const from = value < .5 ? colors.low : colors.middle;
      const to = value < .5 ? colors.middle : colors.high;
      const weight = value < .5 ? value * 2 : (value - .5) * 2;
      for (let channel = 0; channel < 3; channel++) pixels.data[i * 4 + channel] = Math.round(from[channel] + weight * (to[channel] - from[channel]));
      pixels.data[i * 4 + 3] = 255;
    }
    bitmapContext.putImageData(pixels, 0, 0);
    context.imageSmoothingEnabled = true;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  function render() {
    const width = canvas.width;
    context.fillStyle = colors.background;
    context.fillRect(0, 0, width, width);
    if (selected === 'spiral') {
      paintField(model.field(), 192, -1, 1);
      context.strokeStyle = colors.ink;
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(model.center.x * width, model.center.y * width, 4, 0, Math.PI * 2);
      context.stroke();
      metric.textContent = `t = ${model.time.toFixed(2)} s`;
      canvas.setAttribute('aria-label', `螺旋波相位场，${parameters.spiral.arms} 条螺旋臂，波纹密度 ${parameters.spiral.density}；方向键移动波心`);
    } else if (selected === 'turing') {
      if (field) {
        paintField(field, fieldSize, 0, 4);
        let min = Infinity, max = -Infinity;
        for (const value of field) { min = Math.min(min, value); max = Math.max(max, value); }
        metric.textContent = `u：${min.toFixed(2)}–${max.toFixed(2)} / t = ${modelTime.toFixed(1)}`;
        canvas.setAttribute('aria-label', `图灵斑图，浓度 u 从 ${min.toFixed(2)} 到 ${max.toFixed(2)}，时间 ${modelTime.toFixed(1)}`);
      }
    } else {
      context.strokeStyle = colors.grid; context.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        context.beginPath(); context.moveTo(width * i / 4, 0); context.lineTo(width * i / 4, width); context.stroke();
        context.beginPath(); context.moveTo(0, width * i / 4); context.lineTo(width, width * i / 4); context.stroke();
      }
      context.strokeStyle = colors.accent;
      context.setLineDash([4, 5]); context.beginPath();
      context.arc(model.x[0] * width, model.y[0] * width, parameters.collective.radius * width, 0, Math.PI * 2);
      context.stroke(); context.setLineDash([]);
      context.fillStyle = colors.accent;
      for (let i = 0; i < model.x.length; i++) {
        context.save(); context.translate(model.x[i] * width, model.y[i] * width); context.rotate(model.angle[i]);
        context.beginPath(); context.moveTo(6, 0); context.lineTo(-4, 3.5); context.lineTo(-2, 0); context.lineTo(-4, -3.5); context.closePath(); context.fill();
        context.restore();
      }
      metric.textContent = `方向一致度 ${model.order.toFixed(3)} / ${model.steps} 步`;
      canvas.setAttribute('aria-label', `集群行为，${model.x.length} 个粒子，方向一致度 ${model.order.toFixed(3)}`);
    }
  }
  function pause(message = '已暂停，可以调参或继续演化。') {
    running = false;
    cancelAnimationFrame(animationId);
    play.textContent = '开始演化'; play.setAttribute('aria-pressed', 'false');
    step.disabled = warming || (selected === 'turing' && workerFailed);
    status.textContent = message;
  }
  function evolve() {
    if (selected === 'turing') {
      if (!pending && !warming && !workerFailed) {
        pending = true; worker.postMessage({ type: 'step', id: revision });
      }
    } else { model.advance(); render(); }
  }
  function tick(timestamp) {
    if (!running) return;
    if (timestamp - lastFrame >= 1000 / 30) { lastFrame = timestamp; evolve(); }
    animationId = requestAnimationFrame(tick);
  }
  function ensureWorker() {
    if (worker || workerFailed) return;
    try {
      worker = new Worker(new URL('./dynamics-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        if (data.id !== revision || selected !== 'turing') return;
        if (data.type === 'progress') { loading.textContent = `正在计算斑图… ${data.progress}%`; return; }
        field = data.field; fieldSize = data.size; modelTime = data.time;
        const wasWarming = warming;
        warming = false; pending = false; loading.hidden = true;
        lab.removeAttribute('aria-busy');
        play.disabled = false; reset.disabled = false; step.disabled = running;
        render();
        if (wasWarming) status.textContent = modelTime === 0 ? '已重新扰动，点击开始演化观察斑图形成。' : '斑图计算完成，已暂停。可调参比较或继续演化。';
      };
      worker.onerror = event => { event.preventDefault(); failWorker(); };
    } catch { failWorker(); }
  }
  function failWorker() {
    workerFailed = true; worker?.terminate(); worker = undefined;
    if (selected !== 'turing') return;
    warming = false; pending = false; field = undefined; loading.hidden = true;
    lab.removeAttribute('aria-busy');
    pause('斑图计算不可用，请观看下面的模型视频。其他模型仍可交互。');
    const fallback = document.querySelector('#dynamics-fallback');
    fallback.src = 'assets/img/turing-pattern-poster.png';
    fallback.alt = '图灵斑图模型的静态示意，当前计算不可用';
    fallback.hidden = false; canvas.hidden = true;
    metric.textContent = '静态预览，计算不可用';
    play.disabled = true; step.disabled = true; reset.disabled = true;
  }
  function prepareTuring(steps = 6600) {
    ensureWorker();
    if (workerFailed) { failWorker(); return; }
    revision++;
    warming = true; pending = false;
    pause('正在根据参数计算斑图…');
    play.disabled = true; step.disabled = true; reset.disabled = true;
    loading.hidden = false; loading.textContent = '正在计算斑图…';
    lab.setAttribute('aria-busy', 'true');
    worker.postMessage({ type: 'init', id: revision, parameters: parameters.turing, seed, steps });
  }
  function updateOutput(input) {
    const value = Number(input.value);
    const formats = {
      density: () => value.toFixed(1), arms: () => String(value), speed: () => `${value.toFixed(1)} rad/s`,
      diffusion: () => value.toFixed(1), perturbation: () => value.toFixed(3),
      noise: () => `${value.toFixed(1)} rad`, radius: () => value.toFixed(2), count: () => String(value)
    };
    const formatted = formats[input.dataset.param]();
    document.querySelector(`#${input.id}-value`).value = formatted;
    input.setAttribute('aria-valuetext', formatted);
  }
  function select(name) {
    clearTimeout(parameterTimer);
    pause('已暂停，可以调参或开始演化。');
    revision++; worker?.postMessage({ type: 'cancel', id: revision });
    selected = name; warming = false; pending = false; loading.hidden = true;
    canvas.hidden = false; document.querySelector('#dynamics-fallback').hidden = true;
    lab.removeAttribute('aria-busy'); lab.dataset.model = name;
    play.disabled = false; step.disabled = false; reset.disabled = false;
    const info = models[name];
    selectButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.dynamics === name)));
    fieldsets.forEach(fieldset => { fieldset.hidden = fieldset.dataset.modelControls !== name; });
    for (const [id, content] of Object.entries({ 'model-title': info.title, 'model-description': info.description, 'model-equation': info.equation, 'model-note': info.note, 'plot-hint': info.hint, 'plot-scale-label': info.scale, 'plot-scale-range': info.range })) document.getElementById(id).textContent = content;
    reset.textContent = info.reset;
    const videoLink = document.querySelector('#model-video-link');
    videoLink.href = `assets/media/${info.file}.mp4`; videoLink.textContent = `观看${info.name}视频`;
    canvas.tabIndex = name === 'spiral' ? 0 : -1;
    canvas.setAttribute('aria-label', `${info.name}模型示意`);
    if (name === 'spiral') model = new SpiralModel(parameters.spiral);
    if (name === 'collective') { model = new CollectiveModel(parameters.collective, seed); model.advance(240); }
    if (name === 'turing') { field = undefined; metric.textContent = '等待计算'; prepareTuring(); }
    render();
  }

  selectButtons.forEach(button => button.addEventListener('click', () => {
    if (selected !== button.dataset.dynamics) {
      select(button.dataset.dynamics);
      const url = new URL(location.href);
      if (selected === 'spiral') url.searchParams.delete('model');
      else url.searchParams.set('model', selected);
      history.replaceState(null, '', url);
    }
  }));
  document.querySelectorAll('[data-param]').forEach(input => {
    updateOutput(input);
    input.addEventListener('input', () => {
      parameters[selected][input.dataset.param] = Number(input.value);
      updateOutput(input);
      if (selected === 'spiral') { model.parameters = { ...parameters.spiral }; render(); }
      if (selected === 'collective') {
        pause('已按新参数演化 240 步。可继续演化，或打散方向重新观察。');
        model = new CollectiveModel(parameters.collective, seed); model.advance(240); render();
      }
      if (selected === 'turing') {
        clearTimeout(parameterTimer);
        revision++; worker?.postMessage({ type: 'cancel', id: revision });
        warming = true; pending = false; pause('参数已更新，正在计算斑图…');
        play.disabled = true; step.disabled = true; reset.disabled = true;
        loading.hidden = false; loading.textContent = '正在计算斑图…';
        lab.setAttribute('aria-busy', 'true');
        parameterTimer = setTimeout(() => prepareTuring(), 140);
      }
    });
  });
  play.addEventListener('click', () => {
    if (running) { pause(); return; }
    running = true; lastFrame = 0; step.disabled = true;
    play.textContent = '暂停演化'; play.setAttribute('aria-pressed', 'true');
    status.textContent = '正在演化。可随时暂停；离开演示区时会自动暂停。';
    animationId = requestAnimationFrame(tick);
  });
  step.addEventListener('click', () => { evolve(); status.textContent = '已前进一步，保持暂停。'; });
  reset.addEventListener('click', () => {
    pause();
    if (selected === 'spiral') {
      parameters.spiral = { ...defaults.spiral };
      fieldsets[0].querySelectorAll('input').forEach(input => { input.value = parameters.spiral[input.dataset.param]; updateOutput(input); });
      model = new SpiralModel(parameters.spiral); render(); status.textContent = '波心与参数已恢复初始值。';
    } else if (selected === 'turing') { seed++; prepareTuring(0); }
    else { seed++; model = new CollectiveModel(parameters.collective, seed); render(); status.textContent = '方向已打散。点击开始演化，观察局部对齐。'; }
  });
  canvas.addEventListener('pointerdown', event => {
    if (selected !== 'spiral') return;
    const bounds = canvas.getBoundingClientRect();
    model.center = { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
    render(); canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('keydown', event => {
    if (selected !== 'spiral' || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const directions = { ArrowLeft: [-.025, 0], ArrowRight: [.025, 0], ArrowUp: [0, -.025], ArrowDown: [0, .025] };
    const [dx, dy] = directions[event.key];
    model.center.x = Math.max(0, Math.min(1, model.center.x + dx));
    model.center.y = Math.max(0, Math.min(1, model.center.y + dy)); render();
  });
  document.addEventListener('themechange', () => { readColors(); render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) pause('页面已离开，演化已暂停。'); });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => { if (event.matches && running) pause('已按减少动态效果设置暂停。'); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting && running) pause('已离开演示区，演化已暂停。');
    }, { threshold: .05 }).observe(canvas);
  }
  window.addEventListener('pagehide', event => { pause(); if (!event.persisted) worker?.terminate(); });
  document.querySelector('.dynamics-tabs').hidden = false;
  document.querySelector('.parameter-controls').hidden = false;
  document.querySelector('#dynamics-fallback').hidden = true;
  canvas.hidden = false;
  const requestedModel = new URL(location.href).searchParams.get('model');
  readColors(); select(Object.hasOwn(models, requestedModel) ? requestedModel : 'spiral');
}

const illustrations = {
  spiral: {
    name: '螺旋波', file: 'spiral-wave',
    equation: 'u(r, θ, t) = sin(2πkr + θ − ωt)',
    note: '解析相位场示意，观察螺旋结构随时间旋转。'
  },
  turing: {
    name: '图灵斑图', file: 'turing-pattern',
    equation: '∂ₜu = Dᵤ∇²u + a − u + u²v\n∂ₜv = Dᵥ∇²v + b − u²v',
    note: 'Schnakenberg 反应扩散模型，观察微小扰动如何形成斑图。'
  },
  collective: {
    name: '集群行为', file: 'collective-motion',
    equation: 'θᵢ′ = arg Σⱼ∈Nᵢ eⁱᶿʲ + ξᵢ',
    note: 'Vicsek 模型示意，观察局部对齐下的集体运动。'
  }
};

export function initDynamics() {
  const video = document.querySelector('#dynamics-video');
  if (!video) return;
  const buttons = [...document.querySelectorAll('[data-dynamics]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-pressed') === 'true') return;
      const selected = illustrations[button.dataset.dynamics];
      const resume = !video.paused && !reducedMotion.matches;
      video.pause();
      video.poster = `assets/img/${selected.file}-poster.png`;
      video.src = `assets/media/${selected.file}.mp4`;
      video.setAttribute('aria-label', `${selected.name}模型动画`);
      document.querySelector('.dynamics-equation').textContent = selected.equation;
      document.querySelector('.dynamics-note').textContent = selected.note;
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      video.load();
      if (resume) video.play().catch(() => { /* Native controls remain available. */ });
    });
  });
  document.querySelector('.dynamics-tabs').hidden = false;
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) video.pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) video.pause();
    }, { threshold: .05 }).observe(video);
  }
}

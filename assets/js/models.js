// Illustrative models, independent of the DOM. They are not paper datasets.
const TAU = 2 * Math.PI;
export const defaults = {
  spiral: { density: 6, arms: 1, speed: 1 },
  turing: { diffusion: 3.2, perturbation: .015 },
  collective: { noise: .3, radius: .14, count: 180 }
};

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export class SpiralModel {
  constructor(parameters = defaults.spiral) {
    this.parameters = { ...parameters };
    this.time = 0;
    this.center = { x: .5, y: .5 };
  }
  advance(dt = 1 / 30) { this.time += dt; }
  field(size = 192) {
    const values = new Float32Array(size * size);
    const { density, arms, speed } = this.parameters;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x / (size - 1) - this.center.x;
        const dy = y / (size - 1) - this.center.y;
        values[y * size + x] = Math.sin(TAU * density * Math.hypot(dx, dy) + arms * Math.atan2(dy, dx) - speed * this.time);
      }
    }
    return values;
  }
}

export class TuringModel {
  constructor(parameters = defaults.turing, seed = 330, size = 96) {
    this.parameters = { ...parameters };
    this.size = size;
    this.steps = 0;
    this.dt = .04; // Stable for the largest Dv exposed by the controls (4.8).
    const length = size * size;
    this.u = new Float32Array(length);
    this.v = new Float32Array(length);
    this.nextU = new Float32Array(length);
    this.nextV = new Float32Array(length);
    this.left = new Int32Array(length);
    this.right = new Int32Array(length);
    this.up = new Int32Array(length);
    this.down = new Int32Array(length);
    const random = randomGenerator(seed);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        this.u[i] = 1 + parameters.perturbation * (2 * random() - 1);
        this.v[i] = .9 + parameters.perturbation * (2 * random() - 1);
        this.left[i] = y * size + (x + size - 1) % size;
        this.right[i] = y * size + (x + 1) % size;
        this.up[i] = ((y + size - 1) % size) * size + x;
        this.down[i] = ((y + 1) % size) * size + x;
      }
    }
  }
  advance(count = 80) {
    const { left, right, up, down, dt } = this;
    const dv = this.parameters.diffusion;
    for (let step = 0; step < count; step++) {
      const { u, v, nextU, nextV } = this;
      for (let i = 0; i < u.length; i++) {
        const uv = u[i] * u[i] * v[i];
        const lapU = u[left[i]] + u[right[i]] + u[up[i]] + u[down[i]] - 4 * u[i];
        const lapV = v[left[i]] + v[right[i]] + v[up[i]] + v[down[i]] - 4 * v[i];
        nextU[i] = u[i] + dt * (.16 * lapU + .2 * (.1 - u[i] + uv));
        nextV[i] = v[i] + dt * (dv * lapV + .2 * (.9 - uv));
      }
      this.u = nextU; this.nextU = u;
      this.v = nextV; this.nextV = v;
    }
    this.steps += count;
  }
}

export class CollectiveModel {
  constructor(parameters = defaults.collective, seed = 330) {
    this.parameters = { ...parameters };
    this.random = randomGenerator(seed);
    this.steps = 0;
    const { count } = parameters;
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.angle = new Float32Array(count);
    this.nextAngle = new Float32Array(count);
    this.cosine = new Float32Array(count);
    this.sine = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.x[i] = this.random(); this.y[i] = this.random();
      this.angle[i] = this.random() * TAU;
    }
  }
  advance(count = 1) {
    const { x, y, cosine, sine } = this;
    const { radius, noise } = this.parameters;
    for (let step = 0; step < count; step++) {
      for (let i = 0; i < x.length; i++) {
        cosine[i] = Math.cos(this.angle[i]); sine[i] = Math.sin(this.angle[i]);
      }
      for (let i = 0; i < x.length; i++) {
        let sx = 0, sy = 0;
        for (let j = 0; j < x.length; j++) {
          const dx = Math.abs(x[i] - x[j]), dy = Math.abs(y[i] - y[j]);
          const periodicX = Math.min(dx, 1 - dx), periodicY = Math.min(dy, 1 - dy);
          if (periodicX * periodicX + periodicY * periodicY <= radius * radius) {
            sx += cosine[j]; sy += sine[j];
          }
        }
        this.nextAngle[i] = Math.atan2(sy, sx) + noise * (this.random() - .5);
      }
      const oldAngle = this.angle;
      this.angle = this.nextAngle; this.nextAngle = oldAngle;
      for (let i = 0; i < x.length; i++) {
        x[i] = (x[i] + .006 * Math.cos(this.angle[i]) + 1) % 1;
        y[i] = (y[i] + .006 * Math.sin(this.angle[i]) + 1) % 1;
      }
    }
    this.steps += count;
  }
  get order() {
    let sx = 0, sy = 0;
    for (const angle of this.angle) { sx += Math.cos(angle); sy += Math.sin(angle); }
    return Math.hypot(sx, sy) / this.angle.length;
  }
}

import { TuringModel } from './models.js';

let revision = 0;
let model;
function sendField(id) {
  const field = new Float32Array(model.u);
  postMessage({ type: 'field', id, field, size: model.size, time: model.steps * model.dt }, [field.buffer]);
}
self.onmessage = ({ data }) => {
  if (data.type === 'cancel') { revision = data.id; return; }
  if (data.type === 'init') {
    revision = data.id;
    model = new TuringModel(data.parameters, data.seed);
    let remaining = data.steps;
    const evolve = () => {
      if (revision !== data.id) return;
      const count = Math.min(300, remaining);
      model.advance(count);
      remaining -= count;
      if (remaining > 0) {
        postMessage({ type: 'progress', id: data.id, progress: Math.round(100 * (data.steps - remaining) / data.steps) });
        setTimeout(evolve, 0); // Let new parameters cancel an obsolete calculation.
      } else sendField(data.id);
    };
    evolve();
  }
  if (data.type === 'step' && data.id === revision && model) {
    model.advance(80);
    sendField(data.id);
  }
};

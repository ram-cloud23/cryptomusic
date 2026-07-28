import { EventEmitter } from 'node:events';

// Demo data source: no real data plumbed in yet? This proves the brain
// works end to end. Swap for any other source without touching the brain.
export class RandomWalkSource extends EventEmitter {
  constructor({ intervalMs = 150, step = 0.08 } = {}) {
    super();
    this.intervalMs = intervalMs;
    this.step = step;
    this.value = Math.random();
    this._timer = null;
  }

  start() {
    this._timer = setInterval(() => {
      const drift = (Math.random() - 0.5) * this.step;
      this.value = Math.min(1, Math.max(0, this.value + drift));
      this.emit('data', { value: this.value });
    }, this.intervalMs);
    return this;
  }

  stop() {
    clearInterval(this._timer);
  }
}

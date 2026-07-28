import { EventEmitter } from 'node:events';

// Live crypto market ticks (Binance public API, no key required) — the
// closest free, truly real-time analog to a forex feed. Each symbol polls
// on its own interval so voices drift in and out of phase with each other
// instead of ticking in lockstep.
const DEFAULT_VOICES = [
  { symbol: 'BTCUSDT', intervalMs: 1000 },
  { symbol: 'ETHUSDT', intervalMs: 1300 },
  { symbol: 'SOLUSDT', intervalMs: 1700 },
];

export class MarketSource extends EventEmitter {
  constructor({ voices = DEFAULT_VOICES } = {}) {
    super();
    this.voices = voices;
    this._timers = [];
    this._prevPrice = new Map();
  }

  start() {
    for (const voice of this.voices) {
      const poll = async () => {
        try {
          const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${voice.symbol}`);
          if (!res.ok) return;
          const row = await res.json();
          const price = Number(row.price);
          const prev = this._prevPrice.get(row.symbol);
          // pitch tracks momentum (% move since last tick), not absolute
          // price level — the price itself barely moves tick-to-tick
          // relative to its own scale, which flattened out the melody.
          const pctChange = prev ? (price - prev) / prev : 0;
          this._prevPrice.set(row.symbol, price);
          this.emit('data', { symbol: row.symbol, price, pctChange });
        } catch (err) {
          this.emit('error', err);
        }
      };
      poll();
      this._timers.push(setInterval(poll, voice.intervalMs));
    }
    return this;
  }

  stop() {
    this._timers.forEach(clearInterval);
    this._timers = [];
  }
}

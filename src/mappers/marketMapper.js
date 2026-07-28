import { createScaleMapper } from './scaleMapper.js';

// Each symbol gets its own register and scale, so the market sounds like
// layered instruments rather than one voice jumping between price levels.
const VOICES = {
  BTCUSDT: { rootNote: 36, octaves: 2, scale: 'minorPentatonic', baseVelocity: 0.7 },  // bass
  ETHUSDT: { rootNote: 55, octaves: 2, scale: 'dorian', baseVelocity: 0.55 },           // mid
  SOLUSDT: { rootNote: 72, octaves: 2, scale: 'majorPentatonic', baseVelocity: 0.45 }, // lead
};

export function createMarketMapper(opts = {}) {
  const voices = { ...VOICES, ...opts.voices };
  const mappers = new Map();
  const fallback = createScaleMapper();

  function mapperFor(symbol) {
    if (!mappers.has(symbol)) {
      const cfg = voices[symbol] ?? {};
      mappers.set(symbol, createScaleMapper({
        ...cfg,
        extract: (d) => d.pctChange,
        rangeDecay: 0.05,
        // seed with a realistic per-tick swing (~0.15%) instead of the
        // generic default, which is tuned for [0,1]-ish data and would
        // take minutes to shrink down to pctChange's much smaller scale
        initialMin: -0.0015,
        initialMax: 0.0015,
      }));
    }
    return mappers.get(symbol);
  }

  // symbol-tagged data (market ticks) route to their own voice; anything
  // else (e.g. the random-walk demo, stdin) still works via the fallback.
  return function marketMapper(dataPoint) {
    if (dataPoint && typeof dataPoint === 'object' && dataPoint.symbol) {
      const note = mapperFor(dataPoint.symbol)(dataPoint);
      return note ? { ...note, voice: dataPoint.symbol } : null;
    }
    return fallback(dataPoint);
  };
}

// Turns arbitrary numeric-ish data into notes on a musical scale, so
// literally any input sounds intentional instead of random noise.

const SCALES = {
  minorPentatonic: [0, 3, 5, 7, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  wholeTone: [0, 2, 4, 6, 8, 10],
};

const NUMERIC_FIELD_HINTS = [
  'value', 'val', 'v', 'count', 'level', 'amount',
  'cpu', 'mem', 'memory', 'price', 'temp', 'temperature', 'load', 'score',
];

function defaultExtract(data) {
  if (typeof data === 'number') return data;
  if (typeof data === 'boolean') return data ? 1 : 0;
  if (data && typeof data === 'object') {
    for (const key of NUMERIC_FIELD_HINTS) {
      if (typeof data[key] === 'number') return data[key];
    }
    const nums = Object.values(data).filter((v) => typeof v === 'number');
    if (nums.length) return nums.reduce((a, b) => a + b, 0) / nums.length;
  }
  // last resort: hash whatever it is into a stable [0, 1) value
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return (hash % 1000) / 1000;
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const round2 = (n) => Math.round(n * 100) / 100;
const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function createScaleMapper(opts = {}) {
  const {
    scale = 'minorPentatonic',
    rootNote = 48, // C3
    octaves = 3,
    extract = defaultExtract,
    baseDuration = 0.35,
    baseVelocity = 0.6,
    rangeDecay = 0.01, // how fast min/max relax toward recent values
    initialMin,
    initialMax,
  } = opts;

  const intervals = SCALES[scale] ?? SCALES.minorPentatonic;
  const degrees = [];
  for (let o = 0; o < octaves; o++) {
    for (const iv of intervals) degrees.push(rootNote + o * 12 + iv);
  }

  let min = initialMin ?? null;
  let max = initialMax ?? null;
  let prevNorm = null;

  return function scaleMapper(dataPoint) {
    const value = extract(dataPoint);
    if (typeof value !== 'number' || Number.isNaN(value)) return null;

    // with no seeded range, guess from the first sample; a bad guess here
    // (e.g. a huge default width for small-magnitude data) can take a long
    // time to shrink back down via the decay below
    if (min === null) { min = value; max = value + 1; }
    // instantly widen to fit the new value, but slowly relax back so
    // one-off spikes don't permanently flatten the dynamic range
    min = Math.min(value, min + (value - min) * rangeDecay);
    max = Math.max(value, max - (max - value) * rangeDecay);
    const norm = clamp((value - min) / (max - min || 1), 0, 1);

    const degreeIndex = Math.round(norm * (degrees.length - 1));
    const pitch = degrees[degreeIndex];

    const delta = prevNorm === null ? 0.3 : Math.abs(norm - prevNorm);
    prevNorm = norm;

    const velocity = clamp(baseVelocity + delta * 0.8, 0.15, 1);
    const duration = baseDuration * (0.6 + (1 - norm) * 0.8);

    return {
      pitch,
      freq: round2(midiToFreq(pitch)),
      velocity: round2(velocity),
      duration: round2(duration),
      norm: round2(norm),
    };
  };
}

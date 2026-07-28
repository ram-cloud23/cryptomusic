import { EventEmitter } from 'node:events';

// The brain: feed it arbitrary data points, it emits musical note events.
// It knows nothing about where data comes from or how notes get played —
// both ends are pluggable, so any data source and any player can attach.
export class SonicBrain extends EventEmitter {
  constructor(mapper) {
    super();
    this.mapper = mapper;
  }

  feed(dataPoint) {
    const result = this.mapper(dataPoint);
    if (!result) return;
    const notes = Array.isArray(result) ? result : [result];
    for (const note of notes) {
      this.emit('note', { ...note, ts: Date.now() });
    }
  }
}

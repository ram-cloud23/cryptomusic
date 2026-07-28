import { EventEmitter } from 'node:events';
import readline from 'node:readline';

// Pipe anything in: `some-command | npm start -- --source=stdin`
// Each line is fed to the brain as JSON if it parses, otherwise as a
// raw string (the mapper's hash fallback will still turn it into a note).
export class StdinSource extends EventEmitter {
  start() {
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let payload = trimmed;
      try { payload = JSON.parse(trimmed); } catch { /* keep raw string */ }
      this.emit('data', payload);
    });
    rl.on('close', () => this.emit('end'));
    return this;
  }

  stop() {}
}

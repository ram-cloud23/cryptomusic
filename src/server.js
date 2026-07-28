import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { SonicBrain } from './brain.js';
import { createMarketMapper } from './mappers/marketMapper.js';
import { RandomWalkSource } from './sources/randomWalk.js';
import { StdinSource } from './sources/stdin.js';
import { MarketSource } from './sources/market.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const PORT = Number(args.port) || 8080;
const SOURCE = args.source || 'randomwalk';

const brain = new SonicBrain(createMarketMapper());

// --- data source: swap freely, the brain doesn't care where data comes from
let source;
if (SOURCE === 'stdin') {
  source = new StdinSource();
} else if (SOURCE === 'market') {
  const symbols = typeof args.symbols === 'string' ? args.symbols.split(',') : undefined;
  source = new MarketSource(symbols ? { voices: symbols.map((s, i) => ({ symbol: s, intervalMs: 1000 + i * 300 })) } : {});
} else {
  source = new RandomWalkSource();
}
source.on('data', (d) => brain.feed(d));
source.start();

// --- HTTP: serves the player UI, and accepts arbitrary data via POST /feed
// so any external UI/app can push data points into the brain too.
const playerHtml = fs.readFileSync(path.join(__dirname, '..', 'player', 'index.html'));

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(playerHtml);
    return;
  }

  if (req.method === 'POST' && req.url === '/feed') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      let payload = body;
      try { payload = JSON.parse(body); } catch { /* keep raw string */ }
      brain.feed(payload);
      res.writeHead(204);
      res.end();
    });
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

// --- WebSocket: streams generated notes out to any connected player
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (socket) => {
  const onNote = (note) => socket.send(JSON.stringify(note));
  brain.on('note', onNote);
  socket.on('close', () => brain.off('note', onNote));
});

server.listen(PORT, () => {
  console.log(`sonicbrain listening on http://localhost:${PORT}`);
  console.log(`  source: ${SOURCE}`);
  console.log(`  feed data:  curl -X POST http://localhost:${PORT}/feed -d '{"value": 0.7}'`);
  console.log(`  open player: http://localhost:${PORT}`);
  if (SOURCE === 'market') console.log('  voices: BTCUSDT (bass), ETHUSDT (mid), SOLUSDT (lead) — live from Binance');
});

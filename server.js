// Martinus Airport - kleine server zonder afhankelijkheden.
// Starten: node server.js   (of dubbelklik start.bat)
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

const PAGES = { '/': 'dashboard.html', '/toren': 'toren.html', '/vluchten': 'vluchten.html' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

// De volledige toestand van de show. Schermen rekenen zelf de animatie uit
// op basis van deze tijdstippen, zodat alles gelijk loopt.
const state = {
  connected: true,
  lostAt: null,      // moment waarop de knop is ingedrukt
  restoredAt: 0,     // moment waarop de verbinding is hersteld
  fadeMs: 20000,     // hoe lang het wegvallen duurt
};

const clients = new Set();

function lanUrls() {
  const urls = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) urls.push(`http://${a.address}:${PORT}`);
    }
  }
  return urls;
}

function message() {
  const screens = { toren: 0, vluchten: 0, dashboard: 0 };
  for (const c of clients) if (c.role in screens) screens[c.role]++;
  return `data: ${JSON.stringify({ ...state, now: Date.now(), screens, urls: lanUrls() })}\n\n`;
}

function broadcast() {
  const msg = message();
  for (const c of clients) c.res.write(msg);
}

function readJson(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (d) => { body += d; if (body.length > 1e4) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const client = { res, role: url.searchParams.get('role') || '' };
    clients.add(client);
    req.on('close', () => { clients.delete(client); broadcast(); });
    broadcast();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/verbreek') {
    const body = await readJson(req);
    const fadeMs = Number(body.fadeMs);
    if (fadeMs >= 1000 && fadeMs <= 600000) state.fadeMs = fadeMs;
    if (state.connected) { state.connected = false; state.lostAt = Date.now(); }
    broadcast();
    res.writeHead(204).end();
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/herstel') {
    if (!state.connected) { state.connected = true; state.lostAt = null; state.restoredAt = Date.now(); }
    broadcast();
    res.writeHead(204).end();
    return;
  }

  const file = path.join(PUBLIC, PAGES[url.pathname] || path.normalize(url.pathname));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Niet gevonden'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

// Houdt de verbinding met de schermen open en hun klok gelijk.
setInterval(broadcast, 15000);

server.listen(PORT, () => {
  const local = `http://localhost:${PORT}`;
  console.log('\n  MARTINUS AIRPORT draait\n');
  console.log(`  Dashboard (bediening):  ${local}/`);
  console.log(`  Scherm 1 - toren:       ${local}/toren`);
  console.log(`  Scherm 2 - vluchten:    ${local}/vluchten`);
  const lan = lanUrls();
  if (lan.length) {
    console.log('\n  Vanaf een ander apparaat op hetzelfde netwerk:');
    for (const u of lan) console.log(`    ${u}/   ${u}/toren   ${u}/vluchten`);
  }
  console.log('\n  Stoppen: Ctrl+C\n');
  if (process.argv.includes('--open')) exec(`start "" ${local}/`);
});

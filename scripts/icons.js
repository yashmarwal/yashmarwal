// Regenerates favicon.ico and PNG app icons from favicon.svg using headless Chrome.
// Usage: node scripts/icons.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'favicon.svg'), 'utf8');
const sizes = [16, 32, 48, 180, 192, 512];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const profile = path.join(root, 'node_modules', '.icons-chrome-profile');
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new', '--disable-gpu', '--remote-debugging-port=9444', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9444/json')).json(); if (targets.length) break; } catch (e) {} await sleep(250); }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d.result || d); delete pending[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });

  const png = {};
  for (const n of sizes) {
    await send('Emulation.setDeviceMetricsOverride', { width: n, height: n, deviceScaleFactor: 1, mobile: false });
    const html = `<html><body style="margin:0;background:transparent"><div style="width:${n}px;height:${n}px">${svg.replace('<svg ', `<svg width="${n}" height="${n}" `)}</div></body></html>`;
    await send('Page.navigate', { url: 'data:text/html;base64,' + Buffer.from(html).toString('base64') });
    await sleep(400);
    const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: n, height: n, scale: 1 } });
    png[n] = Buffer.from(r.data, 'base64');
  }
  ws.close(); chrome.kill();

  fs.writeFileSync(path.join(root, 'apple-touch-icon.png'), png[180]);
  fs.writeFileSync(path.join(root, 'icon-192.png'), png[192]);
  fs.writeFileSync(path.join(root, 'icon-512.png'), png[512]);

  // favicon.ico containing 16, 32 and 48 px PNG images
  const ico = [16, 32, 48];
  const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(ico.length, 4);
  let offset = 6 + ico.length * 16;
  const entries = ico.map((n) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(n, 0); e.writeUInt8(n, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(png[n].length, 8); e.writeUInt32LE(offset, 12);
    offset += png[n].length;
    return e;
  });
  fs.writeFileSync(path.join(root, 'favicon.ico'), Buffer.concat([header, ...entries, ...ico.map((n) => png[n])]));
  console.log('icons written');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

// Layout integration test. Uses public Tailwind/fonts; all data APIs use offline fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'docs');
const browser = process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = path.join(root, '.local/layout-test-profile');
fs.mkdirSync(profile, { recursive: true });
let offline = false;
let savesSucceed = false;
const student = { stt: '17', name: 'Học Sinh Kiểm Thử', class: 'C++ cơ bản', solved: [], stats: { total: 0 }, tuition: {} };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const filename = path.resolve(publicRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!filename.startsWith(publicRoot + path.sep)) { res.writeHead(403).end(); return; }
  if (offline && pathname === '/data.json') { res.writeHead(503).end(); return; }
  try {
    const content = fs.readFileSync(filename);
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(filename)] || 'text/plain';
    res.writeHead(200, { 'Content-Type': mime + '; charset=utf-8' }).end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
let targetSession;
let counter = 0;
const pending = new Map();
const errors = [];
const layoutErrors = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function send(method, params = {}, sessionId = targetSession) {
  const id = ++counter;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function until(expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`Page condition timed out: ${expression}`);
}
try {
  const endpoint = await new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => reject(new Error('Browser startup timed out')), 15000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.stderr.on('data', data => {
      buffer += data;
      const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(task.timeout);
      message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      if (request.url.startsWith(origin + '/')) {
        send('Fetch.continueRequest', { requestId }).catch(error => errors.push(error.message));
        return;
      }
      let body = 'null';
      let mime = 'application/json';
      if (request.url.includes('cdn.tailwindcss.com')) { send('Fetch.continueRequest', { requestId }).catch(error => errors.push(error.message)); return; }
      else if (request.url.includes('fonts.')) { send('Fetch.continueRequest', { requestId }).catch(error => errors.push(error.message)); return; }
      else if (/\.js(\?|$)/.test(request.url)) { body = ''; mime = 'text/javascript'; }
      else if (request.url.includes('/students.json')) body = JSON.stringify(offline ? [] : { student17: student });
      else if (request.url.includes('/submissions.json')) body = '{}';
      else if (request.url.includes('/api/')) body = JSON.stringify({ status: savesSucceed ? 'success' : 'error' });
      else if (request.url.endsWith('/health')) body = '{"status":"offline"}';
      send('Fetch.fulfillRequest', {
        requestId, responseCode: !savesSucceed && ['PUT', 'PATCH', 'POST'].includes(request.method) ? 503 : 200,
        responseHeaders: [{ name: 'Content-Type', value: mime }, { name: 'Access-Control-Allow-Origin', value: '*' }, { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' }, { name: 'Access-Control-Allow-Headers', value: '*' }, { name: 'Access-Control-Allow-Private-Network', value: 'true' }],
        body: Buffer.from(body).toString('base64'),
      }).catch(error => errors.push(error.message));
    }
  };
  const { browserContextId } = await send('Target.createBrowserContext', {}, null);
  const target = await send('Target.createTarget', { url: 'about:blank', browserContextId }, null);
  targetSession = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });


  await send('Page.navigate', { url: origin + '/index.html' });
  await until("typeof appData !== 'undefined' && appData?.students?.length === 1");
  await until("getComputedStyle(document.getElementById('auth-modal')).display === 'none'");
  await evaluate("switchTab('home')");
  await evaluate('document.fonts.ready');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1200, deviceScaleFactor: 1, mobile: false });
    for (const mode of ['light', 'dark', 'cli']) {
      await evaluate("document.querySelector('[data-theme-choice=" + mode + "]').click()");
      await delay(150);
      const colors = await evaluate(`(() => {
        const selectors = ['body', '.home-intro', '.home-course', '.home-contact', 'header'];
        const surfaces = selectors.map(s => ({selector: s, background: getComputedStyle(document.querySelector(s)).backgroundColor, color: getComputedStyle(document.querySelector(s)).color}));
        return {surfaces, overflow: document.documentElement.scrollWidth > innerWidth, selected: document.querySelector('[aria-pressed=true]').dataset.themeChoice};
      })()`);
      assert.equal(colors.selected, mode);
      assert.equal(colors.overflow, false);
      if (mode !== 'light') assert.ok(colors.surfaces.every(s => s.background !== 'rgb(255, 255, 255)'), JSON.stringify(colors));
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(root, '.local/theme-' + mode + '-' + width + '.png'), Buffer.from(screenshot.data, 'base64'));
      console.log('PASS homepage ' + mode + ' ' + width);
    }
  }
  await evaluate("currentAuth = {role:'admin',name:'Kiểm thử giao diện'}; syncManagementAccess()");
  for (const width of [320, 390, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1200, deviceScaleFactor: 1, mobile: false });
    for (const mode of ['light', 'dark', 'cli']) {
      await evaluate(`SiteTheme.set('${mode}')`);
      for (const tab of ['home', 'problems', 'weekly', 'judge', 'submissions', 'leaderboard', 'curriculum', 'contests', 'admin', 'admin-students', 'admin-problems', 'admin-curriculum', 'admin-grading', 'admin-export']) {
        if (tab.startsWith('admin-')) await evaluate(`openManagement('${tab.slice(6)}')`);
        else if (['weekly', 'judge', 'problems'].includes(tab)) await evaluate(`switchTab('problems'); toggleProblemViewMode('${tab === 'problems' ? 'list' : tab}')`);
        else await evaluate(`switchTab('${tab}')`);
        await delay(70);
        const overflow = await evaluate(`Array.from(document.querySelectorAll('body *')).filter(el => {
          if (!el.getClientRects().length || getComputedStyle(el).position === 'fixed') return false;
          const r = el.getBoundingClientRect();
          if (r.right <= innerWidth + 2 && r.left >= -2) return false;
          for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
            if (['auto', 'scroll', 'hidden'].includes(getComputedStyle(parent).overflowX)) return false;
          }
          return true;
        }).map(el => ({tag:el.tagName,id:el.id,classes:el.className,text:el.textContent.trim().slice(0,65)})).slice(0,12)`);
        if (overflow.length) console.log('OVERFLOW', width, mode, tab, JSON.stringify(overflow));
        if (overflow.length) {
          const shot = await send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(root, '.local/overflow-' + tab + '-' + mode + '-' + width + '.png'), Buffer.from(shot.data, 'base64'));
        }
        if (overflow.length) layoutErrors.push({tab, mode, width, overflow});
      }
    }
  }
  await send('Page.navigate', { url: origin + '/student.html?id=17' });
  await until("document.querySelectorAll('[data-theme-choice]').length === 3");
  assert.equal(await evaluate("SiteTheme.get()"), 'cli');
  assert.deepEqual(layoutErrors, [], 'Pages must not overflow at 320–1440px in any theme');
  console.log('PASS 168 responsive page/theme/viewport combinations');
  console.log('PASS profile inherits CLI theme');
} finally {
  if (socket) socket.close();
  child.kill();
  await new Promise(resolve => server.close(resolve));
}

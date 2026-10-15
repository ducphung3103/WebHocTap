// Offline integration test. All external requests are intercepted; no real accounts are used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'docs');
const browser = process.env.BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = path.join(root, '.local/browser-test-profile');
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
      if (request.url.includes('cdn.tailwindcss.com')) { body = 'window.tailwind = {};'; mime = 'text/javascript'; }
      else if (request.url.includes('fonts.')) { body = ''; mime = 'text/css'; }
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
  await delay(500);
  assert.equal(await evaluate("typeof renderJudgeWorkspace"), 'function');
  assert.equal(await evaluate("appData.students[0].stt"), '17');
  assert.equal(await evaluate("document.body.classList.contains('cool-breeze')"), true);
  assert.equal(await evaluate("getComputedStyle(document.body).backgroundColor"), 'rgb(255, 255, 255)');
  assert.deepEqual(errors, []);
  console.log('PASS main page initializes with offline Firebase fixtures');

  // The theme is a shared preference, independent of authentication and page.
  assert.equal(await evaluate("document.querySelectorAll('[data-theme-choice]').length"), 3);
  for (const [theme, color] of [['dark', 'rgb(11, 17, 32)'], ['cli', 'rgb(8, 14, 11)'], ['light', 'rgb(255, 255, 255)']]) {
    await evaluate(`document.querySelector('[data-theme-choice="${theme}"]').click()`);
    assert.equal(await evaluate("getComputedStyle(document.body).backgroundColor"), color);
    assert.equal(await evaluate("document.querySelector('[data-theme-choice][aria-pressed=true]').dataset.themeChoice"), theme);
  }
  await evaluate("SiteTheme.set('cli')");
  await send('Page.navigate', { url: origin + '/student.html?id=17' });
  await until("document.querySelectorAll('[data-theme-choice]').length === 3");
  assert.equal(await evaluate("SiteTheme.get()"), 'cli');
  assert.match(await evaluate("getComputedStyle(document.body).fontFamily"), /monospace/);
  await evaluate("SiteTheme.set('dark')");
  await send('Page.navigate', { url: origin + '/index.html' });
  await until("typeof appData !== 'undefined' && appData?.students?.length === 1");
  assert.equal(await evaluate("SiteTheme.get()"), 'dark');
  await evaluate("window.dispatchEvent(new StorageEvent('storage', { key: 'deruck-ui-theme', newValue: 'cli' }))");
  assert.equal(await evaluate("SiteTheme.get()"), 'cli');
  await evaluate("SiteTheme.set('unknown')");
  assert.equal(await evaluate("SiteTheme.get()"), 'light');
  console.log('PASS three themes switch, persist across pages, and synchronize storage changes');

  // IndexedDB archive keeps an older submission even when Firebase returns an empty collection.
  await evaluate(`archiveSubmissionsLocally([{ id: 'SUB-1700000000000-ARCHIVE', submitted_at: '14/11/2023 12:00:00', student_name: 'Học Sinh Kiểm Thử', problem_id: 'CPP-ARCHIVE', problem_name: 'Archived problem', answer: '[C++20]\\nint main(){}', lang: 'C++20', status: 'Đã nộp' }], { silent: true })`);
  await send('Page.navigate', { url: origin + '/index.html' });
  await until("typeof appData !== 'undefined' && Array.isArray(appData?.submissions) && appData.submissions.some(s => s.id === 'SUB-1700000000000-ARCHIVE')");
  assert.equal(await evaluate(`appData.submissions.some(s => s.problem_id === 'CPP-ARCHIVE')`), true);
  console.log('PASS IndexedDB archive restores older submissions across reloads');

  // Simulate an old browser that cached an NBK file import before cleanup.
  await evaluate(`new Promise((resolve, reject) => {
    const request = indexedDB.open('deruckoj-realtime-data', 1);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('submissions', 'readwrite');
      transaction.objectStore('submissions').put({ id: 'SUB-HSG-001-NUMBER', problem_id: 'HSG-NUMBER', submission_type_display: 'Code Thi HSG', answer: 'old import' });
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
    request.onerror = () => reject(request.error);
  })`);
  await send('Page.navigate', { url: origin + '/index.html' });
  await until("typeof appData !== 'undefined' && appData?.submissions?.some(s => s.id === 'SUB-1700000000000-ARCHIVE')");
  assert.equal(await evaluate("appData.submissions.some(s => s.id.startsWith('SUB-HSG-'))"), false);
  assert.equal(await evaluate(`new Promise(resolve => {
    const request = indexedDB.open('deruckoj-realtime-data', 1);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction('submissions', 'readonly').objectStore('submissions').get('SUB-HSG-001-NUMBER');
      read.onsuccess = () => { db.close(); resolve(Boolean(read.result)); };
    };
  })`), false);
  console.log('PASS NBK imports are removed from old browser archives while direct submissions survive');
  await evaluate(`(async () => { await deleteArchivedSubmission('SUB-1700000000000-ARCHIVE'); appData.submissions = appData.submissions.filter(s => s.id !== 'SUB-1700000000000-ARCHIVE'); localStorage.setItem('cp_cached_submissions', JSON.stringify(appData.submissions)); })()`);

  // Judge history is persisted locally and the cached/server copy does not create a duplicate row.
  await evaluate(`(() => {
    currentJudgeProbId = 'CPP-HISTORY';
    appData.submissions = [];
    saveJudgeSubmissionHistory({ id: 'SUB-HISTORY-1', timestamp: Date.now(), submitted_at: '14/10/2026 21:00:00', probId: 'CPP-HISTORY', probName: 'History test', lang: 'C++20', verdict: 'AC', score: 100, code: 'int main(){}' });
    renderJudgeSubmissionHistory();
  })()`);
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('deruck_judge_history_v2')).length`), 1);
  assert.equal(await evaluate(`document.querySelectorAll('#judge-history-body tr').length`), 1);
  await evaluate(`appData.submissions.push({ id: 'SUB-HISTORY-1', submitted_at: '14/10/2026 21:00:00', student_name: 'Học Sinh Kiểm Thử', problem_id: 'CPP-HISTORY', answer: '[C++20]\\nint main(){}', lang: 'C++20', verdict: 'AC', status: 'Chấm đạt', score: '10' }); renderJudgeSubmissionHistory();`);
  assert.equal(await evaluate(`document.querySelectorAll('#judge-history-body tr').length`), 1);
  await send('Page.navigate', { url: origin + '/index.html' });
  await until("typeof appData !== 'undefined' && Array.isArray(appData?.problems)");
  assert.equal(await evaluate(`(() => { currentJudgeProbId = 'CPP-HISTORY'; appData.submissions = []; renderJudgeSubmissionHistory(); return document.getElementById('judge-history-body').textContent.includes('CPP-HISTORY'); })()`), true);
  await evaluate(`localStorage.removeItem('deruck_judge_history_v2'); appData.submissions = [];`);
  console.log('PASS judge submission history persists and deduplicates cached records');

  // Exercise dynamic sample markup with quotes and HTML characters.
  await evaluate(`appData.problems.push({ id: 'CPP-TEST', name: 'Quote test', platform: 'DeruckOJ', testcases: [{ input: 'a "b" <c>', output: '1', is_sample: true }] }); currentAuth = { role: 'student', stt: '17', name: ${JSON.stringify(student.name)} }; openJudgeWithProblem('CPP-TEST');`);
  const badHandlers = await evaluate(`Array.from(document.querySelectorAll('[onclick]')).flatMap(el => { try { new Function(el.getAttribute('onclick')); return []; } catch (e) { return [el.getAttribute('onclick')]; } })`);
  assert.deepEqual(badHandlers, []);
  assert.equal(await evaluate(`(() => { const copied = []; copyTextToClipboard = value => copied.push(value); document.querySelectorAll('[onclick]').forEach(el => { const handler = el.getAttribute('onclick'); if (handler.startsWith('copyTextToClipboard(')) new Function(handler)(); }); return copied.includes('a "b" <c>'); })()`), true);
  assert.equal(await evaluate(`document.getElementById('judge-prob-id').textContent.includes('CPP-TEST')`), true);
  console.log('PASS rendered inline handlers parse, including quoted test samples');

  // A judged submission is stored before remote delivery and receives an explicit sync state.
  savesSucceed = false;
  await evaluate(`(async () => {
    executeJudgeBatch = async () => [{ status: 'OK', stdout: '1', stderr: '', server: 'Test Judge', execution_time: 0.01 }];
    document.getElementById('judge-code-editor').value = 'int main(){}';
    await submitJudgeAllTests();
  })()`);
  assert.equal(await evaluate(`appData.submissions[0].sync_status`), 'pending');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('deruck_judge_history_v2'))[0].id === appData.submissions[0].id`), true);
  savesSucceed = true;
  await evaluate(`(async () => { document.getElementById('judge-code-editor').value = 'int main(){return 0;}'; await submitJudgeAllTests(); })()`);
  assert.equal(await evaluate(`appData.submissions[0].sync_status`), 'synced');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('deruck_judge_history_v2'))[0].sync_status`), 'synced');
  savesSucceed = false;
  console.log('PASS judged submissions persist locally and expose pending/synced delivery state');

  await evaluate('triggerTwoWaySync()');
  assert.match(await evaluate("document.getElementById('live-toast-msg').textContent"), /Lỗi đồng bộ/);
  savesSucceed = true;
  await evaluate('triggerTwoWaySync()');
  assert.equal(await evaluate('appData.students.length'), 1);
  assert.match(await evaluate("document.getElementById('live-toast-msg').textContent"), /hoàn thành đồng bộ/);
  savesSucceed = false;
  console.log('PASS two-way sync reports server errors and retains Firebase students');

  await evaluate(`localStorage.setItem('cp_auth_session', JSON.stringify({ role: 'admin', name: 'Test admin' }));`);
  await send('Page.navigate', { url: origin + '/student.html?id=17' });
  await until("document.getElementById('student-name')?.textContent === " + JSON.stringify(student.name));
  assert.equal(await evaluate('String(currentStudent.stt)'), '17');
  assert.deepEqual(errors, []);
  console.log('PASS non-contiguous string student ID opens the correct profile');

  await evaluate(`(async () => { currentStudentSubmitProbId = 'CPP-OFFLINE'; currentStudentSubmitMode = 'short'; appData.problems.push({ id: 'CPP-OFFLINE', name: 'Test' }); appData.submissions = []; localStorage.removeItem('cp_app_data'); document.getElementById('submit-answer-input').value = '42'; await handleConfirmStudentSubmit(); })()`);
  assert.equal(await evaluate('appData.submissions.length'), 1);
  assert.match(await evaluate("document.getElementById('live-toast-msg').textContent"), /chưa gửi tới thầy/);
  console.log('PASS failed submission produces one local record and reports delivery failure');

  savesSucceed = true;
  await evaluate(`(async () => { currentStudentSubmitProbId = 'CPP-OFFLINE'; document.getElementById('submit-answer-input').value = '43'; await handleConfirmStudentSubmit(); })()`);
  assert.match(await evaluate("document.getElementById('live-toast-msg').textContent"), /thành công/);
  assert.equal(await evaluate('appData.submissions.length'), 2);
  console.log('PASS successful retry reports remote delivery');

  offline = true;
  await evaluate('localStorage.clear(); document.cookie = "cp_auth_session=; max-age=0; path=/";');
  await send('Page.navigate', { url: origin + '/student.html' });
  await until("document.getElementById('loading-state')?.textContent.includes('Chưa kết nối Firebase')");
  assert.deepEqual(errors, []);
  console.log('PASS unavailable catalog and empty Firebase show an error without crashing');

  await send('Page.navigate', { url: origin + '/index.html' });
  await until("typeof appData !== 'undefined' && Array.isArray(appData?.students)");
  await delay(500);
  assert.equal(await evaluate('appData.students.length'), 0);
  assert.deepEqual(errors, []);
  console.log('PASS unavailable catalog does not invent demo student records');
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    await send('Browser.close', {}, null).catch(() => {});
    socket.close();
  }
  child.kill();
  server.close();
  for (const task of pending.values()) clearTimeout(task.timeout);
}

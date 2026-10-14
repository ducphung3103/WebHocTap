const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function client(fetch) {
  const context = vm.createContext({ fetch, TextEncoder, TextDecoder, btoa, atob, AbortSignal, AbortController,
    setTimeout, Date, console, document: { getElementById() { return null; } }, localJudgeAvailable: false, showLiveToast() {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../docs/assets/js/judge/client.js'), 'utf8'), context);
  return context;
}
const response = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

test('local Python sends the base time limit once, preserving runtime errors', async () => {
  let payload;
  const api = client(async (url, options) => { payload = JSON.parse(options.body); return response({ status: 'RTE', error: 'EOFError' }); });
  const data = await api.executeLocalJudge('python', 'print(input())', '', '1s');
  assert.equal(payload.time_limit, 1);
  assert.equal(data.stderr, 'EOFError');
});

test('queued or internal-error Judge0 responses cannot become OK', async () => {
  for (const id of [1, 2, 13, 14]) {
    const api = client(async () => response({ status: { id } }));
    await assert.rejects(api.executeJudge0('judge0', 'cpp', 'code', '', 1));
  }
});

test('Judge0 compilation failures and Unicode output map correctly', async () => {
  const api = client(async () => response({ status: { id: 6 }, compile_output: btoa('compile error') }));
  assert.equal((await api.executeJudge0('judge0', 'cpp', 'bad', '', 1)).status, 'CE');
  const output = 'Xin chào';
  const ok = client(async () => response({ status: { id: 3 }, stdout: Buffer.from(output).toString('base64') }));
  assert.equal((await ok.executeJudge0('judge0', 'python', 'print()', '', 1)).stdout, output);
});

test('infrastructure failure rejects instead of returning an RTE verdict', async () => {
  const api = client(async () => { throw new Error('offline'); });
  api.handleJudgeServerChange('local');
  await assert.rejects(api.executeCode('cpp', 'code', '', 1), /Không kết nối/);
});

test('batch sends one request for all tests and rejects incomplete results', async () => {
  let executions = 0;
  const api = client(async (url, options) => {
    if (url.endsWith('/health')) return response({ status: 'ok', batch: true, gpp: true });
    executions++;
    assert.deepEqual(JSON.parse(options.body).inputs, ['1', '2']);
    return response({ results: [{ status: 'OK', stdout: '1' }] });
  });
  api.handleJudgeServerChange('local');
  await assert.rejects(api.executeJudgeBatch('cpp', 'code', [{ input: '1', output: '1' }, { input: '2', output: '2' }], 1), /chưa hoàn thành/);
  assert.equal(executions, 1);
});

test('malformed tests are rejected before sending code', async () => {
  let requests = 0;
  const api = client(async () => { requests++; });
  await assert.rejects(api.executeJudgeBatch('cpp', 'code', [{ input: '1' }], 1));
  assert.equal(requests, 0);
});

test('auto mode skips local C++ when health reports no compiler', async () => {
  const urls = [];
  const api = client(async (url) => {
    urls.push(url);
    if (url.endsWith('/health')) return response({ status: 'ok', batch: true, gpp: false });
    if (url.includes('/submissions?')) return response({ token: 'cloud-1', status: { id: 3 }, stdout: btoa('2') });
    return response({ status: { id: 3 }, stdout: btoa('2') });
  });
  const results = await api.executeJudgeBatch('cpp', 'code', [{ input: '1', output: '2' }], 1);
  assert.equal(results[0].stdout, '2');
  assert.equal(urls.some(url => url.endsWith('/judge-batch')), false);
});

test('auto batch falls back to cloud when local judge has a service error', async () => {
  let localBatchRequests = 0;
  const api = client(async (url) => {
    if (url.endsWith('/health')) return response({ status: 'ok', batch: true, gpp: true });
    if (url.endsWith('/judge-batch')) {
      localBatchRequests++;
      return response({ results: [{ status: 'SE', stderr: 'compiler unavailable' }] });
    }
    if (url.includes('/submissions?')) return response({ token: 'cloud-2', status: { id: 3 }, stdout: btoa('4') });
    return response({ status: { id: 3 }, stdout: btoa('4') });
  });
  const results = await api.executeJudgeBatch('cpp', 'code', [{ input: '2', output: '4' }], 1);
  assert.equal(localBatchRequests, 1);
  assert.equal(results[0].server, '26TinyLove');
});

test('Wandbox timeout signal takes precedence over exit status', async () => {
  const api = client(async () => response({ status: '1', signal: 'SIGXCPU' }));
  assert.equal((await api.executeWandbox('cpp', 'code', '', 1)).status, 'TLE');
});

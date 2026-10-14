const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function firebase(fetch) {
  const context = vm.createContext({
    fetch, AbortSignal, console: { warn() {}, error() {} },
    localStorage: { getItem() { return null; } },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../docs/firebase-config.js'), 'utf8'), context);
  return context;
}
const response = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });

test('tuition updates preserve sparse array keys and accept string student IDs', async () => {
  const writes = [];
  const api = firebase(async (url, options = {}) => {
    if (!options.method) return response([null, { stt: 17, name: 'Test' }]);
    writes.push({ url, ...options });
    return response(true);
  });
  assert.equal(await api.saveTuitionToFirebase('17', 'Tháng 10', false), true);
  assert.match(writes[0].url, /\/students\/1\/tuition\//);
  assert.equal(writes[0].body, 'false');
});

test('student status preserves arbitrary Firebase object keys', async () => {
  const writes = [];
  const api = firebase(async (url, options = {}) => {
    if (!options.method) return response({ 'student-key': { stt: '17' } });
    writes.push(url);
    return response(true);
  });
  assert.equal(await api.saveStudentStatusToFirebase(17, 'Đang học'), true);
  assert.match(writes[0], /\/students\/student-key\/status.json$/);
});

test('concurrent solved writes retry and retain the other accepted problem', async () => {
  const writes = [];
  let reads = 0;
  const api = firebase(async (url, options = {}) => {
    if (url.endsWith('/students.json')) return response({ key: { stt: 17 } });
    if (url.endsWith('/solved.json')) {
      if (!options.method) return response(++reads === 1 ? ['CPP-1'] : ['CPP-1', 'CPP-2'], 200, { ETag: `"${reads}"` });
      writes.push(options);
      return response(null, writes.length === 1 ? 412 : 200);
    }
    return response(true);
  });
  assert.equal(await api.saveStudentSolvedToFirebase({ stt: '17' }, 'CPP-3'), true);
  assert.deepEqual(JSON.parse(writes[1].body), ['CPP-1', 'CPP-2', 'CPP-3']);
  assert.equal(writes[1].headers['if-match'], '"2"');
});

test('conflicting IDs and partial names cannot match another student submission', () => {
  const api = firebase();
  assert.equal(api.submissionBelongsToStudent({ student_name: 'Nguyễn An', student_stt: 2 }, { name: 'Nguyễn An', stt: 1 }), false);
  assert.equal(api.submissionBelongsToStudent({ student_name: 'Nguyễn An' }, { name: 'An' }), false);
  assert.equal(api.submissionBelongsToStudent({ student_stt: '1' }, { stt: 1, pin: 1234 }), true);
  assert.equal(api.submissionBelongsToStudent({ student_name: 'An', class_name: 'A' }, { name: 'An', class: 'B' }), false);
});

test('bulk upload uses submission IDs and preserves unrelated metadata', async () => {
  let payload;
  const api = firebase(async (url, options) => { payload = JSON.parse(options.body); return response(true); });
  assert.equal(await api.pushFullDatabaseToFirebaseClient({ students: [], submissions: [{ id: 'SUB-42', answer: 'x' }] }), true);
  assert.equal(payload.submissions['SUB-42'].answer, 'x');
  assert.equal('metadata' in payload, false);
  assert.equal('metadata/last_updated' in payload, true);
});

test('bulk fallback uploads submissions and reports partial failure', async () => {
  const calls = [];
  const api = firebase(async (url, options) => {
    calls.push({ url, ...options });
    return response(null, url.endsWith('/.json') || url.endsWith('/submissions.json') ? 403 : 200);
  });
  assert.equal(await api.pushFullDatabaseToFirebaseClient({ submissions: [{ id: 'SUB-1' }] }), false);
  assert.equal(calls.length, 4);
  assert.equal(calls.at(-1).method, 'PATCH');
});

test('submission network failure is distinct from an empty database', async () => {
  const offline = firebase(async () => { throw new Error('offline'); });
  assert.equal(await offline.fetchSubmissionsFromFirebase(), null);
  const empty = firebase(async () => response(null));
  assert.equal((await empty.fetchSubmissionsFromFirebase()).length, 0);
});

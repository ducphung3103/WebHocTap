// Audit by default. --apply backs up and removes only the legacy NBK file import.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = fs.readFileSync(path.join(root, 'docs/firebase-config.js'), 'utf8');
const base = config.match(/databaseURL:\s*"([^"]+)"/)?.[1];
if (!base?.startsWith('https://')) throw new Error('Missing database URL');
const allowedProblems = new Set(['HSG-NUMBER', 'HSG-FACTORIAL', 'HSG-SEGMENT', 'HSG-DIVISOR']);
const isImported = item => item && /^SUB-HSG-/.test(item.id || '')
  && allowedProblems.has(item.problem_id)
  && (String(item.submission_type_display || '').includes('Code Thi HSG')
    || /^Thí sinh SBD /.test(item.student_name || ''));
async function read(url, etag = false) {
  const result = await fetch(url, { headers: etag ? { 'X-Firebase-ETag': 'true' } : {}, signal: AbortSignal.timeout(20000) });
  if (!result.ok) throw Error('Read failed: ' + result.status);
  return { data: await result.json(), etag: result.headers.get('etag') };
}
const { data } = await read(base + '/submissions.json');
const records = Object.entries(data || {}).filter(([, item]) => item && typeof item === 'object');
const targets = records.filter(([, item]) => isImported(item));
const others = records.filter(([, item]) => !isImported(item));
const counts = {};
for (const [, item] of others) {
  const type = item.submission_type_display || '(no type)';
  counts[type] = (counts[type] || 0) + 1;
}
console.log(JSON.stringify({
  total: records.length, nbkImports: targets.length, remaining: others.length,
  remainingTypes: counts,
  remainingTimestampIds: others.filter(([, item]) => /^SUB-\d{12,13}/.test(item.id || '')).length,
  remainingProblems: [...new Set(others.map(([, item]) => item.problem_id))],
}, null, 2));
if (process.argv.includes('--apply') && targets.length) {
  // Re-read exact targets with ETags before backup, so concurrent edits are protected.
  const snapshot = {};
  for (const [key] of targets) {
    const current = await read(base + '/submissions/' + encodeURIComponent(key) + '.json', true);
    if (isImported(current.data)) snapshot[key] = current;
  }
  const backup = path.join(root, 'data/private', 'nbk-import-backup-' + Date.now() + '.json');
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.writeFileSync(backup, JSON.stringify({ database: base, created_at: new Date().toISOString(), records: snapshot }, null, 2), { flag: 'wx' });
  let removed = 0;
  for (const [key, saved] of Object.entries(snapshot)) {
    if (!saved.etag) throw Error('Missing ETag; deletion stopped');
    const response = await fetch(base + '/submissions/' + encodeURIComponent(key) + '.json', {
      method: 'DELETE', headers: { 'if-match': saved.etag }, signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error('Delete failed (' + response.status + '); backup: ' + backup);
    removed++;
  }
  const after = await read(base + '/submissions.json');
  const remaining = Object.entries(after.data || {}).filter(([, item]) => item);
  if (remaining.some(([, item]) => isImported(item))) throw Error('Imported records remain; inspect before retrying');
  console.log(JSON.stringify({ removed, remaining: remaining.length, backup }));
}

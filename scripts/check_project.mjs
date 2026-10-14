import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let count = 0;
for (const page of ['index.html', 'docs/index.html', 'docs/student.html']) {
  const filename = path.join(root, page);
  const html = fs.readFileSync(filename, 'utf8');
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
    if (/^(?:https?:|data:|#)/.test(match[1])) continue;
    const asset = path.resolve(path.dirname(filename), match[1].split('?')[0]);
    assert.ok(fs.existsSync(asset), `Missing asset in ${page}: ${match[1]}`);
    if (asset.endsWith('.js')) { new vm.Script(fs.readFileSync(asset, 'utf8'), { filename: asset }); count++; }
  }
}
const data = JSON.parse(fs.readFileSync(path.join(root, 'docs/data.json'), 'utf8'));
assert.equal(Object.keys(data.auth_tokens || {}).length, 0, 'Public catalog contains auth tokens');
assert.equal(Object.keys(data.students || {}).length, 0, 'Public catalog contains private students');
assert.equal(Object.keys(data.submissions || {}).length, 0, 'Public catalog contains private submissions');
console.log(`PASS local asset paths, ${count} JavaScript references and public catalog privacy`);

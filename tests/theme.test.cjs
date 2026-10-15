const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../docs/assets/js/theme.js'), 'utf8');

function boot(saved, blocked = false) {
  const root = { dataset: {}, style: {} };
  const storage = { value: saved };
  const context = {
    document: { documentElement: root, querySelectorAll: () => [], addEventListener() {} },
    localStorage: {
      getItem() { if (blocked) throw Error('Blocked'); return storage.value; },
      setItem(key, value) { if (blocked) throw Error('Blocked'); storage.value = value; },
    },
    window: { addEventListener() {} },
  };
  vm.runInNewContext(source, context);
  return { root, storage, api: context.window.SiteTheme };
}

test('restores a valid theme before DOM content is ready', () => {
  for (const mode of ['light', 'dark', 'cli']) {
    const { root, api } = boot(mode);
    assert.equal(root.dataset.theme, mode);
    assert.equal(api.get(), mode);
    assert.equal(root.style.colorScheme, mode === 'light' ? 'light' : 'dark');
  }
});
test('invalid stored preferences fall back to light', () => {
  assert.equal(boot('invalid').root.dataset.theme, 'light');
  assert.equal(boot(null).root.dataset.theme, 'light');
});
test('blocked storage does not prevent theme switching', () => {
  const { api, root } = boot(null, true);
  api.set('cli');
  assert.equal(root.dataset.theme, 'cli');
  api.set('dark');
  assert.equal(root.dataset.theme, 'dark');
});

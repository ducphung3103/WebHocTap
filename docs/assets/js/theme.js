/* Apply the saved theme before the page paints; storage may be unavailable. */
(() => {
  'use strict';
  const key = 'deruck-ui-theme';
  const choices = [['light', 'Sáng'], ['dark', 'Tối'], ['cli', 'CLI']];
  const valid = value => choices.some(([name]) => name === value);
  let current = 'light';
  try {
    const saved = localStorage.getItem(key);
    if (valid(saved)) current = saved;
  } catch { /* The selector still works when storage is blocked. */ }

  function apply(value, persist = true) {
    current = valid(value) ? value : 'light';
    document.documentElement.dataset.theme = current;
    document.documentElement.style.colorScheme = current === 'light' ? 'light' : 'dark';
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === current));
    });
    if (persist) {
      try { localStorage.setItem(key, current); } catch { /* Session-only fallback. */ }
    }
  }
  apply(current, false);

  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('body > header');
    if (!header) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'theme-toolbar';
    const group = document.createElement('div');
    group.className = 'theme-switcher';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Chọn giao diện');
    for (const [name, label] of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.themeChoice = name;
      button.textContent = label;
      button.addEventListener('click', () => apply(name));
      group.append(button);
    }
    toolbar.append(group);
    header.append(toolbar);
    apply(current, false);
  });

  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(event.newValue, false);
  });
  window.SiteTheme = Object.freeze({ set: apply, get: () => current });
})();

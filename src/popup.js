const STORAGE_THEME  = 'ce-theme';
const STORAGE_FORMAT = 'ce-format';

const $ = id => document.getElementById(id);

const ui = {
  html:           document.documentElement,
  siteLabel:      $('site-label'),
  countLabel:     $('count-label'),
  domainLabel:    $('domain-label'),
  output:         $('output'),
  stateLoading:   $('state-loading'),
  stateEmpty:     $('state-empty'),
  stateError:     $('state-error'),
  errorMessage:   $('error-message'),
  copyBtn:        $('copy-btn'),
  copyIcon:       $('copy-icon'),
  checkIcon:      $('check-icon'),
  copyLabel:      $('copy-label'),
  downloadBtn:    $('download-btn'),
  toast:          $('toast'),
  themeToggle:    $('theme-toggle'),
  iconSun:        $('icon-sun'),
  iconMoon:       $('icon-moon'),
  refreshBtn:     $('refresh-btn'),
  formatTrigger:  $('format-trigger'),
  formatDropdown: $('format-dropdown'),
  triggerBadge:   $('trigger-badge'),
  triggerName:    $('trigger-name'),
  triggerDesc:    $('trigger-desc'),
  fmtOptions:     document.querySelectorAll('.fmt-option'),
};

const FORMAT_META = {
  'json-object':   { badge: 'JSON', name: 'Object',               desc: 'name → {value, expires}',          ext: 'json' },
  'json-array':    { badge: 'JSON', name: 'Array',                desc: 'Full cookie objects with metadata', ext: 'json' },
  'puppeteer':     { badge: 'JSON', name: 'Puppeteer/Playwright', desc: 'Ready for page.setCookie()',        ext: 'json' },
  'requests':      { badge: 'PY',   name: 'Python Requests',      desc: 'requests.get(url, cookies={...})', ext: 'py'   },
  'netscape':      { badge: 'TXT',  name: 'Netscape',             desc: 'curl --cookie-jar, wget',           ext: 'txt'  },
  'header':        { badge: 'TXT',  name: 'Cookie Header',        desc: 'name=val; name=val',                ext: 'txt'  },
  'keyval':        { badge: 'TXT',  name: 'key=value',            desc: 'One pair per line',                 ext: 'txt'  },
  'curl':          { badge: 'SH',   name: 'cURL flag',            desc: '--cookie "name=val; ..."',          ext: 'txt'  },
  'js-snippet':    { badge: 'JS',   name: 'JS Snippet',           desc: 'document.cookie = … (devtools)',   ext: 'js'   },
  'fetch-snippet': { badge: 'JS',   name: 'Fetch Snippet',        desc: 'fetch() with Cookie header',        ext: 'js'   },
  'base64':        { badge: 'B64',  name: 'Base64',               desc: 'Base64-encoded JSON',               ext: 'txt'  },
  'csv':           { badge: 'CSV',  name: 'CSV',                  desc: 'name,value,domain,path,expires',   ext: 'csv'  },
};

let cookies      = [];
let activeDomain = '';
let plainOutput  = '';
let dropdownOpen = false;
let toastTimer   = null;
let copyTimer    = null;

const savedFormat = localStorage.getItem(STORAGE_FORMAT);
let activeFormat  = (savedFormat && FORMAT_META[savedFormat]) ? savedFormat : 'json-object';

function applyTheme(theme) {
  ui.html.setAttribute('data-theme', theme);
  ui.iconSun.classList.toggle('hidden',  theme === 'dark');
  ui.iconMoon.classList.toggle('hidden', theme === 'light');
}

function toggleTheme() {
  const next = ui.html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_THEME, next);
  applyTheme(next);
}

function openDropdown() {
  dropdownOpen = true;
  ui.formatDropdown.classList.remove('hidden');
  ui.formatTrigger.classList.add('open');
  ui.formatTrigger.setAttribute('aria-expanded', 'true');
}

function closeDropdown() {
  dropdownOpen = false;
  ui.formatDropdown.classList.add('hidden');
  ui.formatTrigger.classList.remove('open');
  ui.formatTrigger.setAttribute('aria-expanded', 'false');
}

function activateFormat(format) {
  activeFormat = format;
  localStorage.setItem(STORAGE_FORMAT, format);

  const meta = FORMAT_META[format];
  ui.triggerBadge.textContent = meta.badge;
  ui.triggerName.textContent  = meta.name;
  ui.triggerDesc.textContent  = meta.desc;

  ui.fmtOptions.forEach(opt => {
    const on = opt.dataset.format === format;
    opt.classList.toggle('active', on);
    opt.setAttribute('aria-selected', String(on));
  });

  closeDropdown();
  if (cookies.length) renderOutput();
}

function toJSONObject(list) {
  const jar = {};
  for (const c of list) {
    jar[c.name] = { value: c.value };
    if (c.expirationDate) jar[c.name].expires = new Date(c.expirationDate * 1000).toISOString();
  }
  return JSON.stringify(jar, null, 2);
}

function toJSONArray(list) {
  return JSON.stringify(list.map(c => ({
    name:     c.name,
    value:    c.value,
    domain:   c.domain,
    path:     c.path,
    expires:  c.expirationDate ? new Date(c.expirationDate * 1000).toISOString() : null,
    secure:   c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
  })), null, 2);
}

function toPuppeteer(list) {
  return JSON.stringify(list.map(c => {
    const obj = { name: c.name, value: c.value, domain: c.domain, path: c.path || '/' };
    if (c.expirationDate) obj.expires  = Math.floor(c.expirationDate);
    if (c.secure)         obj.secure   = true;
    if (c.httpOnly)       obj.httpOnly = true;
    if (c.sameSite)       obj.sameSite = c.sameSite;
    return obj;
  }), null, 2);
}

function toRequests(list) {
  const obj = {};
  list.forEach(c => { obj[c.name] = c.value; });
  return `cookies = ${JSON.stringify(obj, null, 4)}\n\n# Usage:\n# requests.get(url, cookies=cookies)`;
}

function toNetscape(list) {
  const rows = ['# Netscape HTTP Cookie File', '# https://curl.se/docs/http-cookies.html', ''];
  for (const c of list) {
    const domain = c.domain.startsWith('.') ? c.domain : `.${c.domain}`;
    const sub    = c.domain.startsWith('.') ? 'TRUE' : 'FALSE';
    rows.push([domain, sub, c.path || '/', c.secure ? 'TRUE' : 'FALSE', Math.floor(c.expirationDate || 0), c.name, c.value].join('\t'));
  }
  return rows.join('\n');
}

const toHeader     = list => list.map(c => `${c.name}=${c.value}`).join('; ');
const toKeyVal     = list => list.map(c => `${c.name}=${c.value}`).join('\n');
const toCurl       = list => `--cookie "${list.map(c => `${c.name}=${c.value}`).join('; ')}"`;
const toJSSnippet  = list => list.map(c => `document.cookie = ${JSON.stringify(`${c.name}=${c.value}; path=${c.path || '/'}`)};`).join('\n');

function toFetchSnippet(list) {
  const cookieHeader = list.map(c => `${c.name}=${c.value}`).join('; ');
  return `fetch('https://${activeDomain}/', {\n  headers: {\n    'Cookie': '${cookieHeader}'\n  }\n});`;
}

function toBase64(list) {
  const obj = {};
  list.forEach(c => { obj[c.name] = c.value; });
  return btoa(JSON.stringify(obj));
}

function toCSV(list) {
  const rows = list.map(c => [
    JSON.stringify(c.name),
    JSON.stringify(c.value),
    JSON.stringify(c.domain),
    JSON.stringify(c.path || '/'),
    c.expirationDate ? new Date(c.expirationDate * 1000).toISOString() : '',
    c.secure   ? 'true' : 'false',
    c.httpOnly ? 'true' : 'false',
  ].join(','));
  return ['name,value,domain,path,expires,secure,httpOnly', ...rows].join('\n');
}

const formatters = {
  'json-object':   toJSONObject,
  'json-array':    toJSONArray,
  'puppeteer':     toPuppeteer,
  'requests':      toRequests,
  'netscape':      toNetscape,
  'header':        toHeader,
  'keyval':        toKeyVal,
  'curl':          toCurl,
  'js-snippet':    toJSSnippet,
  'fetch-snippet': toFetchSnippet,
  'base64':        toBase64,
  'csv':           toCSV,
};

const highlighters = {
  'json-object':   H.json,
  'json-array':    H.json,
  'puppeteer':     H.json,
  'requests':      H.python,
  'netscape':      H.netscape,
  'header':        H.header,
  'keyval':        H.keyval,
  'curl':          H.curl,
  'js-snippet':    H.js,
  'fetch-snippet': H.js,
  'base64':        H.base64,
  'csv':           H.csv,
};

function renderOutput() {
  plainOutput = formatters[activeFormat](cookies);
  ui.output.innerHTML = highlighters[activeFormat](plainOutput);
}

function showToast(msg, type = '') {
  clearTimeout(toastTimer);
  ui.toast.textContent = msg;
  ui.toast.className   = `toast show${type ? ' ' + type : ''}`;
  toastTimer = setTimeout(() => {
    ui.toast.className = `toast${type ? ' ' + type : ''}`;
    setTimeout(() => { ui.toast.className = 'toast'; }, 220);
  }, 2200);
}

function resetCopyBtn() {
  clearTimeout(copyTimer);
  ui.copyLabel.textContent = 'Copy';
  ui.copyIcon.classList.remove('hidden');
  ui.checkIcon.classList.add('hidden');
}

function showOverlay(which) {
  [ui.stateLoading, ui.stateEmpty, ui.stateError].forEach(el => el.classList.add('hidden'));
  if (which) which.classList.remove('hidden');
}

async function extract() {
  cookies      = [];
  plainOutput  = '';
  ui.output.innerHTML      = '';
  ui.copyBtn.disabled      = true;
  ui.downloadBtn.disabled  = true;
  ui.siteLabel.textContent  = 'Detecting…';
  ui.countLabel.textContent = '—';
  ui.domainLabel.textContent = '—';
  showOverlay(ui.stateLoading);
  resetCopyBtn();

  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    showOverlay(ui.stateError);
    ui.errorMessage.textContent = 'Could not access browser tabs';
    ui.siteLabel.textContent    = 'error';
    return;
  }

  if (!tab?.url || /^(chrome|about|edge|brave):/.test(tab.url)) {
    showOverlay(ui.stateError);
    ui.errorMessage.textContent = 'Cannot access cookies on this page';
    ui.siteLabel.textContent    = 'restricted page';
    return;
  }

  activeDomain = new URL(tab.url).hostname;
  ui.siteLabel.textContent   = activeDomain;
  ui.domainLabel.textContent = activeDomain;

  try {
    cookies = await chrome.cookies.getAll({ url: tab.url });
  } catch {
    showOverlay(ui.stateError);
    ui.errorMessage.textContent = 'Permission denied reading cookies';
    return;
  }

  ui.countLabel.textContent = `${cookies.length} cookie${cookies.length !== 1 ? 's' : ''}`;

  if (!cookies.length) { showOverlay(ui.stateEmpty); return; }

  showOverlay(null);
  renderOutput();
  ui.copyBtn.disabled     = false;
  ui.downloadBtn.disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(localStorage.getItem(STORAGE_THEME) || 'dark');
  activateFormat(activeFormat);

  document.getElementById('version-label').textContent = `v${chrome.runtime.getManifest().version}`;

  ui.themeToggle.addEventListener('click', toggleTheme);
  ui.refreshBtn.addEventListener('click', extract);

  ui.formatTrigger.addEventListener('click', e => {
    e.stopPropagation();
    dropdownOpen ? closeDropdown() : openDropdown();
  });

  ui.fmtOptions.forEach(opt => opt.addEventListener('click', () => activateFormat(opt.dataset.format)));

  document.addEventListener('click', e => {
    if (dropdownOpen && !ui.formatDropdown.contains(e.target) && e.target !== ui.formatTrigger) {
      closeDropdown();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dropdownOpen) closeDropdown();
  });

  ui.copyBtn.addEventListener('click', async () => {
    if (!plainOutput) return;
    try {
      await navigator.clipboard.writeText(plainOutput);
      ui.checkIcon.classList.remove('hidden');
      ui.copyIcon.classList.add('hidden');
      ui.copyLabel.textContent = 'Copied!';
      showToast('Copied to clipboard 🍪', 'success');
      copyTimer = setTimeout(resetCopyBtn, 2200);
    } catch {
      showToast('Copy failed — check permissions', 'error');
    }
  });

  ui.downloadBtn.addEventListener('click', () => {
    if (!plainOutput) return;
    const ext  = FORMAT_META[activeFormat].ext;
    const name = `cookies_${activeDomain.replace(/\W+/g, '_')}_${activeFormat}.${ext}`;
    const blob = new Blob([plainOutput], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: name }).click();
    URL.revokeObjectURL(url);
    showToast('File saved', 'success');
  });

  extract();
});

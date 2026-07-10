// Temi dell'app (Ismail 2026-07-07): light (default), dark, retro (sepia caldo),
// bw (monocromo). Applica una classe su <body> e persiste la scelta in localStorage.
// Mantiene la variabile globale `darkMode` (usata da themeCanvasLineColor in rendering.js
// e dalle regole body.dark-mode) coerente: true SOLO quando il tema e' 'dark'.
const DARK_MODE_STORAGE_KEY = 'baseflow-dark-mode'; // legacy (migrazione)
const THEME_STORAGE_KEY = 'baseflow-theme';
const THEMES = ['light', 'dark', 'retro', 'bw', 'ocean', 'chalk', 'neon', 'contrast'];
// Temi "scuri" (lavagna/neon/dark): linee e testo del canvas vanno chiari.
function isDarkTheme(t) { return t === 'dark' || t === 'chalk' || t === 'neon'; }
let currentTheme = 'light';
// Valore SELEZIONATO nel menu a tendina: un tema builtin ('light'...) oppure un tema
// personalizzato ('custom:NOME'). Distinto da currentTheme (il tema BASE builtin su cui il
// tema personalizzato applica i propri colori).
let _activeThemeValue = 'light';

function applyThemeClass() {
  if (typeof document === 'undefined' || !document.body || !document.body.classList) return;
  const cl = document.body.classList;
  if (typeof cl.toggle !== 'function') return;
  cl.toggle('dark-mode', currentTheme === 'dark' || currentTheme === 'chalk' || currentTheme === 'neon');
  ['retro', 'bw', 'ocean', 'chalk', 'neon', 'contrast'].forEach(function (t) {
    cl.toggle('theme-' + t, currentTheme === t);
  });
  darkMode = isDarkTheme(currentTheme);
  const sel = document.getElementById('theme-select');
  if (sel && sel.value !== _activeThemeValue) sel.value = _activeThemeValue;
}

function setTheme(name) {
  if (THEMES.indexOf(name) === -1) name = 'light';
  currentTheme = name;
  _activeThemeValue = name;
  clearCustomVars(); // passando a un tema builtin si rimuovono i colori di un tema personalizzato
  applyThemeClass();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, name);
      localStorage.setItem(DARK_MODE_STORAGE_KEY, name === 'dark' ? '1' : '0');
    }
  } catch (e) { /* localStorage non disponibile: non bloccante */ }
  if (typeof refreshThemeSelect === 'function') refreshThemeSelect();
  if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
}

function toggleDarkMode() { setTheme(currentTheme === 'dark' ? 'light' : 'dark'); }

function loadDarkModePreference() {
  let stored = null;
  try { if (typeof localStorage !== 'undefined') stored = localStorage.getItem(THEME_STORAGE_KEY); } catch (e) {}
  if (stored && stored.indexOf('custom:') === 0) {
    const nm = stored.slice(7);
    if (_customThemes()[nm]) { applyCustomTheme(nm, true); refreshThemeSelect(); return; }
  }
  try {
    if (typeof localStorage !== 'undefined') {
      if (stored && THEMES.indexOf(stored) !== -1) currentTheme = stored;
      else currentTheme = (localStorage.getItem(DARK_MODE_STORAGE_KEY) === '1') ? 'dark' : 'light';
    }
  } catch (e) { currentTheme = 'light'; }
  _activeThemeValue = currentTheme;
  applyThemeClass();
  refreshThemeSelect();
}

// ============================================================================
// TEMI PERSONALIZZATI (Ismail 2026-07-08): l'utente crea un tema dando un NOME e scegliendo
// i colori. Il tema si salva nel browser (compare nel menu) E si scarica come file .json
// (backup/condivisione, ricaricabile con "Carica tema"). Le voci "Crea nuovo tema" e "Carica
// tema" stanno in fondo al menu dei temi. I colori sono tutti variabili CSS.
// ============================================================================
const THEME_EDITABLE = [
  { group: 'Nodi', vars: [
    ['--node-start', 'Start'], ['--node-end', 'End'], ['--node-input', 'Input'], ['--node-output', 'Output/Print'],
    ['--node-assign', 'Assegna'], ['--node-if', 'If'], ['--node-while', 'While'], ['--node-for', 'For'],
    ['--node-do', 'Do'], ['--node-comment', 'Commento'], ['--node-pause', 'Pausa'] ] },
  { group: 'Grafica (turtle)', vars: [
    ['--node-forward', 'Move/Draw'], ['--node-turn', 'Turn'], ['--node-home', 'Home'], ['--node-pen', 'Pen'], ['--node-gclear', 'Clear'] ] },
  { group: 'Archi & etichette', vars: [
    ['--canvas-line-color', 'Linee/archi'], ['--if-true-color', 'Vero/True'], ['--if-false-color', 'Falso/False'],
    ['--arc-hover-color', 'Arco (hover)'] ] },
  { group: 'Esecuzione', vars: [
    ['--exec-node-color', 'Nodo in esecuzione'], ['--exec-edge-color', 'Arco percorso'], ['--exec-error-color', 'Blocco in errore'] ] }
];
const CUSTOM_THEMES_KEY = 'baseflow-custom-themes';
let _draftColors = {};

function _tt(key, fb) { try { const s = (typeof i18nText === 'function') ? i18nText(key) : null; return s || fb; } catch (e) { return fb; } }
function _rgbToHex(c) {
  if (!c) return '#000000';
  c = c.trim();
  if (c[0] === '#') { if (c.length === 4) return '#' + c[1]+c[1]+c[2]+c[2]+c[3]+c[3]; return c; }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return '#000000';
  const p = m[1].split(',').map(function (x) { return parseInt(x.trim(), 10); });
  return '#' + [p[0], p[1], p[2]].map(function (n) { return ('0' + (n & 255).toString(16)).slice(-2); }).join('');
}
function _allEditableVars() { const a = []; THEME_EDITABLE.forEach(function (g) { g.vars.forEach(function (v) { a.push(v[0]); }); }); return a; }
function clearCustomVars() {
  if (typeof document === 'undefined' || !document.documentElement) return;
  const root = document.documentElement.style;
  _allEditableVars().forEach(function (k) { root.removeProperty(k); });
}
function _customThemes() { try { return JSON.parse(localStorage.getItem(CUSTOM_THEMES_KEY)) || {}; } catch (e) { return {}; } }
function _saveCustomThemes(o) { try { localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(o)); } catch (e) {} }

function refreshThemeSelect() {
  const sel = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('theme-select') : null;
  // Guardia per ambienti headless/mock (test): serve un <select> reale con querySelectorAll
  // e un document.createElement funzionante.
  if (!sel || typeof sel.querySelectorAll !== 'function' || typeof document.createElement !== 'function') return;
  Array.prototype.slice.call(sel.querySelectorAll('option[data-dyn]')).forEach(function (o) { if (o && o.remove) o.remove(); });
  const mk = function (val, txt, disabled) {
    const o = document.createElement('option'); o.value = val; o.textContent = txt;
    o.setAttribute('data-dyn', ''); if (disabled) o.disabled = true; return o;
  };
  const custom = _customThemes(); const names = Object.keys(custom);
  if (names.length) {
    sel.appendChild(mk('__grp__', '── ' + _tt('theme_custom_group', 'I miei temi') + ' ──', true));
    names.forEach(function (nm) { sel.appendChild(mk('custom:' + nm, '\u25C8 ' + nm)); });
  }
  // create/load NON sono piu' voci del <select> (un <option> non puo' contenere un'icona
  // vettoriale): sono diventati due pulsanti allineati sotto "Tema" (con SVG). Vedi settings.
  sel.value = _activeThemeValue;
}

function onThemeSelect(value) {
  const sel = document.getElementById('theme-select');
  if (value === '__create__' || value === '__load__') {
    if (value === '__create__') startCreateTheme();
    else { const inp = document.getElementById('theme-file-input'); if (inp) inp.click(); }
    if (sel) sel.value = _activeThemeValue;
    return;
  }
  if (value === '__grp__' || value === '__sep__') { if (sel) sel.value = _activeThemeValue; return; }
  if (value && value.indexOf('custom:') === 0) { applyCustomTheme(value.slice(7)); return; }
  setTheme(value);
}

function applyCustomTheme(name, skipPersist) {
  const ct = _customThemes()[name];
  if (!ct) { _activeThemeValue = 'light'; setTheme('light'); return; }
  currentTheme = (ct.base && THEMES.indexOf(ct.base) !== -1) ? ct.base : 'light';
  applyThemeClass();
  clearCustomVars();
  const root = document.documentElement.style;
  Object.keys(ct.colors || {}).forEach(function (k) { root.setProperty(k, ct.colors[k]); });
  _activeThemeValue = 'custom:' + name;
  if (!skipPersist) { try { localStorage.setItem(THEME_STORAGE_KEY, 'custom:' + name); } catch (e) {} }
  refreshThemeSelect();
  if (typeof resizeCanvas === 'function') resizeCanvas();
  else if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
}

function startCreateTheme() {
  _draftColors = {};
  openThemeEditor();
  const nameInp = document.getElementById('te-name');
  if (nameInp) { nameInp.value = ''; nameInp.style.borderColor = ''; setTimeout(function () { try { nameInp.focus(); } catch (e) {} }, 60); }
}
function openThemeEditor() {
  const box = document.getElementById('theme-editor'); const body = document.getElementById('te-body');
  if (!box || !body) return;
  const cs = getComputedStyle(document.documentElement);
  let html = '';
  THEME_EDITABLE.forEach(function (grp) {
    html += '<div class="te-group">' + grp.group + '</div>';
    grp.vars.forEach(function (v) {
      const cur = _draftColors[v[0]] || _rgbToHex((cs.getPropertyValue(v[0]) || '').trim());
      _draftColors[v[0]] = cur;
      html += '<label class="te-row"><span>' + v[1] + '</span>' +
        '<input type="color" value="' + cur + '" oninput="setDraftColor(\'' + v[0] + '\', this.value)"></label>';
    });
  });
  body.innerHTML = html;
  box.removeAttribute('hidden');
  const ov = document.getElementById('overlay'); if (ov) ov.classList.add('active');
}
function setDraftColor(varName, value) {
  _draftColors[varName] = value;
  document.documentElement.style.setProperty(varName, value);
  if (typeof resizeCanvas === 'function') resizeCanvas();
  else if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
}
function resetDraftColors() {
  _draftColors = {};
  clearCustomVars();
  _reapplyActiveTheme();
  openThemeEditor();
}
function _reapplyActiveTheme() {
  if (_activeThemeValue.indexOf('custom:') === 0) applyCustomTheme(_activeThemeValue.slice(7), true);
  else if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
}
function cancelThemeEditor() {
  _draftColors = {};
  clearCustomVars();
  _reapplyActiveTheme();
  const box = document.getElementById('theme-editor'); if (box) box.setAttribute('hidden', '');
  const ov = document.getElementById('overlay'); if (ov) ov.classList.remove('active');
}
function saveNewTheme() {
  const nameInp = document.getElementById('te-name');
  const name = ((nameInp && nameInp.value) || '').trim();
  if (!name) {
    if (nameInp) { nameInp.style.borderColor = '#e53935'; try { nameInp.focus(); } catch (e) {} }
    try { if (typeof showStyledAlert==='function') showStyledAlert(_tt('theme_name_req', 'Dai un nome al tema prima di salvarlo.'),{danger:true}); else alert(_tt('theme_name_req','')); } catch (e) {}
    return;
  }
  const cs = getComputedStyle(document.documentElement);
  const colors = {};
  _allEditableVars().forEach(function (k) { colors[k] = _draftColors[k] || _rgbToHex((cs.getPropertyValue(k) || '').trim()); });
  const base = (_activeThemeValue.indexOf('custom:') === 0)
    ? ((_customThemes()[_activeThemeValue.slice(7)] || {}).base || 'light')
    : (THEMES.indexOf(_activeThemeValue) !== -1 ? _activeThemeValue : 'light');
  const theme = { name: name, base: base, colors: colors };
  const all = _customThemes(); all[name] = theme; _saveCustomThemes(all);
  downloadTheme(theme);
  const box = document.getElementById('theme-editor'); if (box) box.setAttribute('hidden', '');
  const ov = document.getElementById('overlay'); if (ov) ov.classList.remove('active');
  _draftColors = {};
  applyCustomTheme(name);
}
function downloadTheme(theme) {
  try {
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (theme.name || 'tema').replace(/[^\w\-]+/g, '_') + '.baseflow-theme.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  } catch (e) { /* download non disponibile: il tema resta salvato nel browser */ }
}
function loadThemeFromFile(input) {
  const f = input && input.files && input.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = function () {
    try {
      const th = JSON.parse(r.result);
      if (!th || typeof th !== 'object' || !th.colors || typeof th.colors !== 'object') throw new Error('bad');
      let name = (th.name || (f.name || 'tema').replace(/\.[^.]*$/, '').replace(/\.baseflow-theme$/, '')).trim();
      if (!name) name = 'tema';
      th.name = name;
      if (!th.base || THEMES.indexOf(th.base) === -1) th.base = 'light';
      const all = _customThemes(); all[name] = th; _saveCustomThemes(all);
      applyCustomTheme(name);
    } catch (e) {
      try { if (typeof showStyledAlert==='function') showStyledAlert(_tt('theme_load_err', 'File tema non valido.'),{danger:true}); else alert(_tt('theme_load_err','')); } catch (e2) {}
    }
    try { input.value = ''; } catch (e) {}
  };
  r.readAsText(f);
}

if (typeof window !== 'undefined') window.addEventListener('load', function () { try { refreshThemeSelect(); } catch (e) {} });

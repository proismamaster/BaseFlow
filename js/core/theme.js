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

// WP (2026-07-19, Ismail, "il manuale ha sempre gli stessi colori nonostante il tema"):
// #manual-iframe (index.html) carica manual.html una volta sola per sessione e non si
// ricarica mai alle riaperture (vedi openManualOverlay, popups.js) -- quindi se il manuale e'
// GIA' aperto (o resta in memoria dopo essere stato aperto) mentre l'utente cambia tema qui,
// il suo documento non lo saprebbe mai da solo. manual.html espone window._bfApplyManualTheme
// apposta per essere richiamata dall'esterno; qui la si richiama ad ogni cambio tema, cosi' il
// manuale resta sincronizzato anche live, non solo alla prossima riapertura (quel caso e' gia'
// coperto separatamente in openManualOverlay). Difensivo/no-op se il manuale non e' mai stato
// aperto in questa sessione (iframe senza src, contentWindow senza quella funzione).
function _bfSyncManualTheme() {
  try {
    var ifr = (typeof document !== 'undefined') ? document.getElementById('manual-iframe') : null;
    if (ifr && ifr.contentWindow && typeof ifr.contentWindow._bfApplyManualTheme === 'function') {
      ifr.contentWindow._bfApplyManualTheme();
    }
  } catch (e) { /* same-origin, non dovrebbe mai fallire: difensivo */ }
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
  _bfSyncManualTheme();
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
// Ogni voce: [variabile CSS, chiave i18n, etichetta di fallback IT se i18nText non c'e'].
// Il gruppo usa la stessa convenzione: [chiave i18n, fallback IT]. Tradotto in base alla
// lingua attiva da openThemeEditor() tramite _tt(), come gia' il resto della UI.
const THEME_EDITABLE = [
  { groupKey: 'theme_grp_ui', groupFallback: 'Interfaccia', vars: [
    ['--bg', 'theme_var_bg', 'Sfondo pagina'], ['--surface', 'theme_var_surface', 'Pannelli/superficie'],
    ['--primary', 'theme_var_primary', 'Pulsanti/colore principale'], ['--primary-dark', 'theme_var_primarydark', 'Colore principale (scuro/hover)'],
    ['--accent', 'theme_var_accent', 'Accento'], ['--border', 'theme_var_border', 'Bordi'], ['--text', 'theme_var_text', 'Testo'] ] },
  { groupKey: 'theme_grp_nodes', groupFallback: 'Nodi', vars: [
    // Riusa le STESSE chiavi i18n gia' usate per i nomi reali dei nodi/blocchi
    // (nd_*/blk_*, es. "Se"/"Mentre"/"Per" in italiano) — cosi' l'editor tema mostra
    // sempre l'etichetta IDENTICA a quella che l'utente vede sul blocco vero, in
    // qualunque lingua, senza una seconda traduzione da tenere allineata a mano.
    ['--node-start', 'nd_start', 'Start'], ['--node-end', 'nd_end', 'End'],
    ['--node-input', 'blk_input', 'Input'], ['--node-output', 'blk_output', 'Output/Print'],
    ['--node-assign', 'blk_assign', 'Assegna'], ['--node-if', 'blk_if', 'If'],
    ['--node-while', 'blk_while', 'While'], ['--node-for', 'blk_for', 'For'],
    ['--node-do', 'blk_dowhile', 'Do'], ['--node-comment', 'blk_comment', 'Commento'],
    ['--node-pause', 'blk_pause', 'Pausa'] ] },
  { groupKey: 'theme_grp_turtle', groupFallback: 'Grafica (turtle)', vars: [
    ['--node-forward', 'blk_forward', 'Move/Draw'], ['--node-turn', 'blk_turn', 'Turn'],
    ['--node-home', 'blk_home', 'Home'], ['--node-pen', 'blk_pen', 'Pen'],
    ['--node-gclear', 'blk_clearscreen', 'Clear'] ] },
  { groupKey: 'theme_grp_arcs', groupFallback: 'Archi & etichette', vars: [
    ['--canvas-line-color', 'theme_var_line', 'Linee/archi'], ['--if-true-color', 'theme_var_true', 'Vero/True'],
    ['--if-false-color', 'theme_var_false', 'Falso/False'], ['--arc-hover-color', 'theme_var_archover', 'Arco (hover)'],
    // R12-E/E1 (Ismail 2026-07-11): --arc-drag-color esisteva gia' (rendering.js arcDragColor(),
    // usata per l'arrowhead dell'arco target durante il drag di un nodo -- vedi anche il fix
    // fatto in questo stesso WP per allineare corpo-linea/nodo-trascinato/ghost allo stesso
    // colore) ma non compariva nell'editor: l'utente non poteva personalizzarla.
    ['--arc-drag-color', 'theme_var_arcdrag', 'Arco (drag)'] ] },
  { groupKey: 'theme_grp_exec', groupFallback: 'Esecuzione', vars: [
    ['--exec-node-color', 'theme_var_execnode', 'Nodo in esecuzione'], ['--exec-edge-color', 'theme_var_execedge', 'Arco percorso'],
    ['--exec-error-color', 'theme_var_execerr', 'Blocco in errore'],
    // P (round 15, Ismail): il colore del TESTO dentro i blocchi ora e' personalizzabile.
    ['--node-text', 'theme_var_nodetext', 'Testo blocchi'],
    // R12-E/E1: --node-selected-color esisteva gia' (rendering.js, bordo di selezione a click
    // singolo, feature C4 round 11) ma non era nell'editor.
    ['--node-selected-color', 'theme_var_nodesel', 'Blocco selezionato'] ] },
  // R12-E/E2 (Ismail 2026-07-11): il pulsante Stop del terminale era rosso FISSO (style.css
  // #console-stop, mai una CSS var) -- nuovo gruppo dedicato ai controlli del terminale.
  { groupKey: 'theme_grp_console', groupFallback: 'Terminale', vars: [
    ['--stop-btn-color', 'theme_var_stopbtn', 'Pulsante Stop'] ] }
];
const CUSTOM_THEMES_KEY = 'baseflow-custom-themes';
let _draftColors = {};

// AUDIT 2026-07-19 (#8): un valore è un colore accettabile solo se hex (#rgb / #rrggbb /
// #rrggbbaa). I temi personalizzati arrivano da localStorage e vengono applicati via
// setProperty su variabili CSS: limitarli a hex evita che un valore malformato o inatteso
// entri nel CSSOM (robustezza + difesa in profondità). Il color-picker produce già solo hex.
function _bfIsValidColorVar(v) {
  return typeof v === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v.trim());
}

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
  // AUDIT 2026-07-19 (#8): applica SOLO valori colore validi (#rgb/#rrggbb/#rrggbbaa) e SOLO
  // chiavi che sono variabili --node/-- note (mai proprietà arbitrarie). I temi vengono da
  // localStorage: chi lo scrive è già same-origin, ma questa è difesa in profondità/robustezza
  // (un valore malformato non "sporca" più il CSSOM, un file di temi rovinato non rompe la UI).
  Object.keys(ct.colors || {}).forEach(function (k) {
    if (/^--[\w-]+$/.test(k) && _bfIsValidColorVar(ct.colors[k])) root.setProperty(k, ct.colors[k]);
  });
  _activeThemeValue = 'custom:' + name;
  if (!skipPersist) { try { localStorage.setItem(THEME_STORAGE_KEY, 'custom:' + name); } catch (e) {} }
  refreshThemeSelect();
  if (typeof resizeCanvas === 'function') resizeCanvas();
  else if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
  _bfSyncManualTheme();
}

function startCreateTheme() {
  _draftColors = {};
  openThemeEditor();
  const nameInp = document.getElementById('te-name');
  if (nameInp) { nameInp.value = ''; nameInp.style.borderColor = ''; setTimeout(function () { try { nameInp.focus(); } catch (e) {} }, 60); }
}
// R12-E/E3 (Ismail 2026-07-11): legge il valore CORRENTE di una var, per il tema REALMENTE
// attivo. BUG trovato: prima si leggeva sempre getComputedStyle(document.documentElement)
// (l'elemento <html>), ma applyThemeClass() mette le classi tema/dark-mode su document.BODY
// ("body.theme-neon { --primary: ... }", "body.dark-mode { ... }", vedi style.css) -- <body>
// e' un FIGLIO di <html>, quindi le sue regole non "risalgono" mai a modificare cio' che
// getComputedStyle(document.documentElement) restituisce: quella chiamata vedeva SEMPRE e SOLO
// i valori di default di :root (tema chiaro), MAI quelli del tema scuro/neon/ecc. realmente
// attivo -- motivo per cui "Crea nuovo tema" mostrava sempre gli stessi colori di fabbrica.
// Fix: legge da document.body (dove il cascade e' quello VERO per l'utente); se la var non e'
// ridefinita dal tema attivo (nessuna regola body.* la tocca) il valore e' comunque ereditato
// correttamente da :root tramite il normale cascade -- il fallback esplicito su
// getComputedStyle(document.documentElement) sotto copre solo il caso limite in cui anche
// l'eredita' desse una stringa vuota (var mai definita da nessuna parte).
function _activeVarValue(varName) {
  let raw = '';
  try { raw = (getComputedStyle(document.body).getPropertyValue(varName) || '').trim(); } catch (e) {}
  if (!raw) { try { raw = (getComputedStyle(document.documentElement).getPropertyValue(varName) || '').trim(); } catch (e) {} }
  return raw;
}
function openThemeEditor() {
  const box = document.getElementById('theme-editor'); const body = document.getElementById('te-body');
  if (!box || !body) return;
  let html = '';
  THEME_EDITABLE.forEach(function (grp) {
    html += '<div class="te-group">' + _tt(grp.groupKey, grp.groupFallback) + '</div>';
    grp.vars.forEach(function (v) {
      const cur = _draftColors[v[0]] || _rgbToHex(_activeVarValue(v[0]));
      _draftColors[v[0]] = cur;
      html += '<label class="te-row"><span>' + _tt(v[1], v[2]) + '</span>' +
        '<input type="color" value="' + cur + '" oninput="setDraftColor(\'' + v[0] + '\', this.value)"></label>';
    });
  });
  body.innerHTML = html;
  box.removeAttribute('hidden');
  const ov = document.getElementById('overlay'); if (ov) ov.classList.add('active');
  // P (round 15, Ismail): registra nell'overlay-stack condiviso (R13-F) cosi' Esc chiude
  // ANCHE il popup crea-tema, coerente con tutti gli altri popup.
  if (typeof _bfPushOverlay === 'function') _bfPushOverlay('theme-editor');
  // WP-D5 (round 15-D): Enter = Salva tema.
  if (typeof _bfWireDialogKeys === 'function') _bfWireDialogKeys(box, saveNewTheme);
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
  if (typeof _bfPopOverlay === 'function') _bfPopOverlay('theme-editor');
}
function saveNewTheme() {
  const nameInp = document.getElementById('te-name');
  const name = ((nameInp && nameInp.value) || '').trim();
  if (!name) {
    // R12-E/E4: bordo di errore del campo nome -- segue --bf-danger (tema/dark/bw) invece di
    // un rosso fisso, stesso var usato per le altre segnalazioni "danger" della UI.
    if (nameInp) { nameInp.style.borderColor = _activeVarValue('--bf-danger') || '#e53935'; try { nameInp.focus(); } catch (e) {} }
    try { if (typeof showStyledAlert==='function') showStyledAlert(_tt('theme_name_req', 'Dai un nome al tema prima di salvarlo.'),{danger:true}); else alert(_tt('theme_name_req','')); } catch (e) {}
    return;
  }
  const colors = {};
  // R12-E/E3: stesso fix di openThemeEditor() -- fallback su document.body, non document.documentElement.
  _allEditableVars().forEach(function (k) { colors[k] = _draftColors[k] || _rgbToHex(_activeVarValue(k)); });
  const base = (_activeThemeValue.indexOf('custom:') === 0)
    ? ((_customThemes()[_activeThemeValue.slice(7)] || {}).base || 'light')
    : (THEMES.indexOf(_activeThemeValue) !== -1 ? _activeThemeValue : 'light');
  const theme = { name: name, base: base, colors: colors };
  const all = _customThemes(); all[name] = theme; _saveCustomThemes(all);
  downloadTheme(theme);
  const box = document.getElementById('theme-editor'); if (box) box.setAttribute('hidden', '');
  const ov = document.getElementById('overlay'); if (ov) ov.classList.remove('active');
  if (typeof _bfPopOverlay === 'function') _bfPopOverlay('theme-editor');
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

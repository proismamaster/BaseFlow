// ============================================================================
// Popup IMPOSTAZIONI globale (Ismail 2026-07-09d).
// Un tempo le uniche "impostazioni" erano quelle del terminale (pannello interno alla
// console). Ora c'e' un pulsante Impostazioni GLOBALE nella toolbar che apre un vero popup
// modale con TUTTE le impostazioni dell'app: lingua, tema (+ creazione tema), velocita'
// dell'animazione e messaggi mostrati dal terminale. I controlli mantengono i loro id
// originali (theme-select, lang-select, run-speed, cset-*), quindi tutta la logica esistente
// in theme.js / i18n.js / execute.js continua a funzionare senza modifiche.
// ============================================================================
// D3 (round 11): impostazioni Prestazioni -- stesso pattern di consoleSettings (execute.js):
// oggetto in modulo + persistenza localStorage con Object.assign sul default (cosi' un valore
// futuro aggiunto al default non viene perso se il localStorage salvato e' "vecchio").
var perfSettings = { reducedAnim: false, hoverHighlight: true };
try {
  const _ps = (typeof localStorage !== 'undefined') ? JSON.parse(localStorage.getItem('baseflow-perf')) : null;
  if (_ps && typeof _ps === 'object') perfSettings = Object.assign(perfSettings, _ps);
} catch (e) { /* non bloccante */ }
function savePerfSettings() { try { if (typeof localStorage !== 'undefined') localStorage.setItem('baseflow-perf', JSON.stringify(perfSettings)); } catch (e) {} }
// Applica gli EFFETTI reali delle impostazioni correnti (classe su body + pulizia hover
// residuo). Va chiamata sia al toggle sia al caricamento pagina (init.js).
function applyPerfSettings() {
  if (typeof document !== 'undefined' && document.body && document.body.classList) {
    document.body.classList.toggle('perf-reduced', !!perfSettings.reducedAnim);
  }
  // D3: quando l'hover si disattiva, ripulisci UNA VOLTA un'eventuale evidenziazione residua
  // (onCanvasHover da qui in poi fa early-return e non la ripulirebbe piu' da solo).
  if (!perfSettings.hoverHighlight && typeof hoverArc !== 'undefined' && hoverArc) {
    hoverArc = null;
    if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
  }
}
function togglePerfSetting(key, val) {
  perfSettings[key] = !!val;
  savePerfSettings();
  applyPerfSettings();
}
function syncPerfSettingsUI() {
  const a = document.getElementById('perf-anim'); if (a) a.checked = !!perfSettings.reducedAnim;
  const h = document.getElementById('perf-hover'); if (h) h.checked = !!perfSettings.hoverHighlight;
}

// WP-D9 (round 15-D, Ismail 2026-07-17): impostazioni di VISTA del canvas (sotto-WP "Griglia").
// Oggetto ISOLATO (non tocca perfSettings/consoleSettings) con la sua chiave localStorage, stesso
// pattern robusto (Object.assign sul default -> un valore futuro non va perso su un salvataggio
// vecchio). La griglia e' SOLO visiva (rendering.js draw): non cambia il layout logico dei nodi.
var viewSettings = { showGrid: false };
try {
  const _vs = (typeof localStorage !== 'undefined') ? JSON.parse(localStorage.getItem('baseflow-view')) : null;
  if (_vs && typeof _vs === 'object') viewSettings = Object.assign(viewSettings, _vs);
} catch (e) { /* non bloccante */ }
function saveViewSettings() { try { if (typeof localStorage !== 'undefined') localStorage.setItem('baseflow-view', JSON.stringify(viewSettings)); } catch (e) {} }
function applyViewSettings() {
  // L'unico effetto e' un redraw: draw() legge viewSettings.showGrid e disegna (o no) la griglia.
  if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
}
function toggleViewSetting(key, val) {
  viewSettings[key] = !!val;
  saveViewSettings();
  applyViewSettings();
}
function syncViewSettingsUI() {
  const g = document.getElementById('view-grid'); if (g) g.checked = !!viewSettings.showGrid;
}

function openSettingsPopup() {
  const p = document.getElementById('settings-popup');
  if (!p) return;
  // Sincronizza i controlli con lo stato corrente prima di mostrarli.
  try { if (typeof syncConsoleSettingsUI === 'function') syncConsoleSettingsUI(); } catch (e) {}
  try { syncPerfSettingsUI(); } catch (e) {}
  try { syncViewSettingsUI(); } catch (e) {}
  try {
    const ls = document.getElementById('lang-select');
    if (ls && typeof currentLang !== 'undefined') ls.value = currentLang;
  } catch (e) {}
  try { if (typeof refreshThemeSelect === 'function') refreshThemeSelect(); } catch (e) {}
  try {
    const rs = document.getElementById('run-speed');
    if (rs && typeof runSpeed !== 'undefined') rs.value = String(runSpeed);
  } catch (e) {}
  p.classList.add('active');
  const ov = document.getElementById('overlay'); if (ov) ov.classList.add('active');
  if (typeof _bfPushOverlay === 'function') _bfPushOverlay('settings-popup'); // R13-F: registro condiviso Esc
  // P2.4 (round 15-B S1): apertura = sempre in primo piano (ux.js), coerente col raise-on-click.
  if (typeof bfBringToFrontPopup === 'function') bfBringToFrontPopup(p);
}

function closeSettingsPopup() {
  const p = document.getElementById('settings-popup');
  if (p) p.classList.remove('active');
  if (typeof _bfPopOverlay === 'function') _bfPopOverlay('settings-popup');
  // Rimuove l'overlay solo se l'editor dei temi (che ha il proprio ciclo di vita) non e' aperto.
  const te = document.getElementById('theme-editor');
  const teOpen = te && !te.hasAttribute('hidden');
  if (!teOpen) { const ov = document.getElementById('overlay'); if (ov) ov.classList.remove('active'); }
}

// Apre l'editor dei temi partendo dal popup impostazioni (chiude prima le impostazioni,
// cosi' i due modali non si accavallano).
function startCreateThemeFromSettings() {
  closeSettingsPopup();
  if (typeof startCreateTheme === 'function') startCreateTheme();
}
// Rilievo 33: "Carica tema" come pulsante (icona cartella vettoriale), non piu' voce del menu.
function loadThemeFromSettings() {
  const inp = document.getElementById('theme-file-input');
  if (inp) inp.click();
}

if (typeof window !== 'undefined') {
  window.openSettingsPopup = openSettingsPopup;
  window.closeSettingsPopup = closeSettingsPopup;
  window.startCreateThemeFromSettings = startCreateThemeFromSettings;
  window.loadThemeFromSettings = loadThemeFromSettings;
  window.togglePerfSetting = togglePerfSetting;
  window.applyPerfSettings = applyPerfSettings;
  window.syncPerfSettingsUI = syncPerfSettingsUI;
  window.toggleViewSetting = toggleViewSetting;
  window.applyViewSettings = applyViewSettings;
  window.syncViewSettingsUI = syncViewSettingsUI;
  window.viewSettings = viewSettings;
}

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
// WP-M2 (Ismail 2026-07-20, "aggiungere altre impostazioni per aumentare le performance"):
// + lowRes (canvas senza supersampling, vedi _bfRenderScale in layout.js) e consoleMax
// (il terminale tiene al massimo ~300 righe: su run lunghe il DOM non cresce all'infinito,
// vedi _bfTrimConsole in execute.js). consoleMax e' ON di default (taglia solo lo storico
// piu' vecchio, comportamento sano per tutti); lowRes OFF di default (scelta consapevole).
// WP-M5s (Ismail 2026-07-21, "un modo per aggiungere impostazioni per aumentare le prestazioni
// per i PC lenti che potrebbero laggare"): + `turbo`. Riguarda SOLO la velocita' "Istantanea",
// dove non c'e' nessuna animazione da guardare e tutto il lavoro speso per mostrare cosa sta
// succedendo e' puro costo. Con turbo attivo, durante l'esecuzione:
//   - nessuna evidenziazione del blocco corrente (ogni evidenziazione = un draw() del canvas);
//   - tabella Variabili aggiornata solo alla FINE, non ad ogni passo;
//   - in console solo l'output del programma: si saltano le righe di servizio
//     (Assegna:…, Condizione:… è vero/falso), che su un ciclo lungo sono la maggior parte.
// Il RISULTATO non cambia mai: cambia solo quanto si vede mentre succede. OFF di default --
// e' una rinuncia consapevole, non un default sensato per tutti.
// WP-M5t (Ismail 2026-07-21, "mettilo come opzione di sicurezza attivabile o meno, così non
// limitiamo gli esperti"): + `loopGuard`. E' la protezione anti-ciclo-infinito che ferma
// l'esecuzione dopo MAX_EXECUTION_STEPS passi. Resta ON di default -- per chi impara, un ciclo
// che non finisce e' un errore da segnalare, non una scelta -- ma ora si puo' spegnere per i
// programmi che quel tetto lo superano legittimamente.
// Spegnerla e' molto meno rischioso di prima: da WP-M5l il loop cede il controllo al browser
// ogni 64 passi anche a velocita' Istantanea, quindi anche un ciclo davvero infinito lascia la
// pagina reattiva e il pulsante Ferma funzionante.
// WP-M5z: + `fps`, indicatore diagnostico. Non migliora le prestazioni: serve a MISURARLE.
// Nato dai giri di "lagga" di oggi, dove per capire dove andasse il tempo ho dovuto scrivere
// harness ogni volta: con un numero a schermo la prossima segnalazione parte da un dato.
var perfSettings = { reducedAnim: false, hoverHighlight: true, lowRes: false, consoleMax: true, turbo: false, loopGuard: true, fps: false };
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
  if (typeof _bfSyncFpsMeter === 'function') _bfSyncFpsMeter(); // WP-M5z: accende/spegne l'indicatore
  // WP-M2: cambiare lowRes richiede di RIGENERARE il backing del canvas alla nuova scala
  // (stesso percorso dello zoom: calcoloY ricalcola resizeCanvasToFitNodes -> _bfRenderScale).
  if (typeof calcoloY === 'function' && typeof nodi !== 'undefined') { try { calcoloY(nodi); if (typeof draw === 'function') draw(nodi); } catch (e) {} }
}
function togglePerfSetting(key, val) {
  perfSettings[key] = !!val;
  savePerfSettings();
  applyPerfSettings();
}
function syncPerfSettingsUI() {
  const a = document.getElementById('perf-anim'); if (a) a.checked = !!perfSettings.reducedAnim;
  const h = document.getElementById('perf-hover'); if (h) h.checked = !!perfSettings.hoverHighlight;
  const l = document.getElementById('perf-lowres'); if (l) l.checked = !!perfSettings.lowRes; // WP-M2
  const c = document.getElementById('perf-conmax'); if (c) c.checked = !!perfSettings.consoleMax; // WP-M2
  const t = document.getElementById('perf-turbo'); if (t) t.checked = !!perfSettings.turbo; // WP-M5s
  const g = document.getElementById('perf-loopguard'); if (g) g.checked = !!perfSettings.loopGuard; // WP-M5t
  const f = document.getElementById('perf-fps'); if (f) f.checked = !!perfSettings.fps; // WP-M5z
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
  // WP-M5v: la griglia e' lo sfondo CSS del contenitore (non piu' dipinta nel canvas), quindi
  // accenderla/spegnerla non passa piu' da un redraw ma da _bfSyncCanvasGrid. Il draw() resta
  // per eventuali future impostazioni di vista che tocchino davvero il disegno.
  if (typeof _bfSyncCanvasGrid === 'function') _bfSyncCanvasGrid();
  if (typeof _bfSyncTurtleGrid === 'function') _bfSyncTurtleGrid(); // WP-M6a: stessa griglia nella tartaruga
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

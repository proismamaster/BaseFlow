// ============================================================================
// Popup IMPOSTAZIONI globale (Ismail 2026-07-09d).
// Un tempo le uniche "impostazioni" erano quelle del terminale (pannello interno alla
// console). Ora c'e' un pulsante Impostazioni GLOBALE nella toolbar che apre un vero popup
// modale con TUTTE le impostazioni dell'app: lingua, tema (+ creazione tema), velocita'
// dell'animazione e messaggi mostrati dal terminale. I controlli mantengono i loro id
// originali (theme-select, lang-select, run-speed, cset-*), quindi tutta la logica esistente
// in theme.js / i18n.js / execute.js continua a funzionare senza modifiche.
// ============================================================================
function openSettingsPopup() {
  const p = document.getElementById('settings-popup');
  if (!p) return;
  // Sincronizza i controlli con lo stato corrente prima di mostrarli.
  try { if (typeof syncConsoleSettingsUI === 'function') syncConsoleSettingsUI(); } catch (e) {}
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
}

function closeSettingsPopup() {
  const p = document.getElementById('settings-popup');
  if (p) p.classList.remove('active');
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
}

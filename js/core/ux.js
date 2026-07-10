// ============================================================================
// UX helpers (Ismail 2026-07-08, round 2):
//  (1) Tooltip moderni per i pulsanti SOLO-icona: mostrano solo l'icona e, al passaggio
//      del mouse, una piccola etichetta col nome della funzione. Il testo e' localizzato
//      (data-i18n-title, live) e il tooltip nativo del browser viene soppresso.
//  (2) Gestione "a finestre" (stile Windows) di terminale e popup dei blocchi: cliccando
//      una finestra questa passa in primo piano; l'altra resta aperta sullo sfondo.
// ============================================================================
(function () {
  // ---------- (1) Tooltip ----------
  function ensureTip() {
    let t = document.getElementById('bf-tip');
    if (!t) { t = document.createElement('div'); t.id = 'bf-tip'; t.setAttribute('role', 'tooltip'); document.body.appendChild(t); }
    return t;
  }
  function tipText(el) {
    const key = el.getAttribute('data-i18n-title');
    if (key && typeof i18nText === 'function') { const s = i18nText(key); if (s) return s; }
    return el.getAttribute('data-tip') || el.getAttribute('title') || '';
  }
  function iconEl(target) { return target && target.closest ? target.closest('.bf-icon, .x-close') : null; }
  function showTip(el) {
    const txt = tipText(el); if (!txt) return;
    const t = ensureTip(); t.textContent = txt;
    const r = el.getBoundingClientRect();
    const above = r.top > 44;
    t.classList.toggle('below', !above);
    t.style.left = Math.round(r.left + r.width / 2) + 'px';
    t.style.top = (above ? Math.round(r.top - 8) : Math.round(r.bottom + 8)) + 'px';
    t.classList.add('show');
  }
  function hideTip() { const t = document.getElementById('bf-tip'); if (t) t.classList.remove('show'); }
  document.addEventListener('mouseover', function (e) { const el = iconEl(e.target); if (el) showTip(el); });
  document.addEventListener('mouseout', function (e) { if (iconEl(e.target)) hideTip(); });
  document.addEventListener('mousedown', hideTip, true);
  window.addEventListener('scroll', hideTip, true);

  function stripNativeTitles() {
    if (!document.querySelectorAll) return;
    document.querySelectorAll('.bf-icon, .x-close').forEach(function (el) {
      if (el.hasAttribute('title')) { el.setAttribute('data-tip', el.getAttribute('title')); el.removeAttribute('title'); }
    });
  }

  // ---------- (2) Finestre (terminale + popup blocchi) ----------
  // Valori bassi (sotto l'overlay 1450 e i dialog modali 1480): il click porta la finestra
  // cliccata a 1443, l'altra scende a 1441. I dialog modali restano sempre sopra.
  const WINDOW_IDS = ['console-popup', 'popup-window', 'draw-output-panel'];
  var _bfZ = 1461; // contatore crescente: la finestra cliccata va sempre in cima (sotto i modali 1480)
  function bfBringToFront(el) {
    if (!el) return;
    _bfZ += 1;
    if (_bfZ > 1478) { // reset periodico: azzera tutte e riparti (evita di superare i modali)
      _bfZ = 1462;
      WINDOW_IDS.forEach(function (id) { const w = document.getElementById(id); if (w) w.style.zIndex = '1461'; });
    }
    el.style.zIndex = String(_bfZ);
  }
  window.bfBringToFront = bfBringToFront;
  function wireWindows() {
    WINDOW_IDS.forEach(function (id) {
      const w = document.getElementById(id);
      if (w && !w._bfWired) { w._bfWired = true; w.addEventListener('mousedown', function () { bfBringToFront(w); }, true); }
    });
  }

  window.addEventListener('load', function () {
    stripNativeTitles();
    wireWindows();
    // Re-strip dopo un cambio lingua (applyLanguage riscrive i title dei data-i18n-title).
    if (typeof window.applyLanguage === 'function' && !window.applyLanguage._bfWrapped) {
      const orig = window.applyLanguage;
      window.applyLanguage = function (l) { const r = orig.apply(this, arguments); try { stripNativeTitles(); } catch (e) {} return r; };
      window.applyLanguage._bfWrapped = true;
    }
  });
})();

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
  // R14-B.2 (Ismail 2026-07-13): estende lo stesso tooltip istantaneo (gia' usato per i
  // pulsanti .bf-icon/.x-close) a #project-identity e #unsaved-indicator -- prima
  // usavano il "title" nativo del browser, con ritardo del sistema operativo (il "?"
  // che compariva subito ma senza alcun testo leggibile finche' l'OS non decideva di
  // mostrare il tooltip). tipText() sotto legge gia' data-tip/title in tempo reale ad
  // ogni mouseover, quindi il contenuto DINAMICO di #project-identity (aggiornato da
  // updateProjectIdentity() in execute.js) resta sempre fresco senza modifiche qui.
  function iconEl(target) { return target && target.closest ? target.closest('.bf-icon, .x-close, #project-identity, #unsaved-indicator') : null; }
  function showTip(el) {
    const txt = tipText(el); if (!txt) return;
    const t = ensureTip(); t.textContent = txt;
    const r = el.getBoundingClientRect();
    const above = r.top > 44;
    t.classList.toggle('below', !above);
    t.classList.add('show'); // mostra PRIMA di misurare, cosi' offsetWidth e' affidabile
    // P (round 15, Ismail): il tooltip e' centrato sull'elemento (CSS transform:translateX(-50%));
    // per il pallino / #project-identity in fondo a destra il centro cade vicino al bordo e il
    // tooltip usciva dallo SCHERMO. Clamp del centro nel viewport (con un margine), cosi' resta
    // sempre interamente visibile su entrambi i lati (utile anche in RTL, a sinistra).
    let cx = Math.round(r.left + r.width / 2);
    const vw = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 0;
    const tw = t.offsetWidth || 0;
    if (vw && tw) {
      const half = tw / 2, margin = 6;
      if (cx - half < margin) cx = Math.round(half + margin);
      if (cx + half > vw - margin) cx = Math.round(vw - half - margin);
    }
    t.style.left = cx + 'px';
    t.style.top = (above ? Math.round(r.top - 8) : Math.round(r.bottom + 8)) + 'px';
  }
  function hideTip() { const t = document.getElementById('bf-tip'); if (t) t.classList.remove('show'); }
  document.addEventListener('mouseover', function (e) { const el = iconEl(e.target); if (el) showTip(el); });
  document.addEventListener('mouseout', function (e) { if (iconEl(e.target)) hideTip(); });
  document.addEventListener('mousedown', hideTip, true);
  window.addEventListener('scroll', hideTip, true);

  function stripNativeTitles() {
    if (!document.querySelectorAll) return;
    document.querySelectorAll('.bf-icon, .x-close, #project-identity, #unsaved-indicator').forEach(function (el) {
      if (el.hasAttribute('title')) { el.setAttribute('data-tip', el.getAttribute('title')); el.removeAttribute('title'); }
    });
  }

  // ---------- (2) Finestre (terminale + popup blocchi) ----------
  // Valori bassi (sotto l'overlay 1450 e i dialog modali 1480): il click porta la finestra
  // cliccata a 1443, l'altra scende a 1441. I dialog modali restano sempre sopra.
  // P10.1 (round 15-B S10, Ismail 2026-07-15): manual-overlay aggiunto -- e' statico nel DOM
  // (markup fisso in index.html, solo .active cambia), quindi wireWindows() lo trova gia'
  // al load come console-popup/popup-window (a differenza di draw-output-panel, creato a
  // runtime, che per questo si auto-wira da solo in ensureTurtlePanel/draw.js).
  const WINDOW_IDS = ['console-popup', 'popup-window', 'draw-output-panel', 'manual-overlay'];
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

  // P2.4 (round 15-B S1, Ismail 2026-07-15): STESSO pattern "a finestre" di sopra, esteso ai
  // popup che condividono il backdrop #overlay (edit-blocco/for/turtle/impostazioni/export/
  // salva/guida-blocco) -- prima erano tutti allo stesso z-index FISSO (alcuni !important,
  // vedi style.css), quindi fra loro vinceva sempre l'ordine nel DOM, mai l'ultimo cliccato/
  // aperto (es. block-help-popup che apre sopra un edit-node-popup gia' aperto). Range
  // dedicato SOPRA le finestre (1461-1478) e SOTTO manuale/tema/menu-contestuale/bf-modal
  // (2000/1600/2200/2300, invariati). NON tocca i popup modali "veri" (bf-modal: showStyled
  // Confirm/Alert/showUnsavedDialog) -- quelli restano sempre in cima da soli (z 2300), un
  // solo overlay bloccante alla volta, nessuno stacking da gestire.
  const POPUP_WINDOW_IDS = ['edit-node-popup', 'for-popup', 'draw-popup', 'settings-popup', 'export-popup', 'save-popup', 'block-help-popup'];
  var _bfZ2 = 1481;
  function bfBringToFrontPopup(el) {
    if (!el) return;
    _bfZ2 += 1;
    if (_bfZ2 > 1497) { // reset periodico: azzera tutti e riparti (evita di superare il tema, 1600)
      _bfZ2 = 1482;
      POPUP_WINDOW_IDS.forEach(function (id) { const w = document.getElementById(id); if (w) w.style.zIndex = '1481'; });
    }
    el.style.zIndex = String(_bfZ2);
  }
  window.bfBringToFrontPopup = bfBringToFrontPopup;
  function wirePopupWindows() {
    POPUP_WINDOW_IDS.forEach(function (id) {
      const w = document.getElementById(id);
      if (w && !w._bfWired) {
        w._bfWired = true;
        w.addEventListener('mousedown', function () {
          bfBringToFrontPopup(w);
          // R13-F: la cima dello stack Esc segue l'ultimo popup cliccato, non solo l'ultimo
          // aperto (popups.js, registro condiviso _bfOverlayStack) -- coerente con l'ordine
          // visivo appena impostato sopra.
          if (typeof _bfPushOverlay === 'function') _bfPushOverlay(id);
        }, true);
      }
    });
  }

  window.addEventListener('load', function () {
    stripNativeTitles();
    wireWindows();
    wirePopupWindows();
    // Re-strip dopo un cambio lingua (applyLanguage riscrive i title dei data-i18n-title).
    if (typeof window.applyLanguage === 'function' && !window.applyLanguage._bfWrapped) {
      const orig = window.applyLanguage;
      window.applyLanguage = function (l) { const r = orig.apply(this, arguments); try { stripNativeTitles(); } catch (e) {} return r; };
      window.applyLanguage._bfWrapped = true;
    }
  });
})();

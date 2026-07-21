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

  // ---------- (3) WP-M (Ismail 2026-07-20): popup SPOSTABILI e RIDIMENSIONABILI ----------
  // Richiesta: "rendere tutti i popup resizable e spostabili -- impostazioni, crea tema e
  // aggiungi blocchi". Stesso schema a 8 maniglie .tg-rz gia' usato da console/tartaruga/
  // manuale (Pointer Events: funziona anche a dito; touch-action:none sulle maniglie in
  // style.css). Il drag parte da un "handle" (testata/titolo) oppure, per la palette, da
  // qualunque punto vuoto del popup (non su bottoni/input). I popup sono centrati via
  // transform translate(-50%,-50%): al primo gesto la posizione si "congela" in left/top
  // assoluti (transform none), come gia' fa _manualSetupDragResize.
  // ==========================================================================
  // WP-M11 (Ismail 2026-07-21): "fai in modo che posizione e dimensione dei vari popup
  // siano salvate in cache". Un solo posto per TUTTE le finestre (palette, Impostazioni,
  // crea-tema, manuale, tela tartaruga, terminale flottante): quelle qui sotto passano da
  // bfMakeWindowPopup, le altre tre hanno un drag/resize proprio e chiamano bfSavePopupGeom
  // dal loro pointerup -- l'importante e' che il FORMATO e il clamp stiano scritti una volta
  // sola, altrimenti sei finestre significano sei modi diversi di salvare la stessa cosa.
  // Si salva solo cio' che l'utente ha davvero scelto; una finestra mai spostata ne'
  // ridimensionata non ha voce nello storage e continua ad aprirsi centrata come sempre.
  // ==========================================================================
  const GEOM_KEY = 'bf.popup.geom.v1';
  function _geomAll() {
    try { const o = JSON.parse(localStorage.getItem(GEOM_KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; }
    catch (e) { return {}; } // storage pieno/disattivato (Safari privato): si continua senza memoria
  }
  function bfSavePopupGeom(el) {
    if (!el || !el.id) return;
    let r; try { r = el.getBoundingClientRect(); } catch (e) { return; }
    if (!r || r.width < 20 || r.height < 20) return; // finestra chiusa/non ancora misurabile
    const all = _geomAll();
    all[el.id] = {
      l: Math.round(r.left), t: Math.round(r.top),
      w: Math.round(r.width), h: Math.round(r.height),
      sized: !!(el.classList && el.classList.contains('bf-user-sized'))
    };
    try { localStorage.setItem(GEOM_KEY, JSON.stringify(all)); } catch (e) {}
  }
  // Riapplica la geometria salvata. `withSize`: false per le finestre la cui DIMENSIONE e'
  // gestita da altro (es. il terminale, che ha una scala sua) -- si rimette solo la posizione.
  // Il clamp non e' un dettaglio: lo schermo di oggi puo' essere piu' piccolo di quello di
  // ieri (telefono dopo desktop, rotazione, finestra ridotta) e una finestra ripristinata
  // fuori viewport sarebbe irraggiungibile, senza modo di rimediare se non svuotando la cache.
  function bfRestorePopupGeom(el, withSize) {
    if (!el || !el.id) return false;
    const g = _geomAll()[el.id];
    if (!g) return false;
    const vw = window.innerWidth || 1200, vh = window.innerHeight || 900;
    let w = g.w, h = g.h;
    if (withSize !== false && g.sized) {
      w = Math.max(160, Math.min(Math.floor(vw * 0.98), w));
      h = Math.max(120, Math.min(Math.floor(vh * 0.96), h));
      el.style.width = w + 'px'; el.style.height = h + 'px';
      el.style.minWidth = '0'; el.style.maxWidth = 'none'; el.style.maxHeight = 'none';
      el.classList.add('bf-user-sized');
    }
    // Almeno un angolo abbondante deve restare cliccabile dentro lo schermo.
    const l = Math.max(0, Math.min(vw - 80, g.l));
    const t = Math.max(0, Math.min(vh - 60, g.t));
    el.style.left = l + 'px'; el.style.top = t + 'px';
    el.style.transform = 'none'; el.style.margin = '0';
    return true;
  }
  window.bfSavePopupGeom = bfSavePopupGeom;
  window.bfRestorePopupGeom = bfRestorePopupGeom;

  function bfMakeWindowPopup(el, opts) {
    if (!el || el._bfWinWired) return;
    el._bfWinWired = true;
    opts = opts || {};
    const dragFrom = opts.dragHandle ? el.querySelector(opts.dragHandle) : el;
    const MIN_W = opts.minW || 260, MIN_H = opts.minH || 200;
    function freeze() {
      const r = el.getBoundingClientRect();
      el.style.left = r.left + 'px'; el.style.top = r.top + 'px';
      el.style.transform = 'none'; el.style.margin = '0';
      return r;
    }
    let drag = false, dx = 0, dy = 0, ox = 0, oy = 0;
    if (dragFrom) dragFrom.addEventListener('pointerdown', function (e) {
      if (e.isPrimary === false) return;
      // Palette (drag "da qualunque punto vuoto", nessun handle dedicato): su TOUCH il
      // gesto sul corpo del popup deve restare per lo SCROLL del contenuto (overflow:auto
      // su mobile) -- il drag a dito resta possibile dalle maniglie/bordi. Col mouse invariato.
      // WP-M11 (Ismail 2026-07-21, "rendi il popup per aggiungere blocchi spostabile da
      // tablet"): il blocco totale del drag a dito rendeva la palette IMMOBILE su tablet, dove
      // non esiste il mouse. Ora il dito trascina quando tocca il popup STESSO -- cioe' la
      // fascia di padding attorno alla griglia, dove la X e il "?" gia' vivono e dove non c'e'
      // niente da scorrere. Dentro la griglia (e.target e' un discendente) lo scroll resta
      // intatto: e' la distinzione che mancava, non "touch si / touch no".
      if (!opts.dragHandle && e.pointerType === 'touch' && e.target !== el) return;
      // Mai iniziare un drag da un controllo interattivo (o dalle maniglie di resize).
      if (e.target && e.target.closest && e.target.closest('button, input, select, textarea, label, a, .tg-rz')) return;
      const r = freeze();
      drag = true; ox = r.left; oy = r.top; dx = e.clientX; dy = e.clientY;
      if (document.body && document.body.style) document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    let rz = false, rdir = '', rx = 0, ry = 0, rw = 0, rh = 0, rl = 0, rt = 0;
    const handles = el.querySelectorAll('.tg-rz');
    for (let i = 0; i < handles.length; i++) {
      handles[i].addEventListener('pointerdown', function (e) {
        if (e.isPrimary === false) return;
        const r = freeze();
        rz = true; rdir = this.getAttribute('data-dir') || 'se';
        rx = e.clientX; ry = e.clientY; rw = r.width; rh = r.height; rl = r.left; rt = r.top;
        if (document.body && document.body.style) document.body.style.userSelect = 'none';
        e.preventDefault(); e.stopPropagation();
      });
    }
    window.addEventListener('pointermove', function (e) {
      if (drag) {
        el.style.left = (ox + e.clientX - dx) + 'px';
        el.style.top = (oy + e.clientY - dy) + 'px';
      } else if (rz) {
        const ddx = e.clientX - rx, ddy = e.clientY - ry;
        let nw = rw, nh = rh, nl = rl, nt = rt;
        if (rdir.indexOf('e') !== -1) nw = rw + ddx;
        if (rdir.indexOf('w') !== -1) { nw = rw - ddx; nl = rl + ddx; }
        if (rdir.indexOf('s') !== -1) nh = rh + ddy;
        if (rdir.indexOf('n') !== -1) { nh = rh - ddy; nt = rt + ddy; }
        // Min/max clampati alla viewport reale (stesso pattern WP-6/mobile di console/manuale).
        const _vw = window.innerWidth || 1200, _vh = window.innerHeight || 900;
        const _minW = Math.min(MIN_W, Math.floor(_vw * 0.9)), _maxW = Math.floor(_vw * 0.98);
        const _minH = Math.min(MIN_H, Math.floor(_vh * 0.7)), _maxH = Math.floor(_vh * 0.96);
        nw = Math.max(_minW, Math.min(_maxW, nw)); nh = Math.max(_minH, Math.min(_maxH, nh));
        if (rdir.indexOf('w') !== -1) nl = rl + (rw - nw);
        if (rdir.indexOf('n') !== -1) nt = rt + (rh - nh);
        el.style.width = nw + 'px'; el.style.height = nh + 'px';
        el.style.left = nl + 'px'; el.style.top = nt + 'px';
        // La palette rifluisce i blocchi in base alla larghezza SCELTA dall'utente
        // (grid auto-fit) e lo scroll passa al CONTENUTO interno (palette-grid/settings-body/
        // te-body) -- vedi le regole .bf-user-sized in style.css: overflow del popup resta
        // visibile cosi' le maniglie .tg-rz non vengono clippate.
        el.classList.add('bf-user-sized');
        // min/max-width/height CSS di default non devono vincere sulla scelta dell'utente.
        el.style.minWidth = '0'; el.style.maxWidth = 'none'; el.style.maxHeight = 'none';
      }
    });
    const end = function () {
      if (drag || rz) {
        drag = false; rz = false;
        if (document.body && document.body.style) document.body.style.userSelect = '';
        bfSavePopupGeom(el); // WP-M11: si memorizza a gesto FINITO, non a ogni pointermove
      }
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }
  function wireResizablePopups() {
    bfMakeWindowPopup(document.getElementById('settings-popup'), { dragHandle: 'h3', minW: 280, minH: 260 });
    bfMakeWindowPopup(document.getElementById('theme-editor'), { dragHandle: '.te-head', minW: 280, minH: 260 });
    bfMakeWindowPopup(document.getElementById('popup-window'), { minW: 300, minH: 240 });
    // WP-M11: geometria dell'ultima sessione. Si riapplica SUBITO, anche a finestra chiusa:
    // sono stili inline su elementi display:none, non costano nulla e cosi' la finestra e' gia'
    // al posto giusto alla prima apertura, senza un salto visibile.
    ['settings-popup', 'theme-editor', 'popup-window', 'manual-overlay', 'draw-output-panel'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) bfRestorePopupGeom(el);
    });
  }

  window.addEventListener('load', function () {
    stripNativeTitles();
    wireWindows();
    wirePopupWindows();
    wireResizablePopups();
    // Re-strip dopo un cambio lingua (applyLanguage riscrive i title dei data-i18n-title).
    if (typeof window.applyLanguage === 'function' && !window.applyLanguage._bfWrapped) {
      const orig = window.applyLanguage;
      window.applyLanguage = function (l) { const r = orig.apply(this, arguments); try { stripNativeTitles(); } catch (e) {} return r; };
      window.applyLanguage._bfWrapped = true;
    }
  });
})();


// C6 (round 11) + R14-E (Ismail 2026-07-13, "un SOLO punto di ricalcolo, invocato da OGNI
// sorgente"): tick condiviso, throttled via requestAnimationFrame, per il ricentraggio "live"
// del canvas -- NON piu' solo per la barra Variabili: e' l'UNICO punto di ricalcolo per
// QUALUNQUE cosa tocchi lo spazio disponibile (drag/resize/collapse della sidebar Variabili,
// apertura/chiusura/dock-mobile/resize della console, zoom, cambio lingua/RTL, resize della
// finestra). Prima del R14-E, diversi di questi trigger (toggleVariables in variables.js,
// run()/closeConsole()/toggleConsoleDock() in execute.js, zoomIn/Out/Reset in layout.js,
// applyLanguage() in i18n.js) chiamavano updateZoomOffset()/centerGraph() DIRETTAMENTE, in
// ordine sbagliato o incompleto (in un caso addirittura PRIMA di syncLayoutVars) -- causa
// piu' probabile del centraggio sbagliato con sidebar E console entrambe al massimo. Ora
// TUTTI passano da qui. L'ordine e' importante: syncLayoutVars() aggiorna --sidebar-width
// (il tetto max-width della console agganciata dipende da questa var, style.css ~1266), POI
// updateZoomOffset() ricalcola --console-cover-width/--zoom-right E misura la larghezza REALE
// della console (gia' vincolata dal nuovo tetto, perche' leggere getBoundingClientRect()
// forza il browser a un reflow sincrono che riflette il valore appena impostato), POI
// centerGraph() ricentra il canvas nello spazio residuo. Il flag _bfSidebarRafPending
// garantisce UNA sola esecuzione per frame anche se il mousemove del drag spara molti
// eventi tra un frame e l'altro (niente jitter, niente draw/centraggio a ogni singolo pixel).
var _bfSidebarRafPending = false;
function _bfSidebarLiveResizeTick() {
  if (_bfSidebarRafPending) return;
  _bfSidebarRafPending = true;
  (window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16); })(function () {
    _bfSidebarRafPending = false;
    if (typeof window.syncLayoutVars === 'function') window.syncLayoutVars();
    if (typeof updateZoomOffset === 'function') updateZoomOffset();
    if (typeof centerGraph === 'function') centerGraph();
  });
}

  window.onload = function () {
    saved=true; // Inizialmente, si considera il flowchart "salvato" (nessuna modifica)
    if (typeof loadDarkModePreference === 'function') loadDarkModePreference(); // applica il tema salvato (Dark mode) prima del primo draw
    if (typeof loadLanguagePreference === 'function') loadLanguagePreference(); // applica la lingua salvata (IT/EN/AR/ZH)
    if (typeof applyPerfSettings === 'function') applyPerfSettings(); // D3 (round 11): classe perf-reduced su body dal valore salvato
    // R13-D (Ismail 2026-07-12): progetto nuovo (o appena ricaricato) -> header mostra subito
    // "Senza nome — Autore sconosciuto" col pallino spento, invece di aspettare il primo tick
    // del polling in syncUnsavedIndicator (execute.js, ogni 600ms -- non sbagliato, solo un
    // breve flash di testo vuoto evitabile con una chiamata esplicita qui).
    if (typeof updateProjectIdentity === 'function') updateProjectIdentity();
    window.addEventListener("resize", resizeCanvas); // Listener per ridimensionare il canvas

    // FIX (Ismail 2026-07-07, "attento al ridimensionamento del terminale che finisce ad
    // andare sopra barra header e nascondere pulsanti"): pubblica l'altezza REALE della
    // barra header in una CSS var (--toolbar-height), letta dal CSS della console agganciata
    // per posizionarsi sempre SOTTO l'header. Aggiornata a ogni resize (l'header puo' andare
    // a capo cambiando altezza).
    window.syncLayoutVars = function syncLayoutVars() {
      if (!(document.body && document.body.style && document.body.style.setProperty)) return;
      const tb = document.getElementById('toolbar');
      if (tb) document.body.style.setProperty('--toolbar-height', tb.offsetHeight + 'px');
      // Larghezza REALE della sidebar variabili: il tetto di larghezza della console
      // agganciata la sottrae, cosi' la console non copre mai la tabella VARIABLES. Il
      // collapse e' una classe su #main ('sidebar-collapsed'), non su #sidebar.
      const main = document.getElementById('main');
      const sb = document.getElementById('sidebar');
      const collapsed = main && main.classList && main.classList.contains('sidebar-collapsed');
      const wpx = collapsed ? 44 : (sb ? sb.offsetWidth : 0);
      document.body.style.setProperty('--sidebar-width', (wpx || 240) + 'px');
    };
    window.syncLayoutVars();
    window.addEventListener("resize", window.syncLayoutVars);

    // FIX (Ismail 2026-07-07): la tabella VARIABLES scala il font con la larghezza della
    // sidebar (resize handle). ResizeObserver aggiorna sia --sidebar-width (in tempo reale
    // durante il drag, non solo su window-resize) sia il font della tabella.
    (function () {
      const sb = document.getElementById('sidebar');
      const tab = document.getElementById('tabVariabili');
      if (!sb || typeof ResizeObserver === 'undefined') return;
      const applyVarFont = function () {
        const wpx = sb.offsetWidth || 220;
        const scale = Math.max(0.85, Math.min(1.6, wpx / 220));
        if (tab) tab.style.fontSize = (0.82 * scale).toFixed(3) + 'rem';
        // FIX #24: abbrevia i tipi (Int/Flo/Str) in TEMPO REALE durante il drag della sidebar,
        // non solo su window-resize (prima updateVarTypeOptions girava solo su resize/load).
        if (typeof updateVarTypeOptions === 'function') updateVarTypeOptions();
        // FIX v2 (Ismail 2026-07-10) + C6 (round 11): come per #console-popup (vedi execute.js,
        // ResizeObserver dedicato), anche il resize della sidebar Variabili deve ricentrare il
        // grafo — non solo quando si trascina la maniglia custom (gia' lo fa), ma per QUALSIASI
        // cambio di larghezza della sidebar catturato dal ResizeObserver stesso. Il trio
        // syncLayoutVars()/updateZoomOffset()/centerGraph() passa ORA dal tick condiviso
        // _bfSidebarLiveResizeTick() (throttle rAF, vedi inizio file), cosi' il ResizeObserver
        // (che durante il drag dell'handle spara ad altissima frequenza, una volta per ogni
        // sb.style.width impostato) non ridisegna/ricentra a ogni singolo pixel. Il richiamo
        // dopo 240ms (stesso pattern usato altrove, es. toggleVariables) NON e' throttled: serve
        // a ricatturare lo spazio quando la transizione CSS della sidebar e' del tutto conclusa
        // (apri/chiudi), non ad aggiungere altra logica.
        _bfSidebarLiveResizeTick();
        // R14-E (Ismail 2026-07-13): richiamo a 240ms tramite lo STESSO tick (non piu' le 3
        // chiamate ripetute a mano) -- identico risultato, un solo posto che definisce
        // l'ordine (era gia' corretto qui, ma tenerlo duplicato in piu' punti e' proprio
        // il tipo di frammentazione che ha causato il bug altrove, es. toggleVariables()).
        setTimeout(_bfSidebarLiveResizeTick, 240);
      };
      applyVarFont();
      const ro = new ResizeObserver(applyVarFont);
      ro.observe(sb);
    })();

    // Creazione dei nodi visuali iniziali (Start e End)
    nodi.push({ relX: 0.35, relY: 0.05, width: 100, height: 40, color: "white", text: "Start" });
    nodi.push({ relX: 0.35, relY: 0.4, width: 100, height: 40, color: "white", text: "End" });
    calcoloY(nodi); // Calcola le posizioni Y corrette per i nodi
    draw(nodi);     // Disegna il flowchart iniziale
    // FIX (Ismail 2026-07-08): centra il grafo nell'area visibile all'avvio e a ogni resize
    // della finestra (prima centerGraph girava solo su zoom/console -> il grafo poteva
    // partire scentrato). Il setTimeout assicura che larghezza CSS del canvas/offsetLeft
    // siano gia' calcolati dopo il primo layout.
    if (typeof centerGraph === 'function') { centerGraph(); setTimeout(centerGraph, 120); }
    // FIX #22 (Ismail 2026-07-10): a ogni resize della finestra ricalcola anche la larghezza
    // coperta dalla console agganciata (--console-cover-width), cosi' il #canvas-container e la
    // sua scrollbar orizzontale restano SEMPRE nello spazio visibile e non finiscono sotto il
    // terminale (la larghezza di default e' min(300px,94vw): sotto ~319px di finestra cambia).
    // R13-C (Ismail 2026-07-12): passa dal tick condiviso invece di chiamare updateZoomOffset()
    // +centerGraph() direttamente -- cosi' l'ORDINE con syncLayoutVars() (altro listener su
    // "resize", riga ~49) e' garantito dal tick stesso (rAF, un solo giro/frame) invece di
    // dipendere implicitamente dall'ordine di REGISTRAZIONE dei due listener (fragile: bastava
    // che un terzo listener si inserisse in mezzo per rompere l'ordine "sidebar-width aggiornata
    // PRIMA che si ricalcoli il tetto max-width della console", causa probabile del centraggio
    // sbagliato quando sidebar e console sono entrambe al massimo).
    window.addEventListener("resize", function(){
      if (typeof _bfSidebarLiveResizeTick === 'function') { _bfSidebarLiveResizeTick(); }
      else { if (typeof updateZoomOffset === 'function') updateZoomOffset(); if (typeof centerGraph === 'function') centerGraph(); }
    });

    // D4 (round 11): "click" resta un vero evento click (mouse E il click SINTETICO che il
    // browser genera dopo un tap touch) -- coesiste con i Pointer Event sotto (Trappola del
    // piano): la protezione anti-doppio-trigger e' suppressNextClick, gia' impostata dal
    // drag (onCanvasMouseUp) e ora anche dal long-press (onCanvasTouchPointerDown).
    canvas.addEventListener("click", checkClick); // Listener per click su nodi/frecce sul canvas
    // D4: mousemove/mouseleave -> pointermove/pointerleave (hover funziona anche a dito,
    // mouse=pointer su desktop quindi nessuna regressione).
    canvas.addEventListener("pointermove", onCanvasHover); // Evidenziazione rami al passaggio del mouse/dito
    canvas.addEventListener("pointerleave", function(){ hoverArc = null; draw(nodi); });
    // Menu contestuale (click destro su un blocco): Modifica/Taglia/Copia/Incolla/Elimina.
    canvas.addEventListener("contextmenu", function(e){ if (typeof showContextMenu === "function") showContextMenu(e); });
    // TASK 3 (Ismail 2026-07-08): il menu contestuale NATIVO del browser e' disabilitato in
    // tutta la pagina. Il click destro dell'editor resta disponibile SOLO su nodi/archi del
    // canvas (gestito da showContextMenu qui sopra). Fanno eccezione i campi di testo
    // (input/textarea/contentEditable), dove il menu nativo serve per copia/incolla del testo.
    document.addEventListener("contextmenu", function (e) {
      const el = e.target;
      const tag = (el && el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (el && el.isContentEditable)) return;
      e.preventDefault();
    });
    // Nascondi il menu contestuale a ogni tocco/click sinistro, scroll o resize.
    // D4: mousedown -> pointerdown, altrimenti su un dispositivo puramente touch questo
    // listener non scatterebbe MAI (niente evento mousedown) e il menu contestuale aperto
    // da un long-press non si chiuderebbe mai toccando altrove.
    document.addEventListener("pointerdown", function(e){
      const m = document.getElementById("ctx-menu");
      if (m && !m.hidden && !(e.target && e.target.closest && e.target.closest("#ctx-menu"))) { if (typeof hideContextMenu === "function") hideContextMenu(); }
    });
    window.addEventListener("scroll", function(){ if (typeof hideContextMenu === "function") hideContextMenu(); }, true);
    window.addEventListener("blur", function(){ if (typeof hideContextMenu === "function") hideContextMenu(); });

    // Drag & Drop (riordino nodi nel flusso): pointerdown sul nodo, pointermove per
    // trascinare/evidenziare l'arco target, pointerup (su window, non solo canvas,
    // nel caso il rilascio avvenga fuori dai bordi) per completare lo spostamento.
    // D4 (round 11): mousedown/mousemove/mouseup -> pointerdown/pointermove/pointerup
    // (stesse identiche funzioni handler: le firme usano solo clientX/clientY, gia'
    // compatibili). #canvas{touch-action:none} in style.css impedisce al browser di
    // rubare il gesto per lo scroll della pagina. pointercancel (iOS Safari puo'
    // interrompere un gesto a meta') annulla il drag invece di completarlo.
    canvas.addEventListener("pointerdown", onCanvasMouseDown);
    canvas.addEventListener("pointermove", onCanvasMouseMove);
    window.addEventListener("pointerup", onCanvasMouseUp);
    canvas.addEventListener("pointercancel", onCanvasPointerCancel);
    // D4: long-press (solo pointerType 'touch') = menu contestuale. Listener dedicati,
    // separati dal drag&drop sopra (nessuna delle due logiche tocca lo stato dell'altra).
    canvas.addEventListener("pointerdown", onCanvasTouchPointerDown);
    canvas.addEventListener("pointermove", onCanvasTouchPointerMove);
    canvas.addEventListener("pointerup", onCanvasTouchPointerUp);

    // Congela lo scroll di sfondo quando un popup e' aperto. Tutti i popup attivano
    // #overlay: osservando la sua classe 'active' gestiamo lo scroll in un solo punto,
    // senza modificare ogni funzione apri/chiudi.
    const overlayEl = document.getElementById("overlay");
    if (overlayEl && typeof MutationObserver !== "undefined") {
      const scrollFreezer = new MutationObserver(() => {
        document.body.classList.toggle("no-scroll", overlayEl.classList.contains("active"));
      });
      scrollFreezer.observe(overlayEl, { attributes: true, attributeFilter: ["class"] });
    }

    // Imposta il listener per la prima riga dati (se esiste) della tabella variabili
    if (tabVariabili.rows[1]) { // La riga 0 è l'header
      tabVariabili.rows[1].addEventListener("change", aggiungiVaribile);
      tabVariabili.rows[1].cells[0].querySelector("input").value = "";
      var _vi=tabVariabili.rows[1].cells[2].querySelector("input.value-input"); if(_vi) _vi.value = "";
    }
  }

 // Scorciatoie Undo/Redo (Ctrl+Z / Ctrl+Y o Ctrl+Shift+Z). Ignorate nei campi di testo.
 window.addEventListener('keydown', function(event){
   const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
   if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
   const k = (event.key || '').toLowerCase();
   if ((event.ctrlKey || event.metaKey) && k === 'z' && !event.shiftKey) {
     event.preventDefault(); if (typeof undo === 'function') undo();
   } else if ((event.ctrlKey || event.metaKey) && (k === 'y' || (k === 'z' && event.shiftKey))) {
     event.preventDefault(); if (typeof redo === 'function') redo();
   } else if ((event.ctrlKey || event.metaKey) && k === 'd') {
     // MIGLIORIA #44: Ctrl+D duplica il blocco selezionato (clona tipo+contenuto).
     // C4 (round 11): usa selectedNodeIdx (bordo di selezione) se presente, altrimenti
     // nodoSelected (compatibilita' col vecchio flusso "nodo in editing").
     event.preventDefault();
     const _selD = (typeof selectedNodeIdx !== 'undefined' && selectedNodeIdx >= 0) ? selectedNodeIdx : nodoSelected;
     if (typeof _selD !== 'undefined' && _selD >= 0 && typeof duplicaNodo === 'function') duplicaNodo(_selD);
   } else if ((event.ctrlKey || event.metaKey) && k === 'c') {
     // Ctrl+C copia il blocco selezionato -- solo se NON c'e' testo selezionato (altrimenti
     // lascia la copia di testo nativa del browser). C4: stesso fallback selectedNodeIdx/nodoSelected.
     const _hasTextSel = (typeof window.getSelection === 'function') && String(window.getSelection() || '').length > 0;
     const _selC = (typeof selectedNodeIdx !== 'undefined' && selectedNodeIdx >= 0) ? selectedNodeIdx : nodoSelected;
     if (!_hasTextSel && typeof _selC !== 'undefined' && _selC >= 0 && typeof copyNode === 'function') {
       event.preventDefault(); copyNode(_selC);
     }
   } else if ((event.ctrlKey || event.metaKey) && k === 'x') {
     // C4 (round 11): stesso fallback selectedNodeIdx/nodoSelected.
     const _selX = (typeof selectedNodeIdx !== 'undefined' && selectedNodeIdx >= 0) ? selectedNodeIdx : nodoSelected;
     if (typeof _selX !== 'undefined' && _selX >= 0 && typeof cutNode === 'function') {
       event.preventDefault(); cutNode(_selX);
     }
   } else if ((event.ctrlKey || event.metaKey) && k === 'v') {
     if (typeof blockClipboard !== 'undefined' && blockClipboard && typeof pasteNode === 'function') {
       event.preventDefault(); pasteNode();
     }
   } else if ((k === 'delete' || k === 'del') && typeof multiSelected !== 'undefined' && multiSelected.length > 0) {
     // R12-G/Fase1 (Ismail 2026-07-12): Canc elimina il gruppo multi-selezionato corrente.
     event.preventDefault();
     if (typeof deleteSelectionGroup === 'function') deleteSelectionGroup();
   } else if (k === 'escape') {
     if (typeof hideContextMenu === 'function') hideContextMenu();
     // R13-F (Ismail 2026-07-12): Esc chiude SOLO l'overlay in cima allo stack condiviso
     // (bf-modal/edit-node/for/draw/settings/export/save/block-help/palette -- popups.js),
     // non tutti insieme come prima (bug segnalato: con piu' popup annidati -- es. Impostazioni
     // sotto e l'errore runtime sopra -- Esc li chiudeva entrambi in un colpo solo, invece di
     // chiudere prima solo quello in cima).
     if (typeof _bfOverlayStack !== 'undefined' && _bfOverlayStack.length) {
       const _bfTopId = _bfOverlayStack[_bfOverlayStack.length - 1];
       if (typeof _bfCloseOverlayById === 'function') _bfCloseOverlayById(_bfTopId);
     } else {
       // Nessun overlay del nuovo registro aperto: comportamento storico per cio' che non ne fa
       // ancora parte (console flottante non agganciata).
       const cons = document.getElementById('console-popup');
       if (cons && cons.classList.contains('active') && !cons.classList.contains('docked')) cons.classList.remove('active');
       const ov = document.getElementById('overlay'); if (ov) ov.classList.remove('active');
     }
     // C4 (round 11): Esc deseleziona anche il bordo di selezione visiva.
     if (typeof selectedNodeIdx !== 'undefined' && selectedNodeIdx !== -1) {
       selectedNodeIdx = -1;
       if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
     }
     // R12-G/Fase1: Esc azzera anche la selezione multipla.
     if (typeof multiSelected !== 'undefined' && multiSelected.length) {
       multiSelected = [];
       if (typeof _multiSelAnchor !== 'undefined') _multiSelAnchor = null; // R13-H
       if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
     }
   }
 });

 // Listener per la scorciatoia da tastiera Ctrl+R (o Cmd+R su Mac) e per F5.
 // Previene il ricaricamento della pagina se ci sono modifiche non salvate, chiedendo conferma.
 // B2 (round 11): F5 non ha ctrlKey/metaKey, va controllato come caso a se'.
 window.addEventListener('keydown', function(event) {
    const isReloadKey = ((event.ctrlKey || event.metaKey) && event.key === 'r') || event.key === 'F5';
    if (isReloadKey) { // Se premuto Ctrl/Cmd+R oppure F5
      if(!isEmpty() && !saved){ // Se il flowchart non è vuoto e ci sono modifiche non salvate
        event.preventDefault(); // Impedisce il ricaricamento di default
        // FIX #34: dialog stilizzato coerente (Salva / Non salvare=ricarica / Annulla) invece del confirm() nativo in inglese.
        // B1 (round 11): showUnsavedDialog e' nello stesso bundle di init.js (popups.js e' sempre caricato prima), niente fallback confirm().
        showUnsavedDialog({ onSave: function(){ if (typeof saveFile === 'function') saveFile(); }, onDiscard: function(){
          // B2 (round 11): reload GIA' confermato dall'utente -> evita il secondo avviso nativo (beforeunload, execute.js).
          window._bfBypassUnload = true;
          location.reload();
        } });
      }
      // Altrimenti (se salvato o vuoto), permette il ricaricamento di default
    }
  });
// ============================================================================
// Maniglia di resize a TUTTA ALTEZZA per la barra VARIABILI (Ismail 2026-07-08): la
// barra usava il "resize" nativo (solo un angolino in basso a destra). Ora un handle
// verticale sul bordo destro, trascinabile per tutta l'altezza, ridimensiona la sidebar.
(function () {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const sb = document.getElementById('sidebar');
  const main = document.getElementById('main');
  if (!sb || !main || !document.createElement) return;
  if (!document.body || typeof document.body.appendChild !== 'function') return; // ambienti headless/mock
  if (typeof sb.getBoundingClientRect !== 'function') return;
  const handle = document.createElement('div');
  handle.id = 'sidebar-resize-handle';
  handle.title = '';
  document.body.appendChild(handle);
  function collapsed() { return main.classList && main.classList.contains('sidebar-collapsed'); }
  // WP-D6 (Ismail 2026-07-12, punto 2 RTL): in arabo il grid #main si specchia da solo
  // (grid-template-columns segue document.direction come flex-direction:row), quindi la
  // sidebar finisce fisicamente a DESTRA dello schermo invece che a sinistra. La maniglia
  // pero' andava sempre ancorata al bordo r.right (il bordo destro): in LTR e' quello giusto
  // (adiacente al canvas), ma in RTL il bordo adiacente al canvas e' r.left. Senza questo
  // gating la maniglia finiva incollata al bordo ESTERNO (contro il muro della finestra) e
  // trascinarla ridimensionava la sidebar nella direzione sbagliata.
  function _bfIsRtl() { return typeof document !== 'undefined' && document.documentElement && document.documentElement.dir === 'rtl'; }
  function place() {
    if (collapsed()) { handle.style.display = 'none'; return; }
    handle.style.display = 'block';
    const r = sb.getBoundingClientRect();
    handle.style.left = (_bfIsRtl() ? (r.left - 3) : (r.right - 3)) + 'px';
    handle.style.top = r.top + 'px';
    handle.style.height = r.height + 'px';
  }
  let dragging = false;
  handle.addEventListener('mousedown', function (e) {
    dragging = true; handle.classList.add('dragging');
    if (document.body && document.body.style) document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    const r = sb.getBoundingClientRect();
    // WP-D6: in RTL la sidebar e' ancorata al bordo destro (fisso) e si allarga verso
    // sinistra -- la larghezza segue quindi la distanza fra il mouse e r.right, non r.left.
    let w = _bfIsRtl() ? (r.right - e.clientX) : (e.clientX - r.left);
    w = Math.max(230, Math.min(420, w)); // FIX 2026-07-10: 230 = floor che garantisce la X elimina sempre visibile
    sb.style.width = w + 'px'; sb.style.maxWidth = 'none';
    if (typeof updateVarTypeOptions === 'function') updateVarTypeOptions();
    place();
    // C6 (round 11): syncLayoutVars()/updateZoomOffset()/centerGraph() ora passano dal tick
    // condiviso rAF-throttled (vedi inizio file) invece di girare ad ogni mousemove: durante il
    // drag il ResizeObserver su #sidebar spara comunque (sb.style.width e' appena cambiato), ma
    // il flag _bfSidebarRafPending consolida entrambe le sorgenti in UNA sola esecuzione/frame.
    _bfSidebarLiveResizeTick();
  });
  window.addEventListener('mouseup', function () {
    if (!dragging) return;
    dragging = false; handle.classList.remove('dragging');
    if (document.body && document.body.style) document.body.style.userSelect = '';
    place();
  });
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);
  if (typeof ResizeObserver !== 'undefined') { try { new ResizeObserver(place).observe(sb); } catch (e) {} }
  // riposiziona anche quando la sidebar si apre/chiude (transizione del grid)
  if (typeof MutationObserver !== 'undefined') { try { new MutationObserver(function(){ setTimeout(place, 60); setTimeout(place, 260); }).observe(main, { attributes: true, attributeFilter: ['class'] }); } catch (e) {} }
  setTimeout(place, 100); setTimeout(place, 400);
})();
console.log("%cBaseFlow build 20260709d — se NON vedi questo messaggio sei su una versione vecchia in cache","color:#6200ea;font-weight:bold");

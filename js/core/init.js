
  window.onload = function () {
    saved=true; // Inizialmente, si considera il flowchart "salvato" (nessuna modifica)
    if (typeof loadDarkModePreference === 'function') loadDarkModePreference(); // applica il tema salvato (Dark mode) prima del primo draw
    if (typeof loadLanguagePreference === 'function') loadLanguagePreference(); // applica la lingua salvata (IT/EN/AR/ZH)
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
        if (typeof window.syncLayoutVars === 'function') window.syncLayoutVars();
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
    window.addEventListener("resize", function(){ if (typeof centerGraph === 'function') centerGraph(); });

    canvas.addEventListener("click", checkClick); // Listener per click su nodi/frecce sul canvas
    canvas.addEventListener("mousemove", onCanvasHover); // Evidenziazione rami al passaggio del mouse
    canvas.addEventListener("mouseleave", function(){ hoverArc = null; draw(nodi); });
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
    // Nascondi il menu contestuale a ogni click sinistro, scroll o resize.
    document.addEventListener("mousedown", function(e){
      const m = document.getElementById("ctx-menu");
      if (m && !m.hidden && !(e.target && e.target.closest && e.target.closest("#ctx-menu"))) { if (typeof hideContextMenu === "function") hideContextMenu(); }
    });
    window.addEventListener("scroll", function(){ if (typeof hideContextMenu === "function") hideContextMenu(); }, true);
    window.addEventListener("blur", function(){ if (typeof hideContextMenu === "function") hideContextMenu(); });

    // Drag & Drop (riordino nodi nel flusso): mousedown sul nodo, mousemove per
    // trascinare/evidenziare l'arco target, mouseup (su window, non solo canvas,
    // nel caso il rilascio avvenga fuori dai bordi) per completare lo spostamento.
    canvas.addEventListener("mousedown", onCanvasMouseDown);
    canvas.addEventListener("mousemove", onCanvasMouseMove);
    window.addEventListener("mouseup", onCanvasMouseUp);

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
     event.preventDefault();
     if (typeof nodoSelected !== 'undefined' && nodoSelected >= 0 && typeof duplicaNodo === 'function') duplicaNodo(nodoSelected);
   } else if ((event.ctrlKey || event.metaKey) && k === 'c') {
     // Ctrl+C copia il blocco selezionato -- solo se NON c'e' testo selezionato (altrimenti
     // lascia la copia di testo nativa del browser).
     const _hasTextSel = (typeof window.getSelection === 'function') && String(window.getSelection() || '').length > 0;
     if (!_hasTextSel && typeof nodoSelected !== 'undefined' && nodoSelected >= 0 && typeof copyNode === 'function') {
       event.preventDefault(); copyNode(nodoSelected);
     }
   } else if ((event.ctrlKey || event.metaKey) && k === 'x') {
     if (typeof nodoSelected !== 'undefined' && nodoSelected >= 0 && typeof cutNode === 'function') {
       event.preventDefault(); cutNode(nodoSelected);
     }
   } else if ((event.ctrlKey || event.metaKey) && k === 'v') {
     if (typeof blockClipboard !== 'undefined' && blockClipboard && typeof pasteNode === 'function') {
       event.preventDefault(); pasteNode();
     }
   } else if (k === 'escape') {
     if (typeof hideContextMenu === 'function') hideContextMenu();
     // MIGLIORIA (Ismail 2026-07-08): Esc chiude i popup aperti (export/for/new/console sganciata).
     ['export-popup','for-popup','new-popup','save-popup','popup-window','edit-node-popup','draw-popup'].forEach(function(id){
       const el = document.getElementById(id); if (el && el.classList.contains('active')) el.classList.remove('active');
     });
     const cons = document.getElementById('console-popup');
     if (cons && cons.classList.contains('active') && !cons.classList.contains('docked')) cons.classList.remove('active');
     const ov = document.getElementById('overlay'); if (ov) ov.classList.remove('active');
   }
 });

 // Listener per la scorciatoia da tastiera Ctrl+R (o Cmd+R su Mac).
 // Previene il ricaricamento della pagina se ci sono modifiche non salvate, chiedendo conferma.
 window.addEventListener('keydown', function(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') { // Se premuto Ctrl/Cmd + R
      if(!isEmpty() && !saved){ // Se il flowchart non è vuoto e ci sono modifiche non salvate
        event.preventDefault(); // Impedisce il ricaricamento di default
        if (confirm("There are unsaved changes. Do you really want to reload the page?")) { // Chiede conferma
          location.reload(); // Ricarica la pagina se confermato
        }
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
  function place() {
    if (collapsed()) { handle.style.display = 'none'; return; }
    handle.style.display = 'block';
    const r = sb.getBoundingClientRect();
    handle.style.left = (r.right - 3) + 'px';
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
    let w = e.clientX - r.left;
    w = Math.max(190, Math.min(420, w)); // rilievo 15: minimo più ampio, la tabella non si deforma
    sb.style.width = w + 'px'; sb.style.maxWidth = 'none';
    if (typeof updateVarTypeOptions === 'function') updateVarTypeOptions();
    place();
    if (typeof window.syncLayoutVars === 'function') window.syncLayoutVars();
    if (typeof centerGraph === 'function') centerGraph();
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

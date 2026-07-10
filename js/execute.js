/*
 {
  "nodes": [
    { "type": "start", "info": "", "next": "1" },
    { "type": "input", "info": "x", "next": "2" },
    { "type": "input", "info": "y", "next": "3" },
    { "type": "if", "info": "y != 0", "next": { "true": "4", "false": "5" } },
    { "type": "print", "info": "x / y", "next": "6" },
    { "type": "print", "info": "'can't divide by 0'", "next": "6" },
    { "type": "end", "info": "", "next": "" }
  ],
  "variables": [
    {"name": "x", "type": "int", "value": 0},
 {"name": "y", "type": "int", "value": 0}
 ]
 }
*/
let currentNode = "0"; // inizia dal primo nodo
// FIX B2 (review Fable, 2026-07-05, piano Do-While/For): serve per distinguere, nel
// case "do" di executeNode, la PRIMA visita di un Do-While (arrivo da fuori il corpo:
// la condizione NON va valutata, il corpo deve girare almeno una volta) da un
// ri-arrivo tramite il proprio back-edge (arrivo da dentro il corpo: la condizione
// va valutata normalmente, come un while). Tracciato accanto a currentNode dai
// chiamanti (executeStep/executeFlow), azzerato ovunque currentNode torna a "0"
// (riavvio dell'esecuzione: nessun "nodo precedente" significativo).
let prevNode = null;
let runSpeed = 350;    // ms tra un blocco e l'altro durante Run (0 = istantaneo)
function setRunSpeed(v){ runSpeed = parseInt(v, 10) || 0; }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
// FIX #12 (Ismail 2026-07-08): oltre al nodo, evidenzia anche l'ARCO percorso.
var execEdgeFrom = -1; // indice del nodo da cui si e' arrivati al nodo corrente
// MIGLIORIA #41 (Ismail 2026-07-08): "watch" delle variabili in tempo reale durante
// l'esecuzione. flow.variables e' mutato live dall'esecutore, quindi basta leggerlo.
function renderWatch(active) {
  const box = document.getElementById('console-watch');
  if (!box || typeof box.setAttribute !== 'function') return; // ambiente senza DOM reale (test)
  if (!active || typeof flow === 'undefined' || !flow.variables || !flow.variables.length) {
    box.setAttribute('hidden', ''); box.innerHTML = ''; return;
  }
  box.removeAttribute('hidden');
  let html = '<div class="watch-title">' + ((typeof i18nText === 'function' && i18nText('watch_title')) || 'Variabili') + '</div>';
  html += flow.variables.map(function (v) {
    const val = (v && v.value !== undefined && v.value !== null && v.value !== '') ? String(v.value) : '—';
    return '<div class="watch-row"><span class="watch-name">' + (v.name || '?') + '</span>=<span class="watch-val">' + val.replace(/</g,'&lt;') + '</span></div>';
  }).join('');
  box.innerHTML = html;
}
function highlightExec(idx){
  execEdgeFrom = (typeof executingNodeIndex === "number" && executingNodeIndex >= 0) ? executingNodeIndex : -1;
  executingNodeIndex = idx;
  if (idx < 0) execEdgeFrom = -1; // reset: nessun arco evidenziato
  renderWatch(idx >= 0); // aggiorna/mostra il watch durante l'esecuzione, lo nasconde a fine run
  if (typeof draw === "function" && typeof nodi !== "undefined") draw(nodi);
}

// --- Visual debugger: pannello Variabili "live" durante Step/Run ---
// Aggiorna i valori mostrati nella tabella Variabili con lo stato corrente
// (flow.variables), ed evidenzia brevemente la riga della variabile appena
// toccata da questo nodo (input/assign/for). Non tocca l'input se l'utente ci
// sta scrivendo dentro (document.activeElement), per non interrompere l'editing.
function touchedVarName(node) {
  if (!node) return null;
  if (node.type === 'input') return node.info;
  if (node.type === 'assign') {
    const parts = (node.info || '').split('=');
    return parts.length === 2 ? parts[0].trim() : null;
  }
  if (node.type === 'for') {
    const initPart = ((node.info || '').split(';')[0] || '').split('=')[0];
    return initPart ? initPart.trim() : null;
  }
  return null;
}
function refreshVariablesWatch(variables, touchedName) {
  if (typeof tabVariabili === 'undefined' || !tabVariabili || !tabVariabili.rows) return;
  for (let i = 0; i < variables.length; i++) {
    const row = tabVariabili.rows[i + 1]; // riga 0 = header
    if (!row || !row.cells || !row.cells[2]) continue;
    const valueInput = row.cells[2].querySelector ? row.cells[2].querySelector('input') : null;
    if (!valueInput) continue;
    if (typeof document !== 'undefined' && document.activeElement === valueInput) continue; // non interrompere l'editing manuale
    valueInput.value = variables[i].value;
    if (touchedName && variables[i].name === touchedName && row.classList) {
      row.classList.add('var-updated');
      setTimeout(function () { row.classList.remove('var-updated'); }, 450);
    }
  }
}
function run(){
    const c = document.getElementById('console-popup');
    c.classList.add('active');
    // FIX #38 (Ismail 2026-07-08): la console (anche sganciata) NON e' modale: e' uno
    // strumento flottante/trascinabile. Niente overlay, cosi' il grafo resta scorrevole e
    // interagibile con il terminale mobile aperto.
    const _ov = document.getElementById('overlay'); if (_ov) _ov.classList.remove('active');
    updateZoomOffset();
    // Ricentra subito e di nuovo a fine transizione (larghezza console/griglia definitiva).
    if (typeof centerGraph === 'function') { centerGraph(); setTimeout(centerGraph, 240); }
    if (typeof updateTerminalTab === 'function') updateTerminalTab();
}

// Sposta i controlli zoom a sinistra della console agganciata (per non farli coprire)
// e riduce lo spazio di centratura del canvas (--console-cover-width, letta da
// #canvas-container in padding-right): cosi' canvas{margin:0 auto} si ricentra
// per davvero nello spazio libero, non solo via scroll (vedi anche centerGraph
// in layout.js, che gestisce il caso in cui il canvas e' PIU' largo dell'area
// visibile). Chiamata a ogni apri/chiudi/dock/resize della console.
function updateZoomOffset(){
    const c = document.getElementById('console-popup');
    const open = c && c.classList.contains('active') && c.classList.contains('docked');
    const coverW = open ? Math.round(c.getBoundingClientRect().width) : 0;
    const px = open ? coverW + 18 : 18;
    document.body.style.setProperty('--zoom-right', px + 'px');
    document.body.style.setProperty('--console-cover-width', coverW + 'px');
}

// Apre/chiude il terminale da una linguetta laterale (destra; a sinistra in RTL), come la
// barra delle Variabili -- non piu' (solo) dalla toolbar.
function toggleTerminal() {
  const c = document.getElementById('console-popup');
  if (c && c.classList.contains('active') && !c.classList.contains('docked-closing')) { closeConsole(); }
  else { run(); }
  updateTerminalTab();
}
function updateTerminalTab() {
  const c = document.getElementById('console-popup');
  const tab = document.getElementById('terminal-reopen');
  if (!tab) return;
  const open = c && c.classList.contains('active');
  tab.classList.toggle('is-open', !!open);
}

function closeConsole() {
    document.getElementById('console-popup').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
    updateZoomOffset();
    if (typeof centerGraph === 'function') { centerGraph(); setTimeout(centerGraph, 240); }
}

// Aggancia la console come pannello laterale destro o la sgancia come popup centrale.
function toggleConsoleDock() {
    const c = document.getElementById('console-popup');
    const docked = c.classList.toggle('docked');
    const active = c.classList.contains('active');
    { const _ov = document.getElementById('overlay'); if (_ov) _ov.classList.remove('active'); } // console non modale (#38)
    // Stato del toggle "Terminale mobile": attivo quando la console e' sganciata (floating).
    { const _mt = document.getElementById('console-mobile-toggle'); if (_mt) _mt.classList.toggle('is-mobile', !docked); }
    // FIX #28 (Ismail 2026-07-08): al cambio modalita' azzera gli stili inline lasciati dal
    // drag del popup, cosi' la modalita' agganciata torna al suo layout CSS pulito.
    c.style.left = ''; c.style.top = ''; c.style.transform = ''; c.style.margin = '';
    updateZoomOffset();
    if (typeof centerGraph === 'function') { centerGraph(); setTimeout(centerGraph, 240); }
}

// Segue il resize della console per tenere i controlli zoom a sinistra di essa.
(function(){
    try {
        const c = document.getElementById('console-popup');
        if (c && typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(function(){ updateZoomOffset(); if (typeof centerGraph === 'function') centerGraph(); }).observe(c);
        }
    } catch(_) {}
})();

// Maniglia di resize del pannello console (bordo sinistro, quando agganciata a
// destra): piu' affidabile del "resize" CSS nativo su un pannello a tutta
// altezza ancorato a destra (la maniglia nativa starebbe nell'angolo in basso
// a destra, poco scopribile). Il grafo si ricentra IN TEMPO REALE durante il
// trascinamento (non solo a resize concluso), cosi' segue la larghezza corrente.
(function(){
    try {
        const handle = document.getElementById('console-resize-handle');
        const consoleEl = document.getElementById('console-popup');
        if (!handle || !consoleEl) return;
        let resizing = false;
        const MIN_W = 210;
        handle.addEventListener('mousedown', function(e){
            if (!consoleEl.classList.contains('docked')) return; // solo da agganciata
            resizing = true;
            handle.classList.add('active-resize');
            e.preventDefault();
        });
        window.addEventListener('mousemove', function(e){
            if (!resizing) return;
            const maxW = window.innerWidth * 0.92;
            // FIX #33 (Ismail 2026-07-08): in RTL il pannello e' a SINISTRA, quindi la
            // larghezza si misura dal bordo sinistro (e.clientX), non dal destro.
            const _rtl = (typeof document !== 'undefined') && document.documentElement.getAttribute('dir') === 'rtl';
            let newWidth = _rtl ? e.clientX : (window.innerWidth - e.clientX);
            if (newWidth < MIN_W) newWidth = MIN_W;
            if (newWidth > maxW) newWidth = maxW;
            consoleEl.style.width = newWidth + 'px';
            updateZoomOffset();
            if (typeof centerGraph === 'function') centerGraph();
        });
        window.addEventListener('mouseup', function(){
            if (!resizing) return;
            resizing = false;
            handle.classList.remove('active-resize');
        });
    } catch(_) {}
})();

function resetFlow() {
    currentNode = "0"; // Reimposta al primo nodo
    prevNode = null; // FIX B2: nessun "nodo precedente" significativo dopo un reset
    stopRequested = false;
    // Ripulisce lo stato runtime dei nodi "for" (_forInitialized): senza questo, un
    // reset a meta' di un ciclo lascerebbe il flag a true e la prossima esecuzione
    // salterebbe l'inizializzazione, ripartendo dal valore precedente invece che da capo.
    if (typeof flow !== 'undefined' && flow && Array.isArray(flow.nodes)) {
        flow.nodes.forEach(n => { if (n) n._forInitialized = false; });
    }
    highlightExec(-1);
    if (typeof nodi !== 'undefined' && Array.isArray(nodi)) nodi.forEach(function (v) { if (v) v._error = false; });
    if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
    const consoleOutput = document.getElementById('console-output');
    printMessage("Flow resetted. Ready to execute again."); // Flusso resettato. Pronto per essere eseguito di nuovo. (Nota: printMessage già gestisce l'output, questo commento traduce il messaggio originale se fosse stato un commento a sé)
    const input = document.getElementById('console-input')
    const btn = document.getElementById('console-send')
    input.classList.remove('active');
}

async function executeStep(){
  if(currentNode== null){
    currentNode = "0"; // Reimposta al primo nodo se currentNode è nullo
    prevNode = null; // FIX B2: riavvio dall'inizio, nessun predecessore significativo
  }
  highlightExec(parseInt(currentNode)); // evidenzia il blocco che sta per essere eseguito
  const node = flow.nodes[parseInt(currentNode)];
  const nodeIdxBeforeExec = currentNode; // FIX B2: sara' il "prevNode" del prossimo giro
  currentNode = await executeNode(node,currentNode,flow.variables,prevNode);
  prevNode = nodeIdxBeforeExec;
  refreshVariablesWatch(flow.variables, touchedVarName(node)); // aggiorna il pannello Variabili "live"
  highlightExec(currentNode != null ? parseInt(currentNode) : -1); // sposta l'evidenziazione al prossimo
}

// Tetto di sicurezza anti-loop-infinito (bug BLOCCANTE trovato dalla review di
// Fable sul piano cicli, verificato empiricamente: un while a corpo vuoto con
// condizione sempre vera — ESATTAMENTE la rappresentazione proposta per un ciclo
// appena creato dalla UI — non terminava mai; con velocita' "Istantanea" (nessun
// sleep) congelava il tab). Senza questo tetto, introdurre i cicli nella UI
// sarebbe stato pericoloso: un utente puo' creare per sbaglio un ciclo che non
// avanza mai. `stopRequested` permette anche un'interruzione manuale (bottone Stop).
const MAX_EXECUTION_STEPS = 50000;
let stopRequested = false;
// Rilievo 20: Pausa (sospende mantenendo l'evidenziazione) e stato "in esecuzione".
let pauseRequested = false;
let _bfRunning = false;
function _setRunning(on) { _bfRunning = !!on; const b = document.getElementById('exec-pause'); if (b) b.disabled = !on; const s = document.getElementById('console-stop'); if (s) s.disabled = !on; }
function requestPause() { if (_bfRunning) pauseRequested = true; }
// Stop = interruzione COMPLETA + azzeramento: la prossima esecuzione riparte da Start.
function requestStop() { stopRequested = true; }

async function executeFlow(json){
    console.log(json)
    if(currentNode== null){
      currentNode = "0"; // Reimposta al primo nodo se currentNode è nullo
      prevNode = null; // FIX B2: riavvio dall'inizio, nessun predecessore significativo
      if (typeof resetDrawBuffer === 'function') resetDrawBuffer(); // nuova esecuzione: tela pulita
      if (typeof nodi !== 'undefined' && Array.isArray(nodi)) nodi.forEach(function (v) { if (v) v._error = false; });
    }
    let variables = json.variables;
    let stepGuard = 0;
    stopRequested = false; pauseRequested = false;
    let _paused = false;
    _setRunning(true);
    while(currentNode != null){
        if (stopRequested) {
            printMessage("Execution stopped by user.");
            stopRequested = false;
            // Stop azzera lo stato: currentNode=null -> la prossima esecuzione riparte da Start
            currentNode = null; prevNode = null;
            if (typeof flow !== 'undefined' && flow && Array.isArray(flow.nodes)) flow.nodes.forEach(function (n) { if (n) n._forInitialized = false; });
            break;
        }
        stepGuard++;
        if (stepGuard > MAX_EXECUTION_STEPS) {
            throwError(errMsg('err_infinite_loop', {n: MAX_EXECUTION_STEPS}));
            break;
        }
        highlightExec(parseInt(currentNode)); // evidenzia il blocco corrente
        if (runSpeed > 0) await sleep(runSpeed); // velocità animazione (Lenta/Normale/Veloce/Istantanea)
        if (pauseRequested) { // Pausa: sospende QUI, il blocco resta evidenziato, si riprende con Esegui/Passo
            pauseRequested = false; _paused = true;
            printMessage('\u23F8 Esecuzione in pausa. Premi Esegui o Passo per continuare.', 'debug');
            break;
        }
        const node = json.nodes[parseInt(currentNode)];
        const nodeIdxBeforeExec = currentNode; // FIX B2: sara' il "prevNode" del prossimo giro
        // MIGLIORIA #42 (Ismail 2026-07-08): il blocco Pause e' un BREAKPOINT reale. Durante il
        // Run automatico, quando si raggiunge un Pause si esegue (pass-through), si avanza al
        // nodo successivo e si INTERROMPE il run: l'utente riprende con Esegui o Step. currentNode
        // resta sul nodo DOPO il Pause, quindi riprendendo non si ripausa all'infinito.
        if (node && node.type === 'pause') {
            printMessage('\u23F8 Breakpoint (Pause). Premi Esegui o Step per continuare.', 'debug');
            currentNode = await executeNode(node, currentNode, variables, prevNode);
            prevNode = nodeIdxBeforeExec;
            refreshVariablesWatch(variables, touchedVarName(node));
            highlightExec(currentNode != null ? parseInt(currentNode) : -1);
            break;
        }
        currentNode = await executeNode(node,currentNode,variables,prevNode);
        prevNode = nodeIdxBeforeExec;
        refreshVariablesWatch(variables, touchedVarName(node)); // aggiorna il pannello Variabili "live"
    }
    _setRunning(false);
    if (!_paused) highlightExec(-1); // finita/stop: rimuove l'evidenziazione (in pausa: la mantiene)
}

// FIX #13 (Ismail 2026-07-08): impostazioni terminale. L'utente puo' scegliere quali
// categorie di messaggi mostrare durante l'esecuzione. Categorie: 'output' (sempre),
// 'if' (esiti delle condizioni), 'loop' (esiti dei cicli), 'debug' (info di framework).
var consoleSettings = { output: true, cond: true, loop: true, debug: true };
try {
  const _cs = (typeof localStorage !== 'undefined') ? JSON.parse(localStorage.getItem('baseflow-console-settings')) : null;
  if (_cs && typeof _cs === 'object') consoleSettings = Object.assign(consoleSettings, _cs);
} catch (e) { /* non bloccante */ }
function saveConsoleSettings(){ try { localStorage.setItem('baseflow-console-settings', JSON.stringify(consoleSettings)); } catch(e){} }
function classifyConsoleMsg(msg){
  const m = String(msg);
  if (/^If:/.test(m)) return 'cond';
  if (/^(While:|For:|For Condition:|Do:)/.test(m)) return 'loop';
  if (/^(Start$|Flow resetted|Execution stopped|Console cleared|Do: entering body|End$)/.test(m)) return 'debug';
  return 'output';
}
// Aggiorna le checkbox delle impostazioni (se il pannello e' in DOM) allo stato corrente.
function syncConsoleSettingsUI(){
  ['output','cond','loop','debug'].forEach(function(k){
    const el = document.getElementById('cset-' + k);
    if (el) el.checked = !!consoleSettings[k];
  });
}
function toggleConsoleSetting(key, val){ consoleSettings[key] = !!val; saveConsoleSettings(); }
function toggleConsoleSettingsPanel(){
  const p = document.getElementById('console-settings-panel');
  if (!p) return;
  const show = p.hasAttribute('hidden');
  if (show) { p.removeAttribute('hidden'); syncConsoleSettingsUI(); } else { p.setAttribute('hidden', ''); }
}
function printMessage(msg, category){
    const cat = category || classifyConsoleMsg(msg);
    // 'output' (contenuto utente) e gli errori si mostrano SEMPRE; le altre categorie
    // rispettano le impostazioni del terminale.
    if (cat !== 'output' && consoleSettings && consoleSettings[cat] === false) return;
    const consoleOutput = document.getElementById('console-output');
    const messageElement = document.createElement('p');
    messageElement.textContent = "> " +  msg;
    if (cat && cat !== 'output' && messageElement.setAttribute) messageElement.setAttribute('data-cat', cat);
    consoleOutput.appendChild(messageElement);
    consoleOutput.scrollTop = consoleOutput.scrollHeight; // Scorre fino in fondo
}

function throwError(msg){
    const consoleOutput = document.getElementById('console-output');
    const errorElement = document.createElement('p');
    errorElement.textContent = "> Error: " + msg;
    errorElement.classList.add('error');
    consoleOutput.appendChild(errorElement);
    consoleOutput.scrollTop = consoleOutput.scrollHeight; // Scorre fino in fondo
    // COME FLOWGORITHM (Ismail 2026-07-08): l'errore si mostra a RUNTIME. Evidenzia in ROSSO
    // il blocco che ha generato l'errore e apre un popup con la spiegazione esatta.
    let errIdx = (typeof executingNodeIndex !== 'undefined' && executingNodeIndex >= 0)
        ? executingNodeIndex : parseInt(currentNode, 10);
    if (typeof flow !== 'undefined' && flow && flow.nodes && !isNaN(errIdx) && typeof nodi !== 'undefined' && nodi[errIdx]) {
        nodi[errIdx]._error = true;
        if (typeof draw === 'function') draw(nodi);
    }
    if (typeof showRuntimeError === 'function') showRuntimeError(msg, (isNaN(errIdx) ? null : errIdx));
    currentNode = "0"; // Reimposta al primo nodo in caso di errore
}

function clearConsole() {
    const consoleOutput = document.getElementById('console-output');
    consoleOutput.innerHTML = ''; // Pulisce l'output della console
    printMessage("Console cleared."); // Console pulita
}

async function executeNode(node,currentNode,variables,prevNodeArg){
  // Tipi che NON richiedono contenuto: start/end, marcatori (comment/pause) e i blocchi
  // GRAFICA/turtle (forward/turn/pen usano valori di DEFAULT se vuoti; home/gclear non hanno
  // parametri) -> un blocco turtle non modificato resta VALIDO e non deve dare "nodo vuoto".
  const _noContentReq = ["start","end","comment","pause","forward","turn","home","pen","gclear"];
  if(_noContentReq.indexOf(node.type) === -1 && node.info == "") {
    throwError(errMsg('err_empty_node', {n: currentNode}));
    return null;
  }
  switch(node.type){
            case "start":       // NODO START
                console.log("Start\n");
                printMessage("Start");
                currentNode = node.next;
                break;
            case "print": // NODO PRINT
                string="";
                parts = splitStrings(node.info);
                for (let i = 0; i < parts.length; i++) {
                  if (parts[i].startsWith("'") || parts[i].startsWith('"') ) {
                    string += parts[i].substring(1, parts[i].length - 1);
                  } else {
                    let expression = "";
                    let isVar = false;
                    let variable = "";
                    for (let j = 0; j < parts[i].length; j++) {
                      if (parts[i][j] == " ") {
                        if (isVar && variable !== "" && variable !== "'" && variable !== '"') {
                          if(!existVariable(variable,variables)){
                            throwError(errMsg('err_not_declared_node', {n: currentNode, v: variable}))
                            return null;
                          }
                          let v = getVariable(variable, variables);
                          if (v) {
                            expression += v.value.toString();
                          } else {
                            expression += variable;
                          }
                          variable = "";
                        }
                        isVar = false;
                        continue;
                      }
                      if (!isNaN(parts[i][j]) || "+-*/".includes(parts[i][j])) {
                        if (isVar && variable !== "" && variable !== "'" && variable !== '"') {
                          if(!existVariable(variable,variables)){
                            throwError(errMsg('err_not_declared_node', {n: currentNode, v: variable}))
                            return null;
                          }
                          let v = getVariable(variable, variables);
                          if (v) {
                            expression += v.value.toString();
                          } else {
                            expression += variable;
                          }
                          variable = "";
                        }
                        isVar = false;
                        expression += parts[i][j];
                      } else {
                        isVar = true;
                        variable += parts[i][j];
                      }
                      if (isVar && j == parts[i].length - 1) {
                        if (variable !== "" && variable !== "'" && variable !== '"') {
                          if(!existVariable(variable,variables)){
                            throwError(errMsg('err_not_declared_node', {n: currentNode, v: variable}))
                            return null;
                          } 
                          let v = getVariable(variable, variables);
                          if (v) {
                            expression += v.value.toString();
                          } else {
                            expression += variable;
                          }
                        }
                        isVar = false;
                        variable = "";
                      }
                    }
                    string += safeEvaluate(expression);
                  }
                }
                console.log("Print: " + string);
                printMessage(string, 'output');
                currentNode = node.next;
                break; 
              case "if": // NODO IF
                let condition = node.info;
                console.log("If: " + condition);
                printMessage("If: " + condition);
                
                if (checkCondition(condition, variables) == true) {
                    console.log("If: " + condition + " is true");
                    printMessage("If: " + condition + " is true");
                    currentNode = node.next.true;
                } else if(checkCondition(condition, variables) == false) {
                    console.log("If: " + condition + " is false");
                    printMessage("If: " + condition + " is false");
                    currentNode =  node.next.false;
                }else{
                  return null;
                }
                break;
              case "while": // NODO WHILE
                let whileCondition = node.info;
                console.log("While: " + whileCondition);
                printMessage("While: " + whileCondition);
                if(checkCondition(whileCondition, variables) == true){
                    console.log("While: " + whileCondition + " is true");
                    printMessage("While: " + whileCondition + " is true");
                    currentNode = node.next.true; // Vai al ramo true
                }else if(checkCondition(whileCondition, variables) == false){
                    console.log("While: " + whileCondition + " is false");
                    printMessage("While: " + whileCondition + " is false");
                    currentNode = node.next.false; // Vai al ramo false
                }else{
                    return null; 
                }
                break;
              case "do": // NODO DO
                // FIX B2 (review Fable, 2026-07-05, piano Do-While/For): a differenza
                // del While, un Do-While deve eseguire il corpo ALMENO UNA VOLTA --
                // la condizione va valutata solo quando si ARRIVA DAL BACK-EDGE (cioe'
                // il corpo e' gia' stato eseguito almeno una volta), non alla prima
                // visita (arrivo da fuori il ciclo). Si distingue guardando se il nodo
                // precedente (prevNodeArg, passato dal chiamante) appartiene al corpo
                // del ciclo stesso (collectLoopBody) -- se si', e' un ri-arrivo tramite
                // back-edge e la condizione va valutata normalmente (come un while);
                // se no (o il corpo e' vuoto, self-loop: degenera a while, comportamento
                // accettato e documentato), e' la prima visita e si entra nel corpo
                // SENZA valutare nulla.
                let doIdx = parseInt(currentNode, 10);
                let doBody = (typeof collectLoopBody === 'function') ? collectLoopBody(doIdx) : { bodyList: [] };
                let prevNodeIdxDo = (prevNodeArg !== null && prevNodeArg !== undefined) ? parseInt(prevNodeArg, 10) : NaN;
                let isFirstVisit = doBody.bodyList.length > 0 && !(doBody.bodyList.includes(prevNodeIdxDo));
                if (isFirstVisit) {
                    console.log("Do: prima esecuzione, corpo eseguito senza valutare la condizione");
                    printMessage("Do: entering body (executes at least once)");
                    currentNode = node.next.true; // Vai al ramo true SENZA valutare la condizione
                    break;
                }
                let doCondition = node.info;
                console.log("Do: " + doCondition);
                printMessage("Do: " + doCondition);
                if(checkCondition(doCondition, variables) == true){
                    console.log("Do: " + doCondition + " is true");
                    printMessage("Do: " + doCondition + " is true");
                    currentNode = node.next.true; // Vai al ramo true
                }else if (checkCondition(doCondition, variables) == false){
                    console.log("Do: " + doCondition + " is false");
                    printMessage("Do: " + doCondition + " is false");
                    currentNode = node.next.false; // Vai al ramo false
                }else{
                  return null;
                }
                break;
              case "for": // NODO FOR
                // BUG REALI trovati dalla review di Fable sul piano cicli (2026-07-04),
                // verificati empiricamente con un harness isolato prima del fix:
                // (1) `getVariable(init[0], variables)` usava il PRIMO CARATTERE della
                //     stringa "i=1" invece del nome della variabile: funzionava per puro
                //     caso solo con nomi di una lettera che iniziano a posizione 0.
                // (2) l'inizializzazione veniva riscritta dentro `.info` come testo
                //     letterale (`i=<valore>+<incremento>`): con un incremento tipo
                //     "i++" questo produceva "i=1+i++", che alla sostituzione delle
                //     variabili (i -> valore) diventava "1+0++" — sintassi JS invalida
                //     (non si puo' incrementare un literal). Funzionava SOLO con un
                //     incremento numerico nudo ("1"), non con la sintassi C-style
                //     dell'esempio nel piano stesso ("i=0;i<3;i++").
                // Fix: lo stato del contatore NON tocca piu' `.info` (resta il testo
                // esatto scritto dall'utente); un flag runtime sul nodo (`_forInitialized`,
                // non serializzato, irrilevante per save/open) distingue la PRIMA
                // esecuzione (fa girare l'inizializzazione una volta) dalle successive
                // (applica l'incremento via `applyForIncrement`, che supporta le sintassi
                // comuni i++/i--/i+=n/i-=n/i=espressione senza chirurgia di stringhe).
                let forParts = node.info.split(";");
                if (forParts.length !== 3) {
                    throwError(errMsg('err_for_syntax', {e: node.info}));
                    return null;
                }

                let init = forParts[0].trim();
                let forcondition = forParts[1].trim();
                let increment = forParts[2].trim();

                if (!node._forInitialized) {
                    let initParts = init.split("=");
                    if (initParts.length !== 2) {
                        throwError(errMsg('err_for_init', {e: init}));
                        return null;
                    }
                    let forVarName = initParts[0].trim();
                    let forInitExp = initParts[1].trim();
                    variables.forEach(v => {
                      forInitExp = forInitExp.replace(new RegExp(`\\b${v.name}\\b`, 'g'), v.value.toString());
                    });
                    if (!existVariable(forVarName, variables)) {
                        throwError(errMsg('err_not_declared_node', {n: currentNode, v: forVarName}));
                        return null;
                    }
                    try {
                        getVariable(forVarName, variables).value = safeEvaluate(forInitExp);
                    } catch (e) {
                        throwError(errMsg('err_for_init_expr', {n: currentNode, e: e}));
                        return null;
                    }
                    console.log("For: " + forVarName + " = " + getVariable(forVarName, variables).value);
                    printMessage("For: " + forVarName + " = " + getVariable(forVarName, variables).value);
                    node._forInitialized = true;
                } else {
                    if (!applyForIncrement(increment, variables, currentNode)) return null;
                }

                // Controlla condizione
                if (checkCondition(forcondition, variables) == true) {
                    console.log("For Condition: " + forcondition + " is true");
                    printMessage("For Condition: " + forcondition + " is true");
                    currentNode = node.next.true;
                } else if(checkCondition(forcondition, variables) == false) {
                    console.log("For Condition: " + forcondition + " is false");
                    printMessage("For Condition: " + forcondition + " is false");
                    currentNode = node.next.false;
                    node._forInitialized = false; // pronto per una futura ri-esecuzione (es. loop annidato in un altro ciclo)
                }else{
                  return null;
                }
                break;
              case "input": //NODO INPUT
                console.log("Input: " + node.info);
                printMessage("Input: " + node.info);
                if (!existVariable(node.info,variables)) {
                    throwError(errMsg('err_var_not_declared', {v: node.info}));
                    return null;
                }
                getVariable(node.info,variables).value = await inputVariable(node.info, getVariable(node.info,variables).type);
                currentNode = node.next;  
                break;

              case "assign": // NODO ASSIGN
                console.log("Assign: " + node.info);
                printMessage("Assign: " + node.info)
                let assignParts = node.info.split("=");
                if(assignParts.length != 2){
                  throwError(errMsg('err_assign_syntax', {n: currentNode}))
                  return null;
                }
                let varName = assignParts[0].trim();
                let exp = assignParts[1].trim();

                variables.forEach(v => {
                  // Sostituisci i nomi delle variabili nell'espressione con i loro valori
                  // Usa i confini delle parole per evitare sostituzioni parziali
                  exp = exp.replace(new RegExp(`\\b${v.name}\\b`, 'g'), v.value.toString());
                });
                if(!existVariable(varName,variables)){
                  throwError(errMsg('err_not_declared_node', {n: currentNode, v: varName}))
                  return null;
                }
                try{
                  getVariable(varName,variables).value = safeEvaluate(exp);
                }catch(e){
                  throwError(errMsg('err_invalid_expr', {n: currentNode, e: e}));
                }
                currentNode = node.next;
                break;

              case "comment": // NODO COMMENT (Tools) -- non eseguibile, pass-through
            case "pause":   // NODO PAUSE (Tools) -- non eseguibile, pass-through
                currentNode = node.next;
                break;
            case "forward": // GRAFICA turtle (Flowgorithm): muovi/disegna, ruota, casa, penna, pulisci
            case "turn":
            case "home":
            case "pen":
            case "gclear":
                if (typeof execTurtleNode === 'function') {
                  const _tgOk = execTurtleNode(node.type, node.info, variables, currentNode);
                  if (_tgOk === false) return null;
                }
                currentNode = node.next;
                break;
            case "end": // NODO END
                console.log("End\n");
                printMessage("End.");
                currentNode = node.next;
                break;
        }
        return currentNode
}

// Applica l'incremento di un ciclo "for" direttamente alla variabile (senza mai
// mutare `.info`): supporta le sintassi C-style comuni. Restituisce true se
// l'incremento e' stato applicato, false se ha lanciato un errore (throwError gia'
// chiamato dentro, il chiamante deve solo interrompere l'esecuzione del nodo).
function applyForIncrement(incrExpr, variables, currentNode) {
    const s = (incrExpr || "").trim();
    let m;
    if ((m = s.match(/^([A-Za-z_]\w*)\s*\+\+$/))) {
        const v = getVariable(m[1], variables);
        if (!v) { throwError(errMsg('err_not_declared_node', {n: currentNode, v: m[1]})); return false; }
        v.value = v.value + 1;
        return true;
    }
    if ((m = s.match(/^([A-Za-z_]\w*)\s*--$/))) {
        const v = getVariable(m[1], variables);
        if (!v) { throwError(errMsg('err_not_declared_node', {n: currentNode, v: m[1]})); return false; }
        v.value = v.value - 1;
        return true;
    }
    if ((m = s.match(/^([A-Za-z_]\w*)\s*\+=\s*(.+)$/))) {
        const v = getVariable(m[1], variables);
        if (!v) { throwError(errMsg('err_not_declared_node', {n: currentNode, v: m[1]})); return false; }
        let exp = m[2];
        variables.forEach(vv => { exp = exp.replace(new RegExp(`\\b${vv.name}\\b`, 'g'), vv.value.toString()); });
        try { v.value = v.value + safeEvaluate(exp); } catch (e) { throwError(errMsg('err_incr_expr', {n: currentNode, e: e})); return false; }
        return true;
    }
    if ((m = s.match(/^([A-Za-z_]\w*)\s*-=\s*(.+)$/))) {
        const v = getVariable(m[1], variables);
        if (!v) { throwError(errMsg('err_not_declared_node', {n: currentNode, v: m[1]})); return false; }
        let exp = m[2];
        variables.forEach(vv => { exp = exp.replace(new RegExp(`\\b${vv.name}\\b`, 'g'), vv.value.toString()); });
        try { v.value = v.value - safeEvaluate(exp); } catch (e) { throwError(errMsg('err_incr_expr', {n: currentNode, e: e})); return false; }
        return true;
    }
    if ((m = s.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/))) {
        const v = getVariable(m[1], variables);
        if (!v) { throwError(errMsg('err_not_declared_node', {n: currentNode, v: m[1]})); return false; }
        let exp = m[2];
        variables.forEach(vv => { exp = exp.replace(new RegExp(`\\b${vv.name}\\b`, 'g'), vv.value.toString()); });
        try { v.value = safeEvaluate(exp); } catch (e) { throwError(errMsg('err_incr_expr', {n: currentNode, e: e})); return false; }
        return true;
    }
    throwError(errMsg('err_incr_syntax', {n: currentNode, e: incrExpr}));
    return false;
}

function checkCondition(condition, variables) {
    let expression = "";
    let isVar = false;
    let variable = "";

    for (let j = 0; j < condition.length; j++) {
        if (condition[j] == " ") {
            if (isVar) {
                isVar = false;
                let v = getVariable(variable, variables);
                if(!existVariable(variable,variables)){
                  throwError(errMsg('err_not_declared', {v: variable}))
                  return {};
                }
                if (v) {
                    expression += v.value.toString();
                } else {
                    expression += variable;
                }
                variable = "";
            }
            continue;
        }
        if (!isNaN(condition[j]) || "+-*/<>!=.()".includes(condition[j])) {
            if (isVar) {
                isVar = false;
                let v = getVariable(variable, variables);
                if(!existVariable(variable,variables)){
                  throwError(errMsg('err_not_declared', {v: variable}))
                  return {};
                }
                if (v) {
                    expression += v.value.toString();
                } else {
                    expression += variable;
                }
                variable = "";
            }
            expression += condition[j];
        } else {
            isVar = true;
            variable += condition[j];
        }
        if (j == condition.length - 1 && isVar) {
            let v = getVariable(variable, variables);
            if(!existVariable(variable,variables)){
                throwError(errMsg('err_not_declared', {v: variable}))
                return {};
            }
            if (v) {
                expression += v.value.toString();
            } else {
                expression += variable;
            }
            isVar = false;
            variable = "";
        }
    }

    try {
        if(!isNaN(expression)){
          return !!safeEvaluate(expression);
        }else{
          return safeEvaluate(expression);
        }
    } catch (e) {
        throwError(errMsg('err_condition', {e: expression + '. ' + e.message}));
        return {};
    }
}


function splitStrings(input) {
  const parts = [];
  let buffer = "";
  let isExpression = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (char === "'" || char === '"') {
      if (isExpression) {
        isExpression = false;
      } else {
        isExpression = true;
      }

      buffer += char;
      i++;

      while (i < input.length) {
        buffer += input[i];
        if (input[i] === "'" || input[i] === '"') {
          isExpression = false; 
          i++;
          break;
        }
        i++;
      }

      parts.push(buffer.trim());
      buffer = "";
      continue;
    }

    if (char === '+') {
      if (!isExpression) {
        let j = i + 1;
        while (j < input.length && input[j] === ' ') j++;

        if (input[j] === "'" || input[j] === '"') {
          if (buffer.trim() !== "") {
            parts.push(buffer.trim());
          }
          buffer = "";
          i++; 
          continue;
        }
      }

      buffer += '+';
      i++;
      continue;
    }

    buffer += char;
    i++;
  }

  if (buffer.trim() !== "") {
    parts.push(buffer.trim());
  }

  return parts;
}

async function inputVariable(name,type) {
 // const input = prompt(`Inserisci un valore per ${name} (${type}):`); //Riga di codice commentata per l'input tramite prompt
  const input = await askUserInput();
  const feedback = () => {
      document.getElementById('console-input').classList.add('input-error');
      setTimeout(() => document.getElementById('console-input').classList.remove('input-error'), 500);
    };
  if (input !== null) {
    switch (type) {
      case "int":
        if (isNaN(input)) {
          throwError(errMsg('err_input_int'));
          feedback();
          return inputVariable(name, type);
        }
        printMessage(input);
        return parseInt(input);
      case "float":
        if (isNaN(input)) {
          throwError(errMsg('err_input_real'));
          feedback();
          return inputVariable(name, type);
        }
        printMessage(input);
        return parseFloat(input);
      case "string":
        printMessage(input);
        return input;
    }
  } else {
    return null;
  }
}

function askUserInput(){
  document.getElementById('console-input').value= "";
  document.getElementById('console-input').classList.add('active');
  try { document.getElementById('console-input').focus(); } catch(_) {}
  return new Promise((resolve) => {
    const inputElem = document.getElementById('console-input');
    const sendBtn = document.getElementById('console-send');
    const feedback = () => {
      inputElem.classList.add('input-error');
      setTimeout(() => inputElem.classList.remove('input-error'), 500);
    };
    const handler = () => {
      const value = inputElem.value.trim();
      if (value === "") {
        feedback();
        return;
      }
      sendBtn.removeEventListener('click', handler);
      inputElem.removeEventListener('keydown', keyHandler);
      inputElem.classList.remove('active');
      resolve(value);
    };
    const keyHandler = (e) => {
      if (e.key === 'Enter') {
        handler();
      }
    };
    sendBtn.addEventListener('click', handler);
    inputElem.addEventListener('keydown', keyHandler);
  });
}

function existVariable(vrbl,variables){
  for(i=0;i<variables.length;i++){
    if(vrbl == variables[i].name){
      return true
    }
  }
  return false
}

function getVariable(vrbl,variables){
   for(i=0;i<variables.length;i++){
    if(vrbl == variables[i].name){
      return variables[i]
    }
  }
  return null
}


// ---- Console: zoom caratteri + download output (Ismail 2026-07-07) ----
// Ingrandisce/riduce la dimensione del testo della console (output + input) in modo
// indipendente dallo zoom del grafo. Persistito in localStorage cosi' resta fra sessioni.
let consoleFontScale = 1;
try {
  const _cs = (typeof localStorage !== 'undefined') ? parseFloat(localStorage.getItem('baseflow-console-font-scale')) : NaN;
  if (!isNaN(_cs) && _cs > 0) consoleFontScale = _cs;
} catch (e) { /* localStorage non disponibile: non bloccante */ }
function applyConsoleFontScale() {
  const out = document.getElementById('console-output');
  const inp = document.getElementById('console-input');
  if (out) out.style.fontSize = consoleFontScale + 'em';
  // FIX #7 (Ismail 2026-07-08): lo zoom del terminale riguarda SOLO il contenuto testuale
  // (output). Il campo "Inserisci un valore" mantiene sempre la sua dimensione originale.
  if (inp) inp.style.fontSize = '';
}
function consoleFontZoom(delta) {
  consoleFontScale = Math.max(0.6, Math.min(2.4, +(consoleFontScale + delta).toFixed(2)));
  applyConsoleFontScale();
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('baseflow-console-font-scale', String(consoleFontScale)); } catch (e) {}
}
function consoleFontReset() {
  consoleFontScale = 1;
  applyConsoleFontScale();
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('baseflow-console-font-scale', '1'); } catch (e) {}
}
// Scarica il contenuto testuale della console come file .txt (nome con timestamp).
function downloadConsoleOutput() {
  const out = document.getElementById('console-output');
  if (!out) return;
  const text = (out.innerText || out.textContent || '').replace(/\u00a0/g, ' ').trim();
  if (!text) { return; }
  try {
    const blob = new Blob([text + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = 'baseflow-console-' + ts + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { console.warn('download console output fallito', e); }
}
// Applica la scala salvata appena il DOM e' pronto (senza dipendere da window.onload,
// che e' gia' definita altrove -- si aggancia in coda in modo idempotente).
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', applyConsoleFontScale);
}


// ---- Svuota canvas + indicatore modifiche non salvate (Ismail 2026-07-07) ----
// Svuota tutto il canvas riportandolo a Start/End. Se ci sono modifiche non salvate (e il
// flowchart non e' gia' vuoto) chiede conferma prima (messaggio tradotto).
function _doClearCanvas() {
  try {
    flow = { nodes: [ { type: 'start', info: '', next: '1' }, { type: 'end', info: '', next: null } ], variables: [] };
    nodi = [
      { relX: 0.35, relY: 0.05, width: 100, height: 40, color: 'white', text: 'Start' },
      { relX: 0.35, relY: 0.4, width: 100, height: 40, color: 'white', text: 'End' }
    ];
    if (typeof clearHistory === 'function') clearHistory();
    saved = true;
    if (typeof calcoloY === 'function') calcoloY(nodi);
    if (typeof draw === 'function') draw(nodi);
    if (typeof syncUnsavedIndicator === 'function') syncUnsavedIndicator();
  } catch (e) { console.warn('clearCanvas fallito', e); }
}
function clearCanvas() {
  if (typeof isEmpty === 'function' && isEmpty()) return;
  // Rilievo 16: con modifiche non salvate, chiedi conferma (modale stilizzata) prima di svuotare.
  if (typeof saved !== 'undefined' && !saved) {
    const msg = (typeof i18nText === 'function' && i18nText('unsaved')) || 'Ci sono modifiche non salvate. Continuare?';
    if (typeof showStyledConfirm === 'function') {
      showStyledConfirm(msg, _doClearCanvas, { danger: true, okLabel: (typeof i18nText === 'function' && i18nText('yes')) || 'Sì' });
      return;
    }
    if (typeof confirm === 'function' && !confirm(msg)) return;
  }
  _doClearCanvas();
}
// Rilievo 16: avviso del browser prima di RICARICARE/chiudere se ci sono modifiche non salvate.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('beforeunload', function (e) {
    try {
      const dirty = (typeof saved !== 'undefined' && !saved) && !(typeof isEmpty === 'function' && isEmpty());
      if (dirty) { e.preventDefault(); e.returnValue = ''; return ''; }
    } catch (_) {}
  });
}

// Sincronizza l'indicatore "modifiche non salvate" (pallino in header) col flag `saved`.
function syncUnsavedIndicator() {
  const el = (typeof document !== 'undefined') ? document.getElementById('unsaved-indicator') : null;
  if (!el) return;
  const dirty = (typeof saved !== 'undefined') && !saved && !(typeof isEmpty === 'function' && isEmpty());
  if (dirty) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', function () {
    try { setInterval(syncUnsavedIndicator, 600); } catch (e) {}
  });
}

// FIX #3/#24 (Ismail 2026-07-08): la console AGGANCIATA e' position:fixed (resta ferma
// rispetto alla viewport/canvas). Quando pero' si scrolla la PAGINA fino al footer, deve
// spostarsi via insieme alla pagina (non coprire il footer). Traslandola in su di scrollY
// si ottiene esattamente: ferma durante l'uso, scorre via quando scrolli fino in fondo.
(function () {
  function syncConsoleScroll() {
    const sy = -Math.max(0, window.scrollY || window.pageYOffset || 0);
    const el = document.getElementById('console-popup');
    if (el) {
      if (el.classList.contains('docked') && el.classList.contains('active')) {
        el.style.transform = 'translateY(' + sy + 'px)';
      } else if (el.classList.contains('docked')) {
        el.style.transform = '';
      }
    }
    // FIX (Ismail 2026-07-08): i controlli zoom sono position:fixed (fermi durante l'uso),
    // ma quando si scrolla la PAGINA fino al footer devono spostarsi via INSIEME al terminale
    // per non coprire il footer -- stessa traslazione applicata alla console.
    const zc = document.getElementById('zoom-controls');
    if (zc) zc.style.transform = 'translateY(' + sy + 'px)';
  }
  window.addEventListener('scroll', syncConsoleScroll, { passive: true });
  window.addEventListener('resize', syncConsoleScroll);
})();

// FIX #6/#28 (Ismail 2026-07-08): la console in modalita' POPUP (sganciata) e' trascinabile
// liberamente. Si afferra dall'area in alto (non dai controlli). In modalita' agganciata il
// drag e' disattivato (li' si usa la maniglia di resize laterale).
(function () {
  const el = document.getElementById('console-popup');
  if (!el) return;
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
  el.addEventListener('mousedown', function (e) {
    if (el.classList.contains('docked')) return;            // solo popup sganciato
    if (e.target.closest('button, input, select, textarea, a, #console-output, #console-settings-panel, #console-resize-handle')) return;
    const r = el.getBoundingClientRect();
    el.style.left = r.left + 'px'; el.style.top = r.top + 'px';
    el.style.transform = 'none'; el.style.margin = '0';
    dragging = true; ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
    el.classList.add('dragging'); e.preventDefault();
  });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    let nx = ox + (e.clientX - sx), ny = oy + (e.clientY - sy);
    nx = Math.max(0, Math.min(window.innerWidth - 60, nx));
    ny = Math.max(0, Math.min(window.innerHeight - 40, ny));
    el.style.left = nx + 'px'; el.style.top = ny + 'px';
  });
  window.addEventListener('mouseup', function () {
    if (!dragging) return;
    dragging = false; el.classList.remove('dragging');
  });
})();

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
// P2.6 (round 15-B S2, Ismail 2026-07-15): sleep() cancellabile. Tiene traccia del delay
// ATTUALMENTE in corso (uno solo alla volta: l'esecuzione e' sempre sequenziale, dentro un
// await) cosi' "Passo" premuto durante una run automatica puo' farlo scadere SUBITO invece di
// aspettare il resto di ms -- vedi _bfSkipCurrentDelay() ed executeStep() sotto. Se nessuno lo
// salta, il timer scade da solo esattamente come prima: nessun cambiamento di comportamento.
let _bfPendingSleep = null;
function sleep(ms){
  return new Promise(function(r){
    const timer = setTimeout(function () { _bfPendingSleep = null; r(); }, ms);
    _bfPendingSleep = { resolve: r, timer: timer };
  });
}
// Fa scadere IMMEDIATAMENTE il delay in corso, se presente. Usata SOLO per "velocizzare" una
// run gia' attiva (mai per avviarne una seconda in parallelo): il loop di executeFlow resta
// l'UNICO a gestire currentNode/prevNode/_runtimeVars, qui si tocca solo il timer del suo sleep.
function _bfSkipCurrentDelay(){
  if (!_bfPendingSleep) return;
  const p = _bfPendingSleep;
  _bfPendingSleep = null;
  clearTimeout(p.timer);
  p.resolve();
}
// FIX #12 (Ismail 2026-07-08): oltre al nodo, evidenzia anche l'ARCO percorso.
// R12-F (Ismail 2026-07-12): execEdgeFrom sostituito da executingEdge (state.js) -- vedi
// highlightExecNode/highlightExecEdge poco sotto per il nuovo modello a due fasi.
// C7 (round 11): flow.variables contiene SOLO i valori INIZIALI (fonte di verita', quella
// che si salva su file). L'esecuzione lavora SEMPRE su una COPIA runtime (_runtimeVars),
// creata all'inizio di ogni nuova esecuzione (executeFlow/executeStep, ramo currentNode ==
// null) e riusata passo-passo finche' l'esecuzione e' in corso/in pausa. Azzerata (null) a
// esecuzione FERMA (fine run, Stop, Reset): la tabella Variabili torna quindi a mostrare
// flow.variables (vedi renderWatch/restoreVariablesTable) finche' non riparte un nuovo run.
let _runtimeVars = null;
// MIGLIORIA #41 (Ismail 2026-07-08): "watch" delle variabili in tempo reale durante
// l'esecuzione. flow.variables e' mutato live dall'esecutore, quindi basta leggerlo.
function renderWatch(active) {
  const box = document.getElementById('console-watch');
  if (!box || typeof box.setAttribute !== 'function') return; // ambiente senza DOM reale (test)
  // C7 (round 11): durante l'esecuzione mostra la copia RUNTIME (_runtimeVars); a run fermo
  // (chiamate residue con active=false, o _runtimeVars non ancora creata) il fallback e' sui
  // valori INIZIALI (flow.variables) -- solo per non rompere chi chiamasse renderWatch a freddo.
  const _watchVars = (typeof _runtimeVars !== 'undefined' && _runtimeVars) ? _runtimeVars : (typeof flow !== 'undefined' && flow ? flow.variables : null);
  if (!active || typeof flow === 'undefined' || !_watchVars || !_watchVars.length) {
    box.setAttribute('hidden', ''); box.innerHTML = ''; return;
  }
  box.removeAttribute('hidden');
  // AUDIT 2026-07-19 (falla #1, XSS da file ostile): v.name finiva in innerHTML SENZA
  // escaping (e v.value con un escaping parziale, solo '<'). validateFlow valida la
  // struttura dei NODI ma non il contenuto di variables[]: un .json/.bflow ostile con
  // name = '<img src=x onerror=...>' eseguiva script alla prima esecuzione (il watch
  // renderizza i nomi). Ora nome E valore passano da _bfEscapeHtml (tutti i 5 caratteri).
  const _bfEscapeHtml = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
    });
  };
  let html = '<div class="watch-title">' + ((typeof i18nText === 'function' && i18nText('watch_title')) || 'Variabili') + '</div>';
  html += _watchVars.map(function (v) {
    const val = (v && v.value !== undefined && v.value !== null && v.value !== '') ? String(v.value) : '—';
    return '<div class="watch-row"><span class="watch-name">' + _bfEscapeHtml((v && v.name) || '?') + '</span>=<span class="watch-val">' + _bfEscapeHtml(val) + '</span></div>';
  }).join('');
  box.innerHTML = html;
}
// R12-F (Ismail 2026-07-12): evidenziazione SEQUENZIALE (start -> freccia -> blocco -> ... ->
// end), un elemento alla volta. Il vecchio highlightExec(idx) evidenziava SEMPRE la coppia
// nodo+arco insieme (arco = passo precedente); ora le due fasi sono funzioni separate che si
// azzerano a vicenda (mai executingNodeIndex>=0 ed executingEdge non-null insieme):
// - highlightExecNode(idx): fase-NODO, SOLO il blocco idx (idx<0 = nessuna evidenziazione:
//   usata per pulire tutto a fine run/Stop/Reset, esattamente come il vecchio highlightExec(-1)).
// - highlightExecEdge(from,to): fase-ARCO, SOLO la freccia from->to (from/to<0 = nessun arco).
function highlightExecNode(idx){
  executingNodeIndex = idx;
  executingEdge = null; // le due fasi non sono mai attive insieme
  renderWatch(idx >= 0); // aggiorna/mostra il watch durante l'esecuzione, lo nasconde a fine run
  if (typeof draw === "function" && typeof nodi !== "undefined") draw(nodi);
}
// P (round 15, Ismail): ramo effettivamente preso dall'ULTIMO nodo di diramazione eseguito
// ('true'/'false'/null). Serve al disegno dell'highlight per accendere SOLO il ramo giusto
// quando due archi condividono gli stessi estremi (es. if a rami entrambi vuoti che vanno
// allo stesso punto: prima si accendevano ENTRAMBI + il back-edge del ciclo = "illumina tutto").
var _execBranch = null;
// P5.6 (round 15, Ismail 2026-07-14): `phase` opzionale ('out'|'back'|null) per animare in DUE
// tempi le transizioni che rientrano in un header di ciclo (back-edge) -- prima l'arco in USCITA
// dal nodo, poi il RITORNO all'header, MAI insieme (vedi animateExecEdge e il filtro in rendering).
function highlightExecEdge(from, to, phase){
  executingEdge = (typeof from === "number" && typeof to === "number" && from >= 0 && to >= 0) ? { from: from, to: to, branch: _execBranch, phase: phase || null } : null;
  executingNodeIndex = -1; // le due fasi non sono mai attive insieme
  // Niente renderWatch qui: la fase-arco e' puramente visiva, le variabili cambiano
  // all'esecuzione del nodo (refreshVariablesWatch), non durante la freccia (vedi trappola piano).
  if (typeof draw === "function" && typeof nodi !== "undefined") draw(nodi);
}
// P6 (round 15, Strategia A): evidenzia la transizione from->to come POLILINEA visiva esatta,
// UN ARCO (gruppo) alla volta seguendo il flusso. computeEdgeGroups (rendering.js) restituisce i
// gruppi ordinati (arco d'uscita di F, poi il back-edge CONDIVISO dell'header quando si rientra in
// un ciclo -- incluso a QUALUNQUE profondita' di annidamento, indipendentemente dall'indice a cui
// il layout ha attribuito quel back-edge). Ogni gruppo si accende intero (un blocco->while e' un
// solo gesto, niente verticale|orizzontale); gruppi diversi si accendono in sequenza (uscita del
// while, poi back-edge del for esterno). Fallback al vecchio highlightExecEdge se i gruppi mancano.
async function animateExecEdge(from, to, dt, cameFrom){
  let groups = null;
  // La risalita del do-while si mostra solo sui RITORNI (condizione valutata), non alla prima entrata.
  // `cameFrom` = nodo PRIMA di `from`, passato dal chiamante (il prevNode globale qui e' gia' aggiornato).
  const _showRis = !(typeof _isFirstVisitDo === 'function' && _isFirstVisitDo(from, cameFrom));
  try { groups = (typeof computeEdgeGroups === 'function') ? computeEdgeGroups(from, to, _execBranch, _showRis) : null; } catch (e) { groups = null; }
  if (!groups || !groups.length) { highlightExecEdge(from, to); await sleep(dt); return; }
  const per = Math.max(60, Math.round(dt));
  // WP-E2 (Ismail 2026-07-17, "insieme all'arco true/false si deve accendere e spegnere"): in una
  // transizione FORWARD attraverso un IF (ramo -> join, oppure IF -> join a ramo VUOTO) l'arco del
  // ramo (if_true/if_false/normal) e la sua DISCESA di ricongiunzione (if_join/reconnect) sono UN
  // SOLO gesto visivo: vanno accesi e spenti INSIEME, non uno dopo l'altro. Si fondono quindi tutti
  // i gruppi della transizione in un unico frame acceso. ESCLUSI (restano "un arco alla volta", come
  // richiesto da Ismail): i back-edge dei cicli (RITORNO all'header, from > to) e le transizioni di
  // un do-while (nodo `do` come sorgente o destinazione: la sua risalita/discesa/esagono restano
  // separate, DW-1). Per una transizione FORWARD non-do con piu' gruppi (cioe' proprio il caso
  // ramo->join dell'if, anche annidato) si accende tutto insieme.
  var _fromNodeE2 = (typeof flow !== "undefined" && flow.nodes) ? flow.nodes[from] : null;
  var _toNodeE2   = (typeof flow !== "undefined" && flow.nodes) ? flow.nodes[to]   : null;
  var _mergeIfFwd = (from <= to)
    && !(_fromNodeE2 && _fromNodeE2.type === 'do')
    && !(_toNodeE2 && _toNodeE2.type === 'do');
  if (_mergeIfFwd && groups.length > 1) {
    if (typeof pauseRequested !== "undefined" && pauseRequested) return;
    var _allSegs = [];
    for (var _gk = 0; _gk < groups.length; _gk++) _allSegs = _allSegs.concat(groups[_gk].segs);
    // gi:'all' -> refreshExecEdgeGeometry (rendering.js, WP-N1) ricalcola concatenando TUTTI i gruppi.
    executingEdge = { from: from, to: to, branch: _execBranch, litGroup: _allSegs, _grp: { from: from, to: to, branch: _execBranch, showRis: _showRis, gi: 'all' } };
    executingNodeIndex = -1;
    if (typeof draw === "function" && typeof nodi !== "undefined") draw(nodi);
    if (typeof stopRequested !== "undefined" && stopRequested) return;
    await sleep(per);
    return;
  }
  // FIX (Ismail 2026-07-14): NIENTE esagono in mezzo qui. L'esagono del do-while si accende UNA
  // volta come fase-NODO (dal loop d'esecuzione), non fra i gruppi dell'arco: inserirlo qui dava
  // "blocco, laterale, blocco, verticale" (esagono fra risalita e discesa). I gruppi dell'arco
  // (per il do-while: risalita poi discesa, DW-1) si accendono uno alla volta, senza nodo in mezzo.
  for (let gi = 0; gi < groups.length; gi++) {
    // WP-N3 (round 15-C coda, Ismail 2026-07-17): controllo IN CIMA al giro, PRIMA di accendere
    // il prossimo gruppo -- se la pausa arriva mentre questo arco ha PIU' di un gruppo (es. un
    // back-edge: uscita + rientro), requestPause() fa scadere subito il sonno del gruppo
    // corrente (_bfSkipCurrentDelay) e si rientra qui: senza questo controllo si accenderebbe
    // comunque UN gruppo in piu' (un segmento oltre il punto esatto in cui e' stata premuta
    // pausa) prima di fermarsi. Con questo, resta acceso l'ULTIMO gruppo gia' disegnato -- il
    // "posto esatto" richiesto. Il chiamante (executeFlow) vede pauseRequested al ritorno.
    if (typeof pauseRequested !== "undefined" && pauseRequested) return;
    // WP-N1 (Ismail 2026-07-15): oltre ai segmenti (coordinate ASSOLUTE congelate), salva l'IDENTITA'
    // logica del gruppo acceso (from/to/branch/showRis/indice-gruppo). Cosi' al redraw dopo un cambio
    // di layout (resize finestra, zoom, ricentraggio) refreshExecEdgeGeometry() (rendering.js) ricalcola
    // litGroup dai frecce CORRENTI -> l'highlight SEGUE l'arco invece di restare nel punto vecchio.
    // Vale anche in PAUSA (quando l'animazione non gira, e' il caso principale del bug).
    executingEdge = { from: from, to: to, branch: _execBranch, litGroup: groups[gi].segs, _grp: { from: from, to: to, branch: _execBranch, showRis: _showRis, gi: gi } };
    executingNodeIndex = -1;
    if (typeof draw === "function" && typeof nodi !== "undefined") draw(nodi);
    if (typeof stopRequested !== "undefined" && stopRequested) return;
    await sleep(per);
  }
}

// --- Visual debugger: pannello Variabili "live" durante Step/Run ---
// Aggiorna i valori mostrati nella tabella Variabili con lo stato corrente
// (flow.variables), ed evidenzia brevemente la riga della variabile appena
// toccata da questo nodo (input/assign/for). Non tocca l'input se l'utente ci
// sta scrivendo dentro (document.activeElement), per non interrompere l'editing.
function touchedVarName(node) {
  if (!node) return null;
  // WP-M2 (Ismail 2026-07-20, tipo Array): "a[i]" evidenzia la riga della variabile BASE "a"
  // (l'eventuale [indice] si scarta: la tabella ha una riga per variabile, non per elemento).
  const _base = function (s) { const m = String(s || '').trim().match(/^([A-Za-z_]\w*)\s*\[/); return m ? m[1] : String(s || '').trim(); };
  if (node.type === 'input') return _base(node.info);
  if (node.type === 'assign') {
    const parts = (node.info || '').split('=');
    return parts.length === 2 ? _base(parts[0]) : null;
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
    const row = _bfVarRowAt(i); // WP-M5o: indice LOGICO (salta le righe di errore)
    if (!row || !row.cells || !row.cells[2]) continue;
    // R12-A0 HOTFIX (Ismail 2026-07-11, causa verificata da Fable): dal 2026-07-08 il PRIMO
    // <input> della cella valore e' la checkbox .assign-check (C5/C7), non piu' il campo
    // valore -- querySelector('input') da solo becca la checkbox e il valore runtime finiva
    // scritto (invisibile) su checkbox.value. Stesso pattern gia' corretto usato altrove
    // (variables.js aggiungiVaribile): preferisci .value-input (senza vincolo di tag).
    // Ismail 2026-07-20: il campo valore di una riga bool e' ora una <select> (vedi
    // _bfSyncValueControl in variables.js), non piu' sempre un <input> -- "input.value-input"
    // non la troverebbe MAI, ricadendo di nuovo sulla checkbox (stesso bug di prima, versione
    // bool). ".value-input" da solo copre input E select.
    const valueInput = row.cells[2].querySelector ? (row.cells[2].querySelector('.value-input') || row.cells[2].querySelector('input')) : null;
    if (!valueInput) continue;
    if (typeof document !== 'undefined' && document.activeElement === valueInput) continue; // non interrompere l'editing manuale
    // WP-M3 (Ismail 2026-07-20): per gli ARRAY il campo della riga resta la DICHIARAZIONE
    // (valore uniforme iniziale) e NON viene sovrascritto -- i valori RUNTIME di OGNI CELLA
    // vanno nella griglia espandibile (indice -> valore), aggiornata cella per cella qui.
    if (Array.isArray(variables[i].value)) {
      if (typeof _bfRenderArrayCells === 'function') _bfRenderArrayCells(row, variables[i].value, true, false);
      if (valueInput.classList) valueInput.classList.add('live-value');
      if (touchedName && variables[i].name === touchedName && row.classList) {
        row.classList.add('var-updated');
        setTimeout(function () { row.classList.remove('var-updated'); }, 450);
      }
      continue;
    }
    valueInput.value = variables[i].value;
    // R13-L (Ismail 2026-07-12): tooltip nativo sempre sincronizzato col valore corrente --
    // qui il valore e' quello RUNTIME, aggiornato a ogni giro di esecuzione.
    if (typeof _varSyncValueTitle === 'function') _varSyncValueTitle(valueInput); else valueInput.title = valueInput.value;
    // R12-A0: il campo e' spesso disabled (checkbox Assegna non spuntata) -- durante
    // l'esecuzione il valore RUNTIME deve restare leggibile anche disabled (vedi style.css
    // .value-input.live-value:disabled, contrasto migliore del disabled "a riposo").
    if (valueInput.classList) valueInput.classList.add('live-value');
    if (touchedName && variables[i].name === touchedName && row.classList) {
      row.classList.add('var-updated');
      setTimeout(function () { row.classList.remove('var-updated'); }, 450);
    }
  }
}
// C7 (round 11): riporta la tabella Variabili ai valori INIZIALI (flow.variables) quando
// l'esecuzione e' FERMA (fine run naturale, Stop, Reset) -- stessa meccanica di
// refreshVariablesWatch ma la sorgente sono i valori iniziali, e SENZA la classe
// 'var-updated' (qui non stiamo segnalando una variabile appena toccata da un run, stiamo
// riportando la tabella allo stato "a riposo": nessun lampeggio).
// WP-M5n (Ismail 2026-07-21, "anche quando cambi il valore di un blocco o una qualsiasi cosa
// deve cambiare, o se aggiungi una variabile o elimini"): da WP-M5m i valori finali di una run
// RESTANO a schermo, quindi serve un punto unico che li dichiari superati. Qualunque modifica
// al programma li rende, appunto, il risultato di un programma che non esiste piu': la tabella
// torna alle dichiarazioni.
// Le modifiche ai BLOCCHI (contenuto, spostamento, inserimento, cancellazione, incolla) passano
// tutte da pushHistory, che gia' chiama questa funzione. Le modifiche alle VARIABILI no --
// variables.js non ha mai usato pushHistory -- e infatti aggiungere o eliminare una variabile
// lasciava a schermo i risultati della run precedente: da qui la segnalazione.
function _bfInvalidateRunResults() {
  if (typeof restoreVariablesTable === 'function') restoreVariablesTable();
  // WP-M6b (Ismail 2026-07-21, "anche il reset della tartaruga deve essere coerente con le
  // variabili, azzerandosi per le stesse motivazioni"): il disegno della tartaruga E' un
  // risultato dell'esecuzione esattamente come i valori delle variabili, quindi deve seguire
  // le stesse regole -- resta a schermo a fine run naturale, sparisce quando quel risultato
  // non vale piu': Stop, Reset, errore, o qualunque modifica al programma.
  // Prima si azzerava solo all'AVVIO di una nuova esecuzione: dopo aver fermato o modificato
  // tutto restava li', e sul canvas si vedeva il disegno di un programma che non esisteva piu'.
  if (typeof resetTurtle === 'function') { try { resetTurtle(); } catch (e) {} }
}
// WP-M5o (Ismail 2026-07-21, "il valore di tutte le variabili deve tornare al valore
// assegnato all'inizio, attualmente non fa così in TUTTI i casi"): sia il ripristino sia
// l'aggiornamento live prendevano la riga con `tabVariabili.rows[i + 1]`, cioe' davano per
// scontato che la riga i-esima della tabella corrisponda alla variabile i-esima. Non e' vero
// quando c'e' una riga di ERRORE: e' un <tr> a tutti gli effetti e sposta di uno tutte le
// righe sotto. Da li' in giu' i valori venivano scritti nella riga SBAGLIATA, e la variabile
// in coda non veniva ripristinata affatto (indice oltre la fine). E' lo stesso difetto gia'
// corretto in WP-M4t per aggiungiVaribile: la posizione fisica nel DOM non e' l'indice logico.
function _bfVarRowAt(i) {
  if (typeof tabVariabili === 'undefined' || !tabVariabili || !tabVariabili.rows) return null;
  let k = -1;
  for (let r = 1; r < tabVariabili.rows.length; r++) { // riga 0 = header
    const row = tabVariabili.rows[r];
    if (row && row.classList && row.classList.contains('error-message-row')) continue;
    k++;
    if (k === i) return row;
  }
  return null;
}
if (typeof window !== 'undefined') window._bfInvalidateRunResults = _bfInvalidateRunResults;
function restoreVariablesTable() {
  if (typeof flow === 'undefined' || !flow || !Array.isArray(flow.variables)) return;
  if (typeof tabVariabili === 'undefined' || !tabVariabili || !tabVariabili.rows) return;
  for (let i = 0; i < flow.variables.length; i++) {
    const row = _bfVarRowAt(i); // WP-M5o: indice LOGICO (salta le righe di errore)
    if (!row || !row.cells || !row.cells[2]) continue;
    // R12-A0: stesso hotfix di selettore di refreshVariablesWatch qui sopra (vedi commento li'),
    // incluso il caso bool (2026-07-20): ".value-input" senza vincolo di tag copre input E select.
    const valueInput = row.cells[2].querySelector ? (row.cells[2].querySelector('.value-input') || row.cells[2].querySelector('input')) : null;
    if (!valueInput) continue;
    if (typeof document !== 'undefined' && document.activeElement === valueInput) continue; // non interrompere l'editing manuale
    // WP-M3: array -- ripristina la griglia celle ai valori INIZIALI e spegni la modalita' live.
    if (Array.isArray(flow.variables[i].value)) {
      if (typeof _bfRenderArrayCells === 'function') _bfRenderArrayCells(row, flow.variables[i].value, false, !!flow.variables[i].uninit);
      if (valueInput.classList) valueInput.classList.remove('live-value');
      continue;
    }
    // P2.5 (round 15-B S2, Ismail 2026-07-15): una variabile DICHIARATA senza valore (checkbox
    // "Assegna" non spuntata al momento della dichiarazione -- aggiungiVaribile in variables.js
    // marca l'oggetto con `uninit: true` e usa 0/"" come placeholder INTERNO solo per
    // l'esecuzione) torna VUOTA allo Stop, non al placeholder. Una variabile con un valore
    // iniziale ESPLICITO (anche 0) mostra quel valore, invariato.
    // WP-M5g: il campo torna a mostrare la DICHIARAZIONE come l'utente l'ha scritta --
    // il riferimento (`b`) o la stringa CON le virgolette. Scrivendoci il valore risolto si
    // perderebbe il riferimento, e una stringa tornerebbe senza virgolette: cioe' in una
    // forma che la validazione (giustamente) rifiuterebbe al successivo cambio di riga.
    valueInput.value = flow.variables[i].uninit ? '' : _bfDeclDisplay(flow.variables[i]);
    // R13-L (Ismail 2026-07-12): tooltip nativo sincronizzato anche qui -- run finita/
    // fermata, il campo torna a mostrare (e a "spiegare" via hover) il valore di progetto.
    if (typeof _varSyncValueTitle === 'function') _varSyncValueTitle(valueInput); else valueInput.title = valueInput.value;
    // R12-A0: run finita/fermata -> la tabella torna "a riposo", niente piu' evidenza live.
    if (valueInput.classList) valueInput.classList.remove('live-value');
  }
}
function run(){
    const c = document.getElementById('console-popup');
    // FIX (Ismail 2026-07-10): riaprendo il terminale da chiuso (dalla barra/linguetta),
    // deve sempre ripartire agganciato (fisso) -- non restare nell'ultima modalita'
    // mobile/flottante in cui era stato lasciato. Si azzerano anche eventuali stili
    // inline (posizione/dimensione) lasciati da un resize/trascinamento precedente, cosi'
    // riparte pulito con il layout CSS di default della modalita' agganciata.
    const wasActive = c.classList.contains('active');
    if (!wasActive) {
        c.classList.add('docked');
        const _mt = document.getElementById('console-mobile-toggle'); if (_mt) _mt.classList.remove('is-mobile');
        c.style.left = ''; c.style.top = ''; c.style.transform = ''; c.style.margin = '';
        c.style.width = ''; c.style.height = ''; c.style.maxWidth = ''; c.style.maxHeight = '';
        c.style.removeProperty('--console-scale');
    }
    c.classList.add('active');
    // FIX #38 (Ismail 2026-07-08): la console (anche sganciata) NON e' modale: e' uno
    // strumento flottante/trascinabile. Niente overlay, cosi' il grafo resta scorrevole e
    // interagibile con il terminale mobile aperto.
    const _ov = document.getElementById('overlay'); if (_ov) _ov.classList.remove('active');
    // R14-E (Ismail 2026-07-13): passa dal tick condiviso _bfSidebarLiveResizeTick() (init.js)
    // invece di chiamare updateZoomOffset()/centerGraph() direttamente -- garantisce l'ordine
    // corretto (syncLayoutVars -> updateZoomOffset -> centerGraph, la console dipende da
    // --sidebar-width per il suo tetto max-width) ed e' lo stesso punto di ricalcolo usato da
    // ogni altro trigger (drag sidebar/console, resize, zoom, cambio lingua). Ricentra subito
    // e di nuovo a fine transizione (larghezza console/griglia definitiva).
    if (typeof _bfSidebarLiveResizeTick === 'function') { _bfSidebarLiveResizeTick(); setTimeout(_bfSidebarLiveResizeTick, 240); }
    else { updateZoomOffset(); if (typeof centerGraph === 'function') { centerGraph(); setTimeout(centerGraph, 240); } }
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

// FIX (Ismail 2026-07-10): in modalita' agganciata, cliccare tutta la barra "Console"
// la chiude/nasconde (comportamento voluto, specchia il pannello Variabili). In modalita'
// MOBILE (flottante) pero' la barra si trascina per spostare la finestra: se l'intera barra
// chiudeva al click, un trascinamento breve/senza movimento faceva sparire il terminale per
// sbaglio. Da flottante quindi la barra NON chiude piu' -- solo la X dedicata lo fa.
function onConsoleTitlebarClick(e) {
    const c = document.getElementById('console-popup');
    if (c && c.classList.contains('docked')) closeConsole();
}
function closeConsole() {
    document.getElementById('console-popup').classList.remove('active');
    document.getElementById('overlay').classList.remove('active');
    // R14-E (Ismail 2026-07-13): stesso tick condiviso di run() sopra -- vedi commento li'.
    if (typeof _bfSidebarLiveResizeTick === 'function') { _bfSidebarLiveResizeTick(); setTimeout(_bfSidebarLiveResizeTick, 240); }
    else { updateZoomOffset(); if (typeof centerGraph === 'function') { centerGraph(); setTimeout(centerGraph, 240); } }
}

// Aggancia la console come pannello laterale destro o la sgancia come popup centrale.
function toggleConsoleDock() {
    const c = document.getElementById('console-popup');
    const docked = c.classList.toggle('docked');
    const active = c.classList.contains('active');
    { const _ov = document.getElementById('overlay'); if (_ov) _ov.classList.remove('active'); } // console non modale (#38)
    // Stato del toggle "Terminale mobile": attivo quando la console e' sganciata (floating).
    { const _mt = document.getElementById('console-mobile-toggle'); if (_mt) _mt.classList.toggle('is-mobile', !docked); }
    // FIX #28 (Ismail 2026-07-08) + FIX (2026-07-10): al cambio modalita' azzera TUTTI gli
    // stili inline lasciati da drag/resize del popup (posizione E dimensione), cosi'
    // ciascuna modalita' riparte dal suo layout CSS pulito invece di ereditare larghezza/
    // altezza dell'altra modalita' (altrimenti passando da fisso a mobile il popup restava
    // "incastrato" con le dimensioni del pannello agganciato invece della sua forma normale).
    c.style.left = ''; c.style.top = ''; c.style.transform = ''; c.style.margin = '';
    c.style.width = ''; c.style.height = ''; c.style.maxWidth = ''; c.style.maxHeight = '';
    c.style.removeProperty('--console-scale');
    // R14-E (Ismail 2026-07-13): stesso tick condiviso di run()/closeConsole() sopra.
    if (typeof _bfSidebarLiveResizeTick === 'function') { _bfSidebarLiveResizeTick(); setTimeout(_bfSidebarLiveResizeTick, 240); }
    else { updateZoomOffset(); if (typeof centerGraph === 'function') { centerGraph(); setTimeout(centerGraph, 240); } }
}

// Segue il resize della console per tenere i controlli zoom a sinistra di essa.
(function(){
    try {
        const c = document.getElementById('console-popup');
        if (c && typeof ResizeObserver !== 'undefined') {
            // R14-E (Ismail 2026-07-13): stesso tick condiviso (rAF-throttled: qui e' importante,
            // il ResizeObserver puo' sparare piu' volte per singolo cambio di layout).
            new ResizeObserver(function(){
                if (typeof _bfSidebarLiveResizeTick === 'function') _bfSidebarLiveResizeTick();
                else { updateZoomOffset(); if (typeof centerGraph === 'function') centerGraph(); }
            }).observe(c);
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
        // WP-6 (round 15 gravi, P6.3+P13.1, 2026-07-19): eventi mouse -> Pointer Events.
        // Con mousedown/mousemove la maniglia NON funzionava affatto su touch (mobile,
        // R13-I: e' la causa concreta anche del caso "resize mobile in RTL" -- non una
        // geometria sbagliata, proprio nessun evento durante il gesto). touch-action:none
        // sull'handle (style.css) tiene il gesto sul documento invece dello scroll.
        // bf-live-drag sul body: spegne le transizioni CSS (grid #main, #zoom-controls,
        // #terminal-reopen) mentre si trascina, cosi' centerGraph misura larghezze VERE
        // ad ogni frame e la vista segue la maniglia senza assestamento ritardato (P13.1).
        handle.addEventListener('pointerdown', function(e){
            if (!consoleEl.classList.contains('docked')) return; // solo da agganciata
            if (e.isPrimary === false) return;
            resizing = true;
            handle.classList.add('active-resize');
            if (document.body && document.body.classList) document.body.classList.add('bf-live-drag');
            e.preventDefault();
        });
        window.addEventListener('pointermove', function(e){
            if (!resizing) return;
            const maxW = window.innerWidth * 0.92;
            // FIX #33 (Ismail 2026-07-08): in RTL il pannello e' a SINISTRA, quindi la
            // larghezza si misura dal bordo sinistro (e.clientX), non dal destro.
            const _rtl = (typeof document !== 'undefined') && document.documentElement.getAttribute('dir') === 'rtl';
            let newWidth = _rtl ? e.clientX : (window.innerWidth - e.clientX);
            if (newWidth < MIN_W) newWidth = MIN_W;
            if (newWidth > maxW) newWidth = maxW;
            consoleEl.style.width = newWidth + 'px';
            // R13-C (Ismail 2026-07-12): prima chiamava updateZoomOffset()+centerGraph()
            // DIRETTAMENTE a ogni mousemove -- niente throttling, niente syncLayoutVars()
            // (che aggiorna --sidebar-width, da cui dipende il TETTO max-width della console
            // agganciata: style.css ~1254). Diverso dalla maniglia della sidebar Variabili
            // (init.js), che gia' passa dal tick condiviso rAF _bfSidebarLiveResizeTick()
            // (round 11 C6) -- qui il resize della console restava un percorso PARALLELO e
            // non unificato: da cui il riassestamento "in ritardo" (si vedeva giusto solo
            // dopo che qualche altro trigger, es. il ResizeObserver sotto, richiamava le
            // stesse funzioni in un frame successivo). Riusa lo STESSO tick, stesso ordine
            // garantito (syncLayoutVars -> updateZoomOffset -> centerGraph), un solo giro
            // per frame anche con mousemove ad alta frequenza.
            if (typeof _bfSidebarLiveResizeTick === 'function') { _bfSidebarLiveResizeTick(); }
            else { updateZoomOffset(); if (typeof centerGraph === 'function') centerGraph(); }
        });
        // WP-6: pointerup + pointercancel (gesto touch interrotto dal sistema): senza il
        // secondo, bf-live-drag restava attivo e le transizioni spente per sempre.
        const _bfConsEndResize = function(){
            if (!resizing) return;
            resizing = false;
            handle.classList.remove('active-resize');
            if (document.body && document.body.classList) document.body.classList.remove('bf-live-drag');
            // assetto finale su valori veri (transizioni appena riattivate: nessun salto,
            // la larghezza non cambia piu' -- e' solo una rimisura di sicurezza).
            if (typeof _bfSidebarLiveResizeTick === 'function') { _bfSidebarLiveResizeTick(); setTimeout(_bfSidebarLiveResizeTick, 240); }
        };
        window.addEventListener('pointerup', _bfConsEndResize);
        window.addEventListener('pointercancel', _bfConsEndResize);
    } catch(_) {}
})();

// Ridimensionamento a 8 maniglie del terminale MOBILE (flottante, sganciato): stesso
// meccanismo del pannello tartaruga (_tgSetupDragResize in draw.js) -- maniglie .tg-rz
// su tutti i lati/angoli, ridimensiona ORIZZONTALMENTE e VERTICALMENTE. Attivo solo
// quando la console NON e' agganciata (li' c'e' gia' la maniglia laterale dedicata).
(function () {
    try {
        const el = document.getElementById('console-popup');
        if (!el) return;
        let rz = false, rdir = '', rx = 0, ry = 0, rw = 0, rh = 0, rl = 0, rt = 0;
        const MIN_W = 320, MIN_H = 220, MAX_W = 1100, MAX_H = 1100;
        const handles = el.querySelectorAll('.tg-rz');
        // WP-6/R13-I (2026-07-19): mouse -> Pointer Events, cosi' le 8 maniglie funzionano
        // anche a dito su mobile (prima: nessun mousemove continuo su touch = resize morto).
        for (let i = 0; i < handles.length; i++) {
            handles[i].addEventListener('pointerdown', function (e) {
                if (el.classList.contains('docked')) return; // solo da flottante
                if (e.isPrimary === false) return;
                const r = el.getBoundingClientRect();
                rz = true; rdir = this.getAttribute('data-dir') || 'se';
                rx = e.clientX; ry = e.clientY; rw = r.width; rh = r.height; rl = r.left; rt = r.top;
                el.style.left = rl + 'px'; el.style.top = rt + 'px';
                el.style.transform = 'none'; el.style.margin = '0';
                // NB: niente piu' maxWidth/maxHeight:'none' qui -- il tetto CSS (max-width/
                // max-height su #console-popup:not(.docked)) deve restare attivo, cosi' la
                // finestra non cresce oltre un limite reale (richiesta Ismail 2026-07-10).
                if (document.body && document.body.style) document.body.style.userSelect = 'none';
                e.preventDefault(); e.stopPropagation();
            });
        }
        window.addEventListener('pointermove', function (e) {
            if (!rz) return;
            const ddx = e.clientX - rx, ddy = e.clientY - ry;
            let nw = rw, nh = rh, nl = rl, nt = rt;
            if (rdir.indexOf('e') !== -1) nw = rw + ddx;
            if (rdir.indexOf('w') !== -1) { nw = rw - ddx; nl = rl + ddx; }
            if (rdir.indexOf('s') !== -1) nh = rh + ddy;
            if (rdir.indexOf('n') !== -1) { nh = rh - ddy; nt = rt + ddy; }
            // WP-6/mobile (2026-07-19): min/max STATICI clampati alla viewport reale --
            // su un telefono stretto MIN_W=320 poteva superare lo schermo (finestra
            // incastrata piu' larga della viewport, impossibile da restringere) e
            // MAX_W/MAX_H fissi non hanno senso sotto i 1100px di schermo.
            const _vw = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1100;
            const _vh = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 1100;
            const _minW = Math.min(MIN_W, Math.floor(_vw * 0.9)), _maxW = Math.min(MAX_W, Math.floor(_vw * 0.96));
            const _minH = Math.min(MIN_H, Math.floor(_vh * 0.8)), _maxH = Math.min(MAX_H, Math.floor(_vh * 0.92));
            nw = Math.max(_minW, Math.min(_maxW, nw)); nh = Math.max(_minH, Math.min(_maxH, nh));
            if (rdir.indexOf('w') !== -1) nl = rl + (rw - nw);
            if (rdir.indexOf('n') !== -1) nt = rt + (rh - nh);
            el.style.width = nw + 'px'; el.style.height = nh + 'px';
            el.style.left = nl + 'px'; el.style.top = nt + 'px';
            // FIX (Ismail 2026-07-10): scritta "Console" e pulsanti (badge/zoom/mobile-toggle)
            // si ingrandiscono/rimpiccioliscono col ridimensionamento, non restano fissi --
            // stessa idea gia' usata per il titolo della tartaruga che segue lo zoom.
            // Attenuato (Ismail 2026-07-10): la crescita 1:1 con la larghezza era eccessiva --
            // ora la scala si muove a META' velocita' rispetto al ridimensionamento e resta
            // in un intervallo piu' stretto.
            const rawScale = 1 + (nw / 600 - 1) * 0.4;
            const scale = Math.max(0.85, Math.min(1.3, rawScale));
            el.style.setProperty('--console-scale', scale.toFixed(3));
        });
        const _bfMobRzEnd = function () {
            if (rz) { rz = false; if (document.body && document.body.style) document.body.style.userSelect = ''; }
        };
        window.addEventListener('pointerup', _bfMobRzEnd);
        window.addEventListener('pointercancel', _bfMobRzEnd); // gesto touch interrotto: mai lasciare il resize "appeso"
    } catch (_) {}
})();

// WP-M5d (Ismail 2026-07-21, "nel for se uso una i non inizializzata non dovrebbe dare
// lagne perche' poi viene inizializzata nel ciclo; alla prima esecuzione a volte va ma se
// rieseguo mi da problema inizializzazione"): il contatore lo inizializza il for stesso, e
// infatti la PRIMA esecuzione funziona. Il guasto e' alla SECONDA, e la causa e' il flag
// runtime `_forInitialized` sul nodo: serve a non ri-eseguire l'init a ogni giro del ciclo,
// e veniva azzerato solo da Reset, da Stop e dall'uscita NORMALE del ciclo. Se invece
// l'esecuzione si interrompe per un ERRORE dentro il ciclo (nel flow di Ismail: indice 1000
// su un array di 1000 celle) il flag resta a true. Alla ri-esecuzione le variabili tornano
// ai valori iniziali -- quindi il contatore torna "non inizializzato" -- ma il for SALTA
// l'init perche' si crede gia' inizializzato, e la condizione trova la variabile uninit:
// "variabile non inizializzata". Da qui l'"a volte": dipendeva da come era finito il run
// precedente. La correzione e' rendere le due cose inseparabili: copia runtime fresca e
// stato dei nodi 'for' si azzerano SEMPRE insieme, in un unico punto.
function _bfFreshRuntimeVars() {
  if (typeof flow !== 'undefined' && flow && Array.isArray(flow.nodes)) {
    flow.nodes.forEach(function (n) { if (n) n._forInitialized = false; });
  }
  // WP-M5m: nuova esecuzione -> si dimentica quali pannelli celle l'utente aveva chiuso a
  // mano nella run precedente, cosi' l'apertura automatica torna a valere per tutti.
  try {
    if (typeof document !== 'undefined' && document.querySelectorAll) {
      document.querySelectorAll('#tabVariabili .array-cells').forEach(function (g) { g._bfUserClosed = false; });
    }
  } catch (e) {}
  const vars = JSON.parse(JSON.stringify((typeof flow !== 'undefined' && flow && flow.variables) || []));
  _bfResolveVarRefs(vars);
  return vars;
}
// WP-M5g (Ismail 2026-07-21, "fare in modo che anche nella dichiarazione si possa fare anche
// se la variabile è stata dichiarata dopo"): una dichiarazione puo' valere "il valore di
// un'altra variabile" (campo `ref`, scritto da aggiungiVaribile). Non si puo' risolvere al
// momento della scrittura -- il senso della richiesta e' proprio poter citare una variabile
// che ancora non esiste -- quindi si risolve QUI, all'avvio di ogni esecuzione, quando la
// tabella e' completa. L'ordine di dichiarazione non conta: si itera finche' qualcosa si
// risolve, cosi' anche una catena scritta al contrario (a=b, b=c, c=5) arriva in fondo.
// Un ciclo (a=b, b=a) non si risolve mai: si esce e le variabili coinvolte restano
// NON INIZIALIZZATE, cioe' il primo uso dara' il consueto errore "non inizializzata"
// invece di un valore inventato o di un ciclo infinito.
function _bfResolveVarRefs(vars) {
  if (!Array.isArray(vars)) return;
  const pending = vars.filter(function (v) { return v && v.ref; });
  if (!pending.length) return;
  const byName = {};
  vars.forEach(function (v) { if (v && v.name) byName[v.name] = v; });
  let left = pending.slice();
  let progress = true;
  while (left.length && progress) {
    progress = false;
    left = left.filter(function (v) {
      const src = byName[v.ref];
      if (!src) {                       // variabile citata inesistente
        v.uninit = true; v._refErr = 'missing';
        progress = true; return false;
      }
      if (src.ref && !src._refDone) return true;  // la sorgente e' a sua volta un riferimento non ancora risolto
      if (src.uninit) { v.uninit = true; v._refDone = true; progress = true; return false; }
      v.value = (typeof JSON !== 'undefined') ? JSON.parse(JSON.stringify(src.value)) : src.value;
      v.uninit = false; v._refDone = true;
      progress = true; return false;
    });
  }
  // Rimasti nel giro: fanno parte di un ciclo di riferimenti.
  left.forEach(function (v) { v.uninit = true; v._refErr = 'cycle'; });
}
// WP-M5g: come mostrare una dichiarazione nel campo VALORE della tabella.
function _bfDeclDisplay(v) {
  if (!v) return '';
  if (v.ref) return v.src || v.ref;                     // riferimento: il nome scritto dall'utente
  if (v.type === 'string') return '"' + String(v.value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  if (Array.isArray(v.value)) return _bfFormatValueForDisplay(v.value);
  return v.value;
}
if (typeof window !== 'undefined') { window._bfResolveVarRefs = _bfResolveVarRefs; window._bfDeclDisplay = _bfDeclDisplay; }
function resetFlow() {
    currentNode = "0"; // Reimposta al primo nodo
    prevNode = null; // FIX B2: nessun "nodo precedente" significativo dopo un reset
    stopRequested = false;
    _openInlineP = null; // A4: chiudi un'eventuale riga di stampa rimasta "aperta"
    _runtimeVars = null; // C7 (round 11): nessuna esecuzione in corso -- il prossimo run riparte da una copia fresca
    // Ripulisce lo stato runtime dei nodi "for" (_forInitialized): senza questo, un
    // reset a meta' di un ciclo lascerebbe il flag a true e la prossima esecuzione
    // salterebbe l'inizializzazione, ripartendo dal valore precedente invece che da capo.
    if (typeof flow !== 'undefined' && flow && Array.isArray(flow.nodes)) {
        flow.nodes.forEach(n => { if (n) n._forInitialized = false; });
    }
    _bfInvalidateRunResults(); // WP-M6b: tabella + disegno tartaruga (punto unico)
    highlightExecNode(-1); // R12-F: azzera entrambe le fasi (nodo+arco)
    if (typeof nodi !== 'undefined' && Array.isArray(nodi)) nodi.forEach(function (v) { if (v) v._error = false; });
    if (typeof draw === 'function' && typeof nodi !== 'undefined') draw(nodi);
    const consoleOutput = document.getElementById('console-output');
    // WP-D1 esteso: 'debug' passata ESPLICITAMENTE, altrimenti classifyConsoleMsg() (regex sul
    // testo INGLESE originale) non riconosce piu' il messaggio tradotto e lo mostra sempre.
    _termMsg('flow_reset', {}, 'debug', "Flow resetted. Ready to execute again.");
    const input = document.getElementById('console-input')
    const btn = document.getElementById('console-send')
    input.classList.remove('active');
    if (typeof _setStopEnabled === 'function') _setStopEnabled(false); // FIX #36: dopo Reset il flusso non e' in esecuzione
}

async function executeStep(){
  // P2.6 (round 15-B S2, Ismail 2026-07-15): "Passo" premuto mentre una RUN automatica e' gia'
  // in corso (executeFlow, _bfRunning) NON deve avviare un secondo step indipendente sullo
  // STESSO stato condiviso (currentNode/prevNode/_runtimeVars) -- duplicherebbe/corromperebbe
  // il passo gia' in corso (trappola del piano). Si limita a far scadere SUBITO l'attesa
  // (sleep) attualmente in corso nel loop di executeFlow: la run avanza di uno scatto e
  // PROSEGUE DA SOLA alla velocita' impostata (non e' una pausa) -- "riprende da sola, serve
  // solo a velocizzare" (richiesta esplicita). A run FERMA o IN PAUSA (_bfRunning false) il
  // comportamento sotto resta quello storico, invariato.
  if (typeof _bfRunning !== 'undefined' && _bfRunning) { _bfSkipCurrentDelay(); return; }
  // WP-N10b (Ismail 2026-07-15): se si RIPRENDE da una pausa avvenuta durante la FASE-ARCO
  // (executingEdge acceso: il Run si era fermato sulla freccia PRIMA del blocco, che è già
  // currentNode ma NON ancora eseguito), il primo Passo COMPLETA la freccia -> evidenzia il
  // blocco di destinazione e si ferma lì, SENZA eseguirlo. Il Passo successivo lo esegue
  // normalmente. Senza questo, con N10 (niente animazione dell'arco) il blocco lampeggiava e
  // l'highlight saltava subito al successivo -> sembrava che "il blocco della freccia venisse
  // saltato". Vale solo per la ripresa-da-arco: in Passo normale executingEdge è già null.
  if (typeof executingEdge !== 'undefined' && executingEdge && currentNode != null) {
    _highlightExecNodeSafe(parseInt(currentNode), prevNode); // atterra sul blocco della freccia (azzera executingEdge)
    if (typeof _setStopEnabled === 'function') _setStopEnabled(true);
    return;
  }
  if(currentNode== null){
    currentNode = "0"; // Reimposta al primo nodo se currentNode è nullo
    prevNode = null; // FIX B2: riavvio dall'inizio, nessun predecessore significativo
    _openInlineP = null; // A4: nuova esecuzione, niente riga aperta ereditata dalla precedente
    // C7 (round 11): nuova esecuzione (Step da fermo) -> copia runtime FRESCA dai valori
    // iniziali. Lo step-through riusa POI questa stessa copia passo dopo passo (stato modulo).
    _runtimeVars = _bfFreshRuntimeVars();
  }
  // C7: rete di sicurezza -- currentNode parte gia' a "0" (non null) al primissimo Step della
  // sessione (nessun Reset/Stop precedente), quindi il ramo sopra potrebbe non essere passato:
  // se la copia runtime non esiste ancora, creala ora.
  if (!_runtimeVars) _runtimeVars = _bfFreshRuntimeVars();
  if (typeof _setStopEnabled === 'function') _setStopEnabled(true); // FIX #36: Stop attivo durante lo step-through
  const idxBeforeExec = parseInt(currentNode);
  _highlightExecNodeSafe(idxBeforeExec, prevNode); // evidenzia il blocco (D1: salta l'esagono do-while alla 1a visita)
  const node = flow.nodes[idxBeforeExec];
  const nodeIdxBeforeExec = currentNode; // FIX B2: sara' il "prevNode" del prossimo giro
  const _prevForEdge = prevNode; // FIX (Ismail 2026-07-14): il nodo PRIMA di questo, catturato PRIMA
  // dell'aggiornamento sotto -- serve ad animateExecEdge per decidere la risalita del do-while
  // (prima visita vs ritorno); usare il prevNode globale li' era sbagliato (gia' = nodo corrente).
  currentNode = await executeNode(node,currentNode,_runtimeVars,prevNode);
  prevNode = nodeIdxBeforeExec;
  refreshVariablesWatch(_runtimeVars, touchedVarName(node)); // aggiorna il pannello Variabili "live"
  if (currentNode == null) {
    // WP-M5m: lo step-through e' arrivato alla fine del flusso -- stessa regola di
    // executeFlow: i valori finali RESTANO a schermo, si azzera solo la copia runtime.
    _runtimeVars = null;
    highlightExecNode(-1); // R12-F: fine flusso, nessun arco da mostrare
  } else {
    // WP-N10 (Ismail 2026-07-15, "nella modalita' passo deve saltare la freccia e andare subito
    // al blocco successivo"): in PASSO NON si anima piu' l'arco -- si evidenzia DIRETTAMENTE il
    // blocco successivo. Prima qui `animateExecEdge` mostrava la freccia percorsa per ~300ms.
    // Il Run automatico (executeFlow) MANTIENE la fase-arco a due fasi P5.6: questo cambia SOLO
    // lo Step. `_highlightExecNodeSafe` -> `highlightExecNode` azzera `executingEdge` (=null),
    // quindi nessun arco resta acceso: si vede solo il nodo. (`_prevForEdge` sopra ora non serve
    // piu' qui -- lo usa ancora executeFlow; lasciato per simmetria/minimo diff.)
    const idxAfterExec = parseInt(currentNode);
    _highlightExecNodeSafe(idxAfterExec, idxBeforeExec); // prossimo blocco (D1: salta l'esagono do-while alla 1a visita)
  }
  if (typeof _setStopEnabled === 'function') _setStopEnabled(currentNode != null); // FIX #36: a fine flusso Stop torna disabilitato
}

// Tetto di sicurezza anti-loop-infinito (bug BLOCCANTE trovato dalla review di
// Fable sul piano cicli, verificato empiricamente: un while a corpo vuoto con
// condizione sempre vera — ESATTAMENTE la rappresentazione proposta per un ciclo
// appena creato dalla UI — non terminava mai; con velocita' "Istantanea" (nessun
// sleep) congelava il tab). Senza questo tetto, introdurre i cicli nella UI
// sarebbe stato pericoloso: un utente puo' creare per sbaglio un ciclo che non
// avanza mai. `stopRequested` permette anche un'interruzione manuale (bottone Stop).
const MAX_EXECUTION_STEPS = 50000;
// WP-M5l: cadenze della modalita' Istantanea (vedi il commento nel loop di executeFlow).
// 64 passi fra un respiro e l'altro e' un compromesso misurato: abbastanza raro da non
// rallentare percettibilmente la run (un macrotask costa ~0-4ms), abbastanza frequente da
// tenere la pagina reattiva anche su cicli da decine di migliaia di passi.
const BF_INSTANT_YIELD_EVERY = 64;
const BF_INSTANT_REDRAW_EVERY = 64;
// WP-M5s: in turbo il pannello Variabili si aggiorna una volta ogni tanto (non ad ogni passo).
const BF_TURBO_WATCH_EVERY = 256;
let stopRequested = false;
// Rilievo 20: Pausa (sospende mantenendo l'evidenziazione) e stato "in esecuzione".
let pauseRequested = false;
let _bfRunning = false;
// WP-N11 (round 15-C, Ismail 2026-07-17, "il bottone Esegui deve diventare non cliccabile
// come Pausa quando e' ferma"): #console-exe chiama executeFlow(flow) DIRETTAMENTE dal markup
// (index.html), senza passare da _setRunning -- durante un Run attivo restava sempre
// cliccabile, e executeFlow() non ha una guardia di rientranza: un secondo click avviava un
// SECONDO while-loop sullo stesso stato condiviso (currentNode/prevNode/_runtimeVars),
// corrompendo l'esecuzione in corso. Fix speculare a exec-pause/console-stop qui sopra, ma
// con la logica INVERTITA (disabilitato quando SI corre, non quando si e' fermi): #console-exe
// e' anche il modo per RIPRENDERE da una pausa (executeFlow riparte da currentNode se non e'
// null, vedi inizio della funzione) -- deve quindi restare cliccabile sia da fermo SIA in
// pausa, e disabilitarsi SOLO durante un Run attivo. #console-step NON tocca (gia' protetto
// dalla sua stessa guardia di rientranza, P2.6/S2: _bfSkipCurrentDelay() invece di eseguire).
// Stile/colore: nessuna CSS nuova serve, #toolbar .tb-icon:disabled (style.css) si applica gia'
// a qualunque bottone della toolbar con l'attributo disabled, stessa dissolvenza degli altri.
function _setRunning(on) {
  _bfRunning = !!on;
  // WP-M5s: appena l'esecuzione finisce (o si ferma) si riversa subito tutto cio' che e'
  // rimasto in coda -- senza, le ultime righe (compreso "Fine.") resterebbero invisibili
  // fino al frame successivo, o per sempre se la pagina passa in background.
  if (!_bfRunning && typeof _bfFlushConsoleNow === 'function') _bfFlushConsoleNow();
  const b = document.getElementById('exec-pause'); if (b) b.disabled = !on;
  const s = document.getElementById('console-stop'); if (s) s.disabled = !on;
  const e = document.getElementById('console-exe'); if (e) e.disabled = !!on;
}
function requestPause() {
  if (!_bfRunning) return;
  pauseRequested = true;
  // WP-N3 (round 15-C coda, Ismail 2026-07-17, "quando faccio pausa deve fermarsi
  // immediatamente... ci mette troppo"): senza questa riga la pausa aspettava la scadenza
  // NATURALE del delay/animazione in corso (fino a runSpeed ms per il blocco, o "per" ms per
  // OGNI gruppo/segmento di un arco -- es. un back-edge sono 2 gruppi = 2x) prima di essere
  // vista al primo checkpoint utile in executeFlow/animateExecEdge. Stesso meccanismo gia'
  // usato da P2.6/S2 per "Passo durante Run" (_bfSkipCurrentDelay, sopra): fa scadere SUBITO
  // il timer attualmente pendente, cosi' il prossimo checkpoint (subito dopo l'await) vede
  // pauseRequested senza aspettare il resto dei ms.
  if (typeof _bfSkipCurrentDelay === 'function') _bfSkipCurrentDelay();
}
function _setStopEnabled(on) { const s = document.getElementById('console-stop'); if (s) s.disabled = !on; }
// Stop = interruzione COMPLETA + azzeramento: la prossima esecuzione riparte da Start.
// Durante il Run automatico segnala solo la richiesta (il while-loop la gestisce); in modalita'
// Step (nessun run automatico in corso) agisce SUBITO: azzera lo stato, toglie l'evidenziazione
// e si disabilita (la prossima esecuzione riparte da Start). FIX #36.
function requestStop() {
  stopRequested = true;
  if (!_bfRunning) {
    stopRequested = false;
    currentNode = null; prevNode = null;
    if (typeof flow !== 'undefined' && flow && Array.isArray(flow.nodes)) flow.nodes.forEach(function (n) { if (n) n._forInitialized = false; });
    // C7 (round 11): Stop da fermo (es. durante uno step-through) -- esecuzione FINITA:
    // tabella agli iniziali PRIMA di nascondere l'evidenziazione, copia runtime azzerata.
    if (typeof _bfInvalidateRunResults === 'function') _bfInvalidateRunResults(); // WP-M6b
    _runtimeVars = null;
    if (typeof highlightExecNode === 'function') highlightExecNode(-1); // R12-F: azzera nodo+arco
    // WP-D1 esteso: 'debug' esplicita per lo stesso motivo di flow_reset (vedi resetFlow sopra).
    _termMsg('exec_stopped', {}, 'debug', "Execution stopped by user.");
    _setStopEnabled(false);
  }
}

// G1+G2a (Ismail 2026-07-14, "se in esecuzione elimini un blocco resta un arco fantasma
// evidenziato"): QUALUNQUE mutazione del grafo (insert/move/delete/edit) deve azzerare lo stato
// di evidenziazione dell'esecuzione, altrimenti resta impostato executingEdge/executingNodeIndex
// -- e col modello P6 executingEdge.litGroup contiene COORDINATE ASSOLUTE congelate, quindi alla
// ridisegnata l'arco riappare nel punto vecchio, scollegato dal nuovo layout. Scelta G2a: l'edit
// FERMA l'esecuzione (pulito e prevedibile). Agganciato a pushHistory() (hook universale pre-edit).
// D1 (do-while, Ismail 2026-07-14 "appena entra nel do-while si colora subito il blocco"): alla
// PRIMA visita di un do-while (si arriva da FUORI il corpo) l'esecuzione entra nel corpo SENZA
// valutare la condizione -- l'esagono (che geometricamente sta in FONDO, dopo il corpo) NON deve
// accendersi ancora. La fase-nodo dell'esagono va mostrata solo quando ci si torna dal corpo per
// valutare la condizione (visita successiva). Corpo VUOTO: degenera a while, si evidenzia normale.
function _isFirstVisitDo(idx, cameFrom){
  const n = (typeof flow !== 'undefined' && flow.nodes) ? flow.nodes[idx] : null;
  if (!n || n.type !== 'do') return false;
  const body = (typeof collectLoopBody === 'function') ? collectLoopBody(idx) : { bodyList: [] };
  if (!body.bodyList || !body.bodyList.length) return false; // corpo vuoto: self-loop stile while
  const p = (cameFrom !== null && cameFrom !== undefined) ? parseInt(cameFrom, 10) : NaN;
  return !body.bodyList.includes(p); // prima visita = NON si arriva dal corpo
}
// Evidenzia il nodo `idx` come fase-NODO, MA salta l'esagono di un do-while alla prima visita (D1).
function _highlightExecNodeSafe(idx, cameFrom){
  if (_isFirstVisitDo(idx, cameFrom)) { highlightExecNode(-1); return; } // niente esagono all'ingresso
  highlightExecNode(idx);
}
function _bfAbortExecOnEdit(){
  // WP-M5p (Ismail 2026-07-21, "NON SI RESETTANO, si resetta solo se clicco il pulsante"):
  // il ripristino della tabella va fatto SEMPRE, e va fatto PRIMA della guardia qui sotto.
  // Fino a WP-M5m non si notava, perche' a fine run la tabella si ripristinava da sola; da
  // quando i valori finali RESTANO a schermo (richiesta di Ismail) questa funzione e' l'unico
  // punto che li invalida quando si modifica il programma -- ed era irraggiungibile.
  // Il motivo e' il test `active` sotto: nato per un altro scopo (spegnere l'evidenziazione
  // fantasma di un'esecuzione IN CORSO), a run conclusa e' falso in tutti i suoi termini
  // (_bfRunning false, currentNode null, nessun arco/nodo evidenziato) -> `return` immediato
  // e nessun ripristino. Cioe' esattamente il caso piu' comune: si esegue, finisce, si modifica
  // un blocco. Ora: prima si invalidano SEMPRE i risultati, poi -- solo se serve davvero --
  // si abbatte l'esecuzione in corso.
  if (typeof _bfInvalidateRunResults === 'function') _bfInvalidateRunResults(); // WP-M6b
  const active = (typeof _bfRunning !== 'undefined' && _bfRunning) ||
    (typeof currentNode !== 'undefined' && currentNode != null) ||
    (typeof executingEdge !== 'undefined' && executingEdge) ||
    (typeof executingNodeIndex !== 'undefined' && executingNodeIndex >= 0);
  if (!active) return; // nessuna esecuzione in corso/evidenziata: niente altro da azzerare
  stopRequested = true;                 // se un Run e' in corso, il suo loop terminera'
  if (typeof pauseRequested !== 'undefined') pauseRequested = false;
  // WP-N2 (round 15-C, problema #3): copre anche il ramo "Svuota da pausa" -- se in futuro
  // _paused dovesse uscire dallo scope locale di executeFlow (es. refactor WP-N3), questo
  // azzeramento resta gia' pronto. Nessuna ristrutturazione della funzione.
  if (typeof _paused !== 'undefined') _paused = false;
  if (typeof currentNode !== 'undefined') currentNode = null;
  if (typeof prevNode !== 'undefined') prevNode = null;
  _runtimeVars = null;
  if (typeof executingEdge !== 'undefined') executingEdge = null;        // via l'arco (fantasma) evidenziato
  if (typeof executingNodeIndex !== 'undefined') executingNodeIndex = -1; // e il nodo evidenziato
  if (typeof _setStopEnabled === 'function') _setStopEnabled(false);
  if (typeof _setRunning === 'function') _setRunning(false);
  // Nota: NON si chiama draw() qui -- la mutazione che ha invocato pushHistory ridisegna comunque
  // subito dopo, e a quel punto executingEdge/Node sono gia' nulli -> nessun fantasma.
}

async function executeFlow(json){
    // WP-N11 (round 15-C, Ismail 2026-07-17): guardia di rientranza -- rete di sicurezza in
    // piu' oltre alla disabilitazione del bottone in _setRunning() qui sopra (che copre il
    // click normale). Se qualunque altro percorso richiamasse executeFlow mentre un Run e' GIA'
    // attivo (mai per avviarne uno secondo in parallelo, stesso principio di
    // _bfSkipCurrentDelay), esce subito invece di aprire un secondo while-loop sullo stesso
    // stato condiviso (currentNode/prevNode/_runtimeVars).
    if (typeof _bfRunning !== 'undefined' && _bfRunning) return;
    console.log(json)
    if(currentNode== null){
      currentNode = "0"; // Reimposta al primo nodo se currentNode è nullo
      prevNode = null; // FIX B2: riavvio dall'inizio, nessun predecessore significativo
      _openInlineP = null; // A4: nuova esecuzione, niente riga aperta ereditata dalla precedente
      if (typeof resetDrawBuffer === 'function') resetDrawBuffer(); // nuova esecuzione: tela pulita
      if (typeof nodi !== 'undefined' && Array.isArray(nodi)) nodi.forEach(function (v) { if (v) v._error = false; });
      // C7 (round 11): nuova esecuzione -> copia runtime FRESCA dai valori iniziali
      // (flow.variables, la fonte di verita' che si salva). L'esecuzione lavora SEMPRE
      // sulla copia, mai sull'originale -- cosi' un Run non muta piu' i valori iniziali.
      _runtimeVars = _bfFreshRuntimeVars();
    }
    // C7: rete di sicurezza -- currentNode parte gia' a "0" (non null) al primissimo Run
    // della sessione (nessun Reset/Stop precedente), quindi il ramo sopra potrebbe non
    // essere passato: se la copia runtime non esiste ancora, creala ora.
    if (!_runtimeVars) _runtimeVars = _bfFreshRuntimeVars();
    let variables = _runtimeVars;
    let stepGuard = 0;
    stopRequested = false; pauseRequested = false;
    let _paused = false;
    // WP-M5r (Ismail 2026-07-21, "ok anche ferma"): distingue FINE NATURALE da STOP DELL'UTENTE.
    // Servono due comportamenti diversi in fondo alla funzione, e prima non serviva perche'
    // erano trattati uguale (si ripristinava sempre). Da WP-M5m la fine naturale TIENE i valori
    // -- ed e' cosi' che avevo tolto il ripristino anche allo Stop premuto DURANTE una run, che
    // esce da questo stesso punto. Lo Stop deve invece riportare tutto alla dichiarazione:
    // e' la sua funzione, ed e' uno dei tre modi di reset che Ismail ha chiesto.
    let _stoppedByUser = false;
    _setRunning(true);
    while(currentNode != null){
        if (stopRequested) {
            // WP-D1 esteso: 'debug' esplicita per lo stesso motivo di flow_reset (vedi resetFlow sopra).
    _termMsg('exec_stopped', {}, 'debug', "Execution stopped by user.");
            stopRequested = false;
            _stoppedByUser = true; // WP-M5r: a fine funzione la tabella torna alla dichiarazione
            // Stop azzera lo stato: currentNode=null -> la prossima esecuzione riparte da Start
            currentNode = null; prevNode = null;
            if (typeof flow !== 'undefined' && flow && Array.isArray(flow.nodes)) flow.nodes.forEach(function (n) { if (n) n._forInitialized = false; });
            break;
        }
        stepGuard++;
        // WP-M5t: la protezione anti-ciclo-infinito e' ora un'impostazione (Prestazioni ->
        // "Protezione anti-ciclo infinito"). ON di default; spegnendola l'esecuzione non ha
        // piu' un tetto di passi -- scelta di chi sa cosa sta facendo. Non e' un salto nel
        // vuoto: da WP-M5l il loop respira ogni 64 passi anche a velocita' Istantanea, quindi
        // anche un ciclo davvero senza fine lascia la pagina reattiva e il pulsante Ferma vivo.
        const _guardOn = (typeof perfSettings === 'undefined') || !perfSettings || perfSettings.loopGuard !== false;
        if (_guardOn && stepGuard > MAX_EXECUTION_STEPS) {
            throwError(errMsg('err_infinite_loop', {n: MAX_EXECUTION_STEPS}));
            break;
        }
        const idxBeforeExec2 = parseInt(currentNode); // R12-F: indice del nodo di questa fase-nodo
        // WP-M5l (Ismail 2026-07-21, "qua crasha" con Istantanea): a runSpeed 0 il ciclo NON
        // cedeva mai il controllo al browser. `await` su promise gia' risolte crea microtask,
        // che NON lasciano ripartire il rendering: per tutta la durata della run la pagina
        // resta congelata (nessun ridisegno, nessun click, nessuno Stop) -- cio' che si vede
        // come "e' crashato". Con 1000 iterazioni e un ridisegno del canvas per passo, il
        // blocco dura abbastanza da far intervenire l'avviso "pagina non risponde".
        // Due correzioni, entrambe solo in modalita' Istantanea (le altre velocita' hanno gia'
        // il loro sleep e restano identiche):
        //   1. RESPIRO: ogni BF_INSTANT_YIELD_EVERY passi si attende un vero macrotask
        //      (sleep(0) -> setTimeout), che restituisce il controllo al browser: la pagina
        //      ridipinge, resta cliccabile e lo Stop funziona anche a meta' di un ciclo lungo.
        //   2. RIDISEGNO SALTATO: evidenziare il blocco corrente costa un draw() completo del
        //      canvas. A velocita' Istantanea nessuno puo' vedere mille evidenziazioni in
        //      sequenza: se ne disegna una ogni tanto (e l'ultima resta comunque corretta,
        //      la scrive highlightExecNode a fine run).
        const _instant = !(runSpeed > 0);
        // WP-M5s: in TURBO (impostazione Prestazioni) a velocita' Istantanea non si evidenzia
        // proprio nulla -- ogni evidenziazione e' un draw() completo del canvas.
        const _turbo = _instant && (typeof perfSettings !== 'undefined' && perfSettings && perfSettings.turbo);
        if (!_turbo && (!_instant || (stepGuard % BF_INSTANT_REDRAW_EVERY) === 1)) {
          _highlightExecNodeSafe(idxBeforeExec2, prevNode); // blocco corrente (D1: salta l'esagono do-while alla 1a visita)
        }
        if (runSpeed > 0) await sleep(runSpeed); // velocità animazione (Lenta/Normale/Veloce/Istantanea)
        else if ((stepGuard % BF_INSTANT_YIELD_EVERY) === 0) await sleep(0); // WP-M5l: respiro
        if (pauseRequested) { // Pausa: sospende QUI, il blocco resta evidenziato, si riprende con Esegui/Passo
            pauseRequested = false; _paused = true;
            _termMsg('exec_paused', {}, 'debug', '\u23F8 Esecuzione in pausa. Premi Esegui o Passo per continuare.');
            break;
        }
        const node = json.nodes[idxBeforeExec2];
        const nodeIdxBeforeExec = currentNode; // FIX B2: sara' il "prevNode" del prossimo giro
        // MIGLIORIA #42 (Ismail 2026-07-08): il blocco Pause e' un BREAKPOINT reale. Durante il
        // Run automatico, quando si raggiunge un Pause si esegue (pass-through), si avanza al
        // nodo successivo e si INTERROMPE il run: l'utente riprende con Esegui o Step. currentNode
        // resta sul nodo DOPO il Pause, quindi riprendendo non si ripausa all'infinito.
        if (node && node.type === 'pause') {
            _termMsg('exec_breakpoint', {}, 'debug', '\u23F8 Breakpoint (Pause). Premi Esegui o Step per continuare.');
            currentNode = await executeNode(node, currentNode, variables, prevNode);
            prevNode = nodeIdxBeforeExec;
            refreshVariablesWatch(variables, touchedVarName(node));
            // R12-F: il breakpoint Pause MANTIENE il comportamento di prima -- salto diretto
            // all'evidenziazione del nodo successivo, SENZA fase-arco (il run e' comunque
            // interrotto qui: l'arco eventuale si vedra' al prossimo Esegui/Step, quando la
            // scansione riparte normalmente dal nodo corrente).
            highlightExecNode(currentNode != null ? parseInt(currentNode) : -1);
            // C7 (round 11): un breakpoint Pause interrompe il run ma resta RIPRENDIBILE
            // (Esegui/Step), esattamente come pauseRequested qui sotto -- deve quindi settare
            // _paused come quel caso, cosi' il ramo "if (!_paused)" a fine funzione NON
            // ripristina i valori iniziali (perderebbe lo stato runtime a meta' esecuzione).
            _paused = true;
            break;
        }
        const _prevForEdge2 = prevNode; // nodo PRIMA di questo (per la risalita do-while), prima dell'update
        currentNode = await executeNode(node,currentNode,variables,prevNode);
        prevNode = nodeIdxBeforeExec;
        // WP-M5s: in turbo il pannello Variabili non si aggiorna ad ogni passo (nessuno puo'
        // leggere mille aggiornamenti al secondo). Un refresh ogni tanto tiene comunque il
        // pannello "vivo", e quello FINALE arriva comunque a fine run.
        if (!_turbo || (stepGuard % BF_TURBO_WATCH_EVERY) === 0) {
          refreshVariablesWatch(variables, touchedVarName(node)); // pannello Variabili "live"
        }
        // R12-F (Ismail 2026-07-12): FASE-ARCO -- SOLO se c'e' un prossimo nodo e la velocita'
        // non e' Istantanea (runSpeed===0 salta la fase-arco: nessun highlight intermedio,
        // comportamento veloce attuale invariato). Stessa durata della fase-nodo (sleep(runSpeed)):
        // scansione uniforme come richiesto dal piano.
        if (currentNode != null && runSpeed > 0) {
            const idxAfterExec2 = parseInt(currentNode);
            // P5.6: back-edge (ritorno in un header di ciclo) animato in due fasi (out -> back);
            // in AVANTI resta una fase sola. Vale a qualunque annidamento (criterio per-arco).
            await animateExecEdge(idxBeforeExec2, idxAfterExec2, runSpeed, _prevForEdge2);
            if (pauseRequested) { // Pausa durante la fase-arco: resta evidenziato l'ARCO (non il nodo)
                pauseRequested = false; _paused = true;
                _termMsg('exec_paused', {}, 'debug', '⏸ Esecuzione in pausa. Premi Esegui o Passo per continuare.');
                break;
            }
        }
    }
    // WP-M5w (Ismail 2026-07-21, "con turbo il for non arriva a 1000 ma si ferma a 938"):
    // il programma arrivava eccome a 1000 -- era la TABELLA a essere ferma. In turbo il
    // pannello Variabili si aggiorna ogni 256 passi (WP-M5s) e i pannelli celle si ridipingono
    // al massimo una volta per frame (WP-M5i): a fine run restava a schermo l'ultimo stato
    // intermedio, che sembrava il risultato. Peggiorato da WP-M5m, che i valori finali li
    // lascia a schermo: prima il ripristino automatico nascondeva il problema.
    // Un aggiornamento FINALE, sempre, prima di dichiarare finita l'esecuzione. Vale anche in
    // pausa: chi mette in pausa vuole vedere i valori di ADESSO, non di 256 passi fa.
    refreshVariablesWatch(variables, null);
    if (typeof _bfFlushArrayCellsNow === 'function') _bfFlushArrayCellsNow();
    _setRunning(false);
    if (!_paused) {
        // WP-M5m (Ismail 2026-07-21, "quando finisce l'esecuzione le variabili devono mantenere
        // tutte lo stesso valore"): a fine run la tabella NON torna piu' ai valori iniziali.
        // Il risultato di un programma e' proprio il valore finale delle variabili: azzerarlo
        // nell'istante in cui l'esecuzione termina lo rendeva illeggibile, e per rivederlo
        // bisognava rieseguire a velocita' lenta. Ora resta a schermo (con l'evidenziazione
        // .live-value, che dice "questo e' un risultato, non la dichiarazione").
        // Il ripristino resta disponibile, ma su richiesta: pulsante STOP (requestStop),
        // Reset (resetFlow), oppure una qualunque modifica al flusso -- aggiungere una
        // variabile o cancellare un blocco passano da pushHistory, che ripristina.
        // `_runtimeVars` si azzera comunque: la prossima esecuzione riparte da una copia
        // fresca dei valori INIZIALI, non da quelli rimasti a schermo.
        // WP-M5r: lo STOP e' l'eccezione -- li' il ripristino ci vuole, e' proprio cio' che
        // il pulsante promette. Vale sia per lo Stop premuto a run ferma (requestStop, che
        // ripristina da se') sia per quello premuto DURANTE la run, che esce da qui.
        if (_stoppedByUser && typeof _bfInvalidateRunResults === 'function') _bfInvalidateRunResults(); // WP-M6b
        _runtimeVars = null;
        highlightExecNode(-1); // R12-F: azzera entrambe le fasi (finita/stop: in pausa le mantiene)
    }
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
// A4 (round 11): stato modulo per l'opzione Output "a capo dopo la stampa". Quando l'ultima
// stampa 'output' aveva newline:false, il suo <p> resta "aperto" qui: la prossima stampa
// 'output' vi appende il testo invece di crearne uno nuovo (comportamento Flowgorithm).
// Le categorie non-'output' (debug/if/loop) e reset/nuova esecuzione chiudono sempre la riga.
let _openInlineP = null;
// Messaggi RUNTIME del terminale tradotti (Ismail 2026-07-17): categoria ESPLICITA (il filtro
// output/cond/loop non dipende piu' dal testo, ora tradotto) + fallback inglese. Le parti {…}
// sono CODICE dell'utente (condizioni/assegnazioni) e restano verbatim.
function _termTrue() { return (typeof i18nText === 'function' && i18nText('run_is_true')) || 'is true'; }
function _termFalse() { return (typeof i18nText === 'function' && i18nText('run_is_false')) || 'is false'; }
// Ricompone il testo di un messaggio runtime nella LINGUA CORRENTE. `params.res` (true/false) =
// esito di una condizione -> tradotto vero/falso (serve per la RI-traduzione al cambio lingua,
// vedi retranslateConsole). Le altre parti (c/v/val/info) sono CODICE dell'utente, verbatim.
function _localizeBool(s) {
  if (typeof s !== 'string' || typeof i18nText !== 'function') return s;
  const T = i18nText('label_true') || 'true', F = i18nText('label_false') || 'false';
  return s.replace(/\btrue\b/g, T).replace(/\bfalse\b/g, F);
}
function _runMsgText(key, params) {
  const p = {}; for (const k in (params || {})) { if (k !== 'res') p[k] = params[k]; }
  // Ismail 2026-07-17: localizza i letterali booleani true/false DENTRO le parti di codice mostrate
  // (condizione {c}, assegnazione {info}, valore {val}) con label_true/label_false (le stesse dei
  // bordi degli archi) -> "Se: true" -> "Se: Vero"/"إذا: صحيح", coerente col resto. Il codice reale
  // eseguito NON cambia: e' solo il testo visualizzato nel terminale.
  ['c', 'info', 'val'].forEach(function (k) { if (typeof p[k] === 'string') p[k] = _localizeBool(p[k]); });
  if (params && typeof params.res === 'boolean') p.r = params.res ? _termTrue() : _termFalse();
  return (typeof i18nFormat === 'function' && i18nFormat(key, p)) || null;
}
// key/params vengono anche SALVATI sull'elemento (via printMessage opts) cosi' retranslateConsole()
// puo' ricomporre la riga nella nuova lingua senza rieseguire il flusso.
function _termMsg(key, params, cat, en) { printMessage(_runMsgText(key, params) || en, cat, { runKey: key, runParams: params }); }
// Ri-traduce TUTTE le righe runtime gia' stampate (quelle con key/params salvati) alla lingua
// corrente. Chiamata da applyLanguage() (i18n.js) al cambio lingua.
function retranslateConsole() {
  if (typeof document === 'undefined') return;
  if (typeof _bfFlushConsoleNow === 'function') _bfFlushConsoleNow(); // WP-M5s: anche le righe in coda
  const out = document.getElementById('console-output');
  if (!out || !out.querySelectorAll) return;
  out.querySelectorAll('[data-run-key]').forEach(function (el) {
    try {
      const key = el.getAttribute('data-run-key');
      const params = JSON.parse(el.getAttribute('data-run-params') || '{}');
      const txt = _runMsgText(key, params);
      if (txt) el.textContent = '> ' + txt;
    } catch (e) { /* riga non ricomponibile: la si lascia com'e' */ }
  });
  // Ismail 2026-07-17: ri-traduce anche gli ERRORI (data-err-key/params salvati da throwError).
  out.querySelectorAll('[data-err-key]').forEach(function (el) {
    try {
      const key = el.getAttribute('data-err-key');
      const params = JSON.parse(el.getAttribute('data-err-params') || '{}');
      const body = (typeof errMsg === 'function') ? errMsg(key, params) : null;
      if (body) el.textContent = '> Error: ' + body;
    } catch (e) { /* errore non ricomponibile: lo si lascia com'e' */ }
  });
}
if (typeof window !== 'undefined') window.retranslateConsole = retranslateConsole;
// WP-M2 (Ismail 2026-07-20, impostazione Prestazioni "consoleMax"): tiene il DOM del
// terminale entro ~300 righe scartando le PIU' VECCHIE -- con run lunghe (cicli che
// stampano migliaia di righe) l'append+scroll diventava sempre piu' lento. Non tocca mai
// la riga inline ancora aperta (_openInlineP).
var BF_CONSOLE_MAX_LINES = 300;
function _bfTrimConsole(out) {
  if (!out || typeof perfSettings === 'undefined' || !perfSettings || !perfSettings.consoleMax) return;
  try {
    while (out.children && out.children.length > BF_CONSOLE_MAX_LINES) {
      const first = out.children[0];
      if (typeof _openInlineP !== 'undefined' && first === _openInlineP) break;
      out.removeChild(first);
    }
  } catch (e) { /* non bloccante */ }
}
// WP-M5s (Ismail 2026-07-21, "c'e' un modo per velocizzare Istantanea quando ci sono di mezzo
// array?"): il costo dominante rimasto e' la CONSOLE. Non tanto creare i <p> -- quelli sono
// economici -- quanto le due righe che seguono ogni append:
//     _bfTrimConsole(out);  out.scrollTop = out.scrollHeight;
// leggere `scrollHeight` obbliga il browser a ricalcolare il layout SUBITO, in modo sincrono.
// Su un ciclo da 1000 giri con 3 messaggi per giro sono 3000 reflow forzati, uno per riga, tutti
// dentro un loop che non lascia respirare la pagina. (Nota: in jsdom questo costo NON si misura,
// perche' non fa layout -- e' il motivo per cui la misura in sandbox dava "nessuna differenza".)
// Soluzione: durante un'esecuzione le righe si ACCUMULANO in un buffer e si riversano nel DOM
// una volta per frame, con un solo appendChild (DocumentFragment) e un solo scroll. Il testo
// mostrato e' identico, cambia solo QUANDO tocca il DOM.
let _bfConsoleQueue = [];
let _bfConsoleRaf = 0;
function _bfFlushConsole() {
  _bfConsoleRaf = 0;
  if (!_bfConsoleQueue.length) return;
  const out = document.getElementById('console-output');
  if (!out) { _bfConsoleQueue = []; return; }
  // WP-M5u (Ismail 2026-07-21, "se attivi il terminale durante Istantanea lagga assai"):
  // si scartano QUI le righe che il limite di storico cancellerebbe comunque un istante dopo.
  // Prima venivano inserite tutte nel DOM e poi rimosse da _bfTrimConsole: migliaia di nodi
  // creati, attaccati e subito buttati. Con il tetto attivo (default) di un ciclo da 1000 giri
  // finiscono nel documento solo le ultime ~300 righe -- le uniche che l'utente potra' leggere.
  if (typeof perfSettings !== 'undefined' && perfSettings && perfSettings.consoleMax &&
      _bfConsoleQueue.length > BF_CONSOLE_MAX_LINES) {
    _bfConsoleQueue = _bfConsoleQueue.slice(-BF_CONSOLE_MAX_LINES);
  }
  const frag = document.createDocumentFragment();
  for (let i = 0; i < _bfConsoleQueue.length; i++) frag.appendChild(_bfConsoleQueue[i]);
  _bfConsoleQueue = [];
  out.appendChild(frag);
  _bfTrimConsole(out);
  out.scrollTop = out.scrollHeight; // UN solo reflow forzato per flush invece di uno per riga
}
// Riversa SUBITO tutto quello che e' in coda. Da chiamare ogni volta che qualcuno sta per
// leggere o manipolare il contenuto della console (fine run, errore, cambio lingua, pulizia):
// altrimenti vedrebbe una console incompleta.
function _bfFlushConsoleNow() {
  if (_bfConsoleRaf) { try { clearTimeout(_bfConsoleRaf); } catch (e) {} }
  _bfConsoleRaf = 0;
  _bfFlushConsole();
}
// WP-M5u: cadenza dei riversamenti durante un'esecuzione. Una volta per FRAME (~16ms) era
// ancora troppo: a velocita' Istantanea il terminale aperto riceveva ~60 inserimenti al
// secondo su un DOM che nel frattempo cresceva. Una volta ogni 200ms e' ampiamente sufficiente
// per "vedere che sta scorrendo" -- nessuno legge righe che passano piu' in fretta -- e taglia
// il lavoro di un fattore ~12. A esecuzione ferma si scrive subito (nessuna attesa).
const BF_CONSOLE_FLUSH_MS = 200;
function _bfQueueConsoleLine(el) {
  _bfConsoleQueue.push(el);
  // Tetto anche sulla CODA: senza, un ciclo da centomila passi accumulerebbe centomila
  // elementi in memoria fra un riversamento e l'altro. Si tiene la riga aperta (_openInlineP),
  // che sta ancora ricevendo testo, esattamente come fa _bfTrimConsole nel DOM.
  if (typeof perfSettings !== 'undefined' && perfSettings && perfSettings.consoleMax &&
      _bfConsoleQueue.length > BF_CONSOLE_MAX_LINES * 2) {
    const keep = _bfConsoleQueue.slice(-BF_CONSOLE_MAX_LINES);
    if (typeof _openInlineP !== 'undefined' && _openInlineP && keep.indexOf(_openInlineP) === -1) keep.push(_openInlineP);
    _bfConsoleQueue = keep;
  }
  if (_bfConsoleRaf) return;
  _bfConsoleRaf = setTimeout(_bfFlushConsole, BF_CONSOLE_FLUSH_MS);
}
if (typeof window !== 'undefined') window._bfFlushConsoleNow = _bfFlushConsoleNow;
function printMessage(msg, category, opts){
    const cat = category || classifyConsoleMsg(msg);
    // 'output' (contenuto utente) e gli errori si mostrano SEMPRE; le altre categorie
    // rispettano le impostazioni del terminale.
    // WP-M5s: in TURBO le righe di servizio (Assegna:…, Condizione:… è vero) non si stampano.
    // Su un ciclo da mille giri sono la stragrande maggioranza dell'output, e ognuna e' un nodo
    // DOM in piu'. L'output del programma e gli errori passano sempre: quelli sono il risultato.
    if (cat !== 'output' && typeof _bfRunning !== 'undefined' && _bfRunning &&
        typeof perfSettings !== 'undefined' && perfSettings && perfSettings.turbo) {
        _openInlineP = null;
        return;
    }
    if (cat !== 'output' && consoleSettings && consoleSettings[cat] === false) {
        _openInlineP = null; // anche una stampa soppressa chiude la riga aperta (niente stato sporco)
        return;
    }
    const consoleOutput = document.getElementById('console-output');
    if (cat !== 'output') {
        // Le categorie non-output non si appendono MAI alla riga aperta: la chiudono.
        _openInlineP = null;
        const messageElement = document.createElement('p');
        messageElement.textContent = "> " +  msg;
        if (messageElement.setAttribute) messageElement.setAttribute('data-cat', cat);
        if (opts && opts.runKey && messageElement.setAttribute) { messageElement.setAttribute('data-run-key', opts.runKey); try { messageElement.setAttribute('data-run-params', JSON.stringify(opts.runParams || {})); } catch (e) {} } // retranslateConsole al cambio lingua
        // WP-M5s: durante un'esecuzione la riga passa dal buffer (un solo tocco del DOM per
        // frame); a riposo si scrive subito, cosi' un messaggio isolato compare all'istante.
        if (typeof _bfRunning !== 'undefined' && _bfRunning) { _bfQueueConsoleLine(messageElement); return; }
        consoleOutput.appendChild(messageElement);
        _bfTrimConsole(consoleOutput); // WP-M2: limite righe (impostazione Prestazioni)
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
        return;
    }
    // cat === 'output'
    if (_openInlineP) {
        _openInlineP.textContent += msg; // continua la riga precedente (senza ripetere "> ")
    } else {
        const messageElement = document.createElement('p');
        messageElement.textContent = "> " + msg;
        if (opts && opts.runKey && messageElement.setAttribute) { messageElement.setAttribute('data-run-key', opts.runKey); try { messageElement.setAttribute('data-run-params', JSON.stringify(opts.runParams || {})); } catch (e) {} } // retranslateConsole al cambio lingua
        // WP-M5s: in esecuzione la riga va in coda. _openInlineP resta valido anche se il <p>
        // non e' ancora nel DOM: le stampe senza a-capo continuano ad accodarsi al suo testo.
        if (typeof _bfRunning !== 'undefined' && _bfRunning) _bfQueueConsoleLine(messageElement);
        else consoleOutput.appendChild(messageElement);
        _openInlineP = messageElement;
    }
    if (typeof _bfRunning === 'undefined' || !_bfRunning) {
      _bfTrimConsole(consoleOutput); // WP-M2: limite righe (impostazione Prestazioni)
      consoleOutput.scrollTop = consoleOutput.scrollHeight; // Scorre fino in fondo
    }
    if (!opts || opts.newline !== false) _openInlineP = null; // chiudi, salvo richiesta esplicita di restare aperta
}

function throwError(msg){
    if (typeof _bfFlushConsoleNow === 'function') _bfFlushConsoleNow(); // WP-M5s: coda -> DOM
    const consoleOutput = document.getElementById('console-output');
    const errorElement = document.createElement('p');
    errorElement.textContent = "> Error: " + msg;
    errorElement.classList.add('error');
    // Ismail 2026-07-17: salva key/params dell'errore (registrati da errMsg poco prima) cosi'
    // retranslateConsole() puo' ri-tradurre anche gli ERRORI al cambio lingua. Poi azzera il registro.
    try {
        if (typeof window !== 'undefined' && window._bfLastErrInfo && errorElement.setAttribute) {
            errorElement.setAttribute('data-err-key', window._bfLastErrInfo.key);
            errorElement.setAttribute('data-err-params', JSON.stringify(window._bfLastErrInfo.params || {}));
        }
    } catch (e) {}
    if (typeof window !== 'undefined') window._bfLastErrInfo = null;
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
    // WP-M5q (Ismail 2026-07-21, "quando fa il rosso devi fare in modo che si resettino anche
    // i valori delle variabili"): un'esecuzione finita in ERRORE si e' interrotta a meta', quindi
    // i valori rimasti in tabella sono uno stato PARZIALE -- alcune variabili gia' aggiornate,
    // altre ferme alla dichiarazione, e nessuna indicazione di quali siano quali. Lasciarli a
    // schermo (comportamento nato con WP-M5m, dove i valori finali restano) e' peggio che
    // azzerarli: sembrano un risultato ma non lo sono. Il blocco resta rosso e il messaggio
    // resta in console e nel popup, quindi non si perde nessuna informazione sull'errore.
    if (typeof _bfInvalidateRunResults === 'function') _bfInvalidateRunResults(); // WP-M6b
    _runtimeVars = null; // la prossima esecuzione riparte da una copia fresca dei valori iniziali
    currentNode = "0"; // Reimposta al primo nodo in caso di errore
}

function clearConsole() {
    if (typeof _bfFlushConsoleNow === 'function') _bfFlushConsoleNow(); // WP-M5s: svuota la coda
    const consoleOutput = document.getElementById('console-output');
    consoleOutput.innerHTML = ''; // Pulisce l'output della console
    _openInlineP = null; // A4: niente riferimenti a <p> ormai rimossi dal DOM
    // WP-D1 esteso: 'debug' esplicita, stesso motivo di flow_reset/exec_stopped sopra.
    _termMsg('console_cleared', {}, 'debug', "Console cleared.");
}

async function executeNode(node,currentNode,variables,prevNodeArg){
  _execBranch = null; // P (round 15): azzerato a ogni nodo; solo i case di diramazione lo settano
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
                // WP-D1 esteso: riusa la chiave nd_start (stesso testo "Start" del nodo) -- 'debug'
                // esplicita, altrimenti classifyConsoleMsg() non riconosce piu' il testo tradotto.
                _termMsg('nd_start', {}, 'debug', "Start");
                currentNode = node.next;
                break;
            case "print": // NODO PRINT
                string="";
                parts = splitStrings(node.info);
                for (let i = 0; i < parts.length; i++) {
                  if (parts[i].startsWith("'") || parts[i].startsWith('"') ) {
                    string += parts[i].substring(1, parts[i].length - 1);
                  } else {
                    // WP-N7: se questa parte dell'output USA una variabile non inizializzata -> errore.
                    { const _uv = _bfUninitUsedIn(parts[i], variables); if (_uv) { throwError(errMsg('err_uninit_var', {n: currentNode, v: _uv})); return null; } }
                    // FIX (Ismail 2026-07-19, "superare il limite di parentesi/decimali in Output"):
                    // il vecchio scanner leggeva CARATTERE PER CARATTERE, isolando "candidati nome
                    // variabile" fra spazi/operatori aritmetici -- non riconosceva ne' le parentesi
                    // ne' i numeri decimali scritti a mano (il '.' veniva accumulato come se fosse
                    // parte di un nome, mai come cifra) e non capiva affatto Math.*. Ora si
                    // sostituiscono le variabili per NOME INTERO (stessa tecnica gia' usata da
                    // Assign/For/checkCondition, vedi _varValueForExpr sopra) e si passa l'espressione
                    // COMPLETA a safeEvaluate, che gestisce gia' parentesi/decimali/Math.*/tutta la
                    // grammatica -- Output ora si comporta ESATTAMENTE come ogni altro campo, come
                    // gia' promesso (ma non ancora vero) nel capitolo 3 del manuale.
                    let expression = parts[i];
                    expression = _bfSubstituteVars(expression, variables); // WP-M5h: scanner unico
                    // P2.2 (round 15): il case Output NON era in try/catch -> una divisione
                    // per zero (o altra espressione invalida) faceva propagare il throw e
                    // CRASHARE l'esecuzione senza mai mostrare il popup ("si blocca ma non da'
                    // errore"). Ora l'errore diventa un popup chiaro e l'esecuzione si ferma.
                    // FIX (Ismail 2026-07-19, "far stampare il valore di una variabile String"):
                    // quando un pezzo di testo non tra apici segue una parte tra apici scritta
                    // con un "+" esplicito ('Nome: ' + nome), il '+' resta dentro "expression" ->
                    // diventa un "+" UNARIO davanti al valore sostituito (_varValueForExpr quota
                    // le stringhe: nome -> "'Mario'"). safeEvaluate legge "+'Mario'" come
                    // "converti in numero", che per una stringa da' NaN. Il "+" iniziale e' pero'
                    // SEMPRE ridondante quando e' numerico (+5 === 5): toglierlo prima di valutare
                    // non cambia mai un risultato numerico e ripara stringhe/booleani.
                    const _exprToEval = expression.replace(/^\s*\+\s*/, '');
                    try {
                      // WP-M2: se il risultato e' un ARRAY (es. stampa di `a` intero) lo si
                      // formatta come [1, 2, 3] invece del join di default "1,2,3".
                      const _pres = safeEvaluate(_exprToEval, _bfEvalScope(variables));
                      string += _bfFormatValueForDisplay(_pres);
                    } catch (e) {
                      throwError(_evalErrMsg(e, currentNode, 'err_invalid_expr'));
                      return null;
                    }
                  }
                }
                console.log("Print: " + string);
                // A4 (round 11): node.newline assente = true (retro-compat coi flow salvati prima).
                printMessage(string, 'output', { newline: node.newline !== false });
                currentNode = node.next;
                break; 
              case "if": // NODO IF
                let condition = node.info;
                console.log("If: " + condition);
                _termMsg('run_if', {c: condition}, 'cond', "If: " + condition);
                
                if (checkCondition(condition, variables) == true) {
                    console.log("If: " + condition + " is true");
                    _termMsg('run_if_res', {c: condition, res: true}, 'cond', "If: " + condition + " is true");
                    currentNode = node.next.true;
                    _execBranch = 'true';
                } else if(checkCondition(condition, variables) == false) {
                    console.log("If: " + condition + " is false");
                    _termMsg('run_if_res', {c: condition, res: false}, 'cond', "If: " + condition + " is false");
                    currentNode =  node.next.false;
                    _execBranch = 'false';
                }else{
                  return null;
                }
                break;
              case "while": // NODO WHILE
                let whileCondition = node.info;
                console.log("While: " + whileCondition);
                _termMsg('run_while', {c: whileCondition}, 'loop', "While: " + whileCondition);
                if(checkCondition(whileCondition, variables) == true){
                    console.log("While: " + whileCondition + " is true");
                    _termMsg('run_while_res', {c: whileCondition, res: true}, 'loop', "While: " + whileCondition + " is true");
                    currentNode = node.next.true; // Vai al ramo true
                    _execBranch = 'true';
                }else if(checkCondition(whileCondition, variables) == false){
                    console.log("While: " + whileCondition + " is false");
                    _termMsg('run_while_res', {c: whileCondition, res: false}, 'loop', "While: " + whileCondition + " is false");
                    currentNode = node.next.false; // Vai al ramo false
                    _execBranch = 'false';
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
                    _termMsg('run_do_enter', {}, 'debug', "Do: entering body (executes at least once)");
                    currentNode = node.next.true; // Vai al ramo true SENZA valutare la condizione
                    _execBranch = 'true';
                    break;
                }
                let doCondition = node.info;
                console.log("Do: " + doCondition);
                _termMsg('run_do', {c: doCondition}, 'loop', "Do: " + doCondition);
                if(checkCondition(doCondition, variables) == true){
                    console.log("Do: " + doCondition + " is true");
                    _termMsg('run_do_res', {c: doCondition, res: true}, 'loop', "Do: " + doCondition + " is true");
                    currentNode = node.next.true; // Vai al ramo true
                    _execBranch = 'true';
                }else if (checkCondition(doCondition, variables) == false){
                    console.log("Do: " + doCondition + " is false");
                    _termMsg('run_do_res', {c: doCondition, res: false}, 'loop', "Do: " + doCondition + " is false");
                    currentNode = node.next.false; // Vai al ramo false
                    _execBranch = 'false';
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
                    // WP-N7: se l'inizializzazione del for USA una variabile non inizializzata -> errore.
                    { const _uv = _bfUninitUsedIn(forInitExp, variables); if (_uv) { throwError(errMsg('err_uninit_var', {n: currentNode, v: _uv})); return null; } }
                    forInitExp = _bfSubstituteVars(forInitExp, variables); // WP-M5h: scanner unico
                    if (!existVariable(forVarName, variables)) {
                        throwError(errMsg('err_not_declared_node', {n: currentNode, v: forVarName}));
                        return null;
                    }
                    try {
                        const _forInitVal = safeEvaluate(forInitExp, _bfEvalScope(variables));
                        if (!_assertVarType(getVariable(forVarName, variables), _forInitVal, currentNode)) return null;
                        { const _tv = getVariable(forVarName, variables); _tv.value = _forInitVal; _tv.uninit = false; } // WP-N7: l'init del for INIZIALIZZA il contatore
                    } catch (e) {
                        throwError(_evalErrMsg(e, currentNode, 'err_for_init_expr'));
                        return null;
                    }
                    console.log("For: " + forVarName + " = " + getVariable(forVarName, variables).value);
                    _termMsg('run_for', {v: forVarName, val: getVariable(forVarName, variables).value}, 'loop', "For: " + forVarName + " = " + getVariable(forVarName, variables).value);
                    node._forInitialized = true;
                } else {
                    if (!applyForIncrement(increment, variables, currentNode)) return null;
                }

                // Controlla condizione
                if (checkCondition(forcondition, variables) == true) {
                    console.log("For Condition: " + forcondition + " is true");
                    _termMsg('run_for_cond', {c: forcondition, res: true}, 'loop', "For Condition: " + forcondition + " is true");
                    currentNode = node.next.true;
                    _execBranch = 'true';
                } else if(checkCondition(forcondition, variables) == false) {
                    console.log("For Condition: " + forcondition + " is false");
                    _termMsg('run_for_cond', {c: forcondition, res: false}, 'loop', "For Condition: " + forcondition + " is false");
                    currentNode = node.next.false;
                    _execBranch = 'false';
                    node._forInitialized = false; // pronto per una futura ri-esecuzione (es. loop annidato in un altro ciclo)
                }else{
                  return null;
                }
                break;
              case "input": //NODO INPUT
                console.log("Input: " + node.info);
                _termMsg('run_input', {info: node.info}, 'output', "Input: " + node.info);
                {
                  // WP-M2 (Ismail 2026-07-20, tipo Array): il blocco Input accetta anche
                  // `a[i]` (input di UN elemento, col tipo degli elementi) e un nome di
                  // variabile array intera (input di TUTTI gli elementi separati da virgola).
                  const _inIdx = _bfParseIndexedName(node.info);
                  const _inName = _inIdx ? _inIdx.name : String(node.info).trim();
                  if (!existVariable(_inName, variables)) {
                    throwError(errMsg('err_var_not_declared', {v: _inName}));
                    return null;
                  }
                  const _tv = getVariable(_inName, variables);
                  if (_inIdx) {
                    if (!isArrayType(_tv.type)) { throwError(errMsg('err_not_array', {n: currentNode})); return null; }
                    const _n = _bfEvalIndex(_inIdx.idxExpr, variables, currentNode);
                    if (_n === null) return null;
                    if (!Array.isArray(_tv.value)) _tv.value = [];
                    // WP-M3: range STRETTO 0..length-1 (dimensione dichiarata in tabella).
                    if (_n < 0 || _n >= _tv.value.length) { throwError(_bfIndexRangeMsg(currentNode, _n, _tv.value.length)); return null; }
                    const _val = await inputVariable(node.info, arrayElemType(_tv.type));
                    if (_val === null) return null;
                    _tv.value[_n] = _val;
                    _tv.uninit = false;
                  } else if (isArrayType(_tv.type)) {
                    // WP-M3: l'input dell'array INTERO deve fornire ESATTAMENTE `length`
                    // elementi (la dimensione e' quella dichiarata in tabella).
                    const _want = Array.isArray(_tv.value) ? _tv.value.length : 0;
                    const _val = await inputArrayVariable(_inName, arrayElemType(_tv.type), _want);
                    if (_val === null) return null;
                    _tv.value = _val;
                    _tv.uninit = false;
                  } else {
                    _tv.value = await inputVariable(_inName, _tv.type); _tv.uninit = false; // WP-N7: l'input INIZIALIZZA la variabile
                  }
                }
                currentNode = node.next;
                break;

              case "assign": // NODO ASSIGN
                console.log("Assign: " + node.info);
                _termMsg('run_assign', {info: node.info}, 'output', "Assign: " + node.info)
                let assignParts = node.info.split("=");
                if(assignParts.length != 2){
                  throwError(errMsg('err_assign_syntax', {n: currentNode}))
                  return null;
                }
                let varName = assignParts[0].trim();
                let exp = assignParts[1].trim();

                // WP-M2 (Ismail 2026-07-20, tipo Array): la LHS puo' essere un ELEMENTO di
                // array -- `a[i] = espressione`. Si estrae nome base + espressione indice.
                const _lhsIdx = _bfParseIndexedName(varName);
                if (_lhsIdx) varName = _lhsIdx.name;

                // WP-N7: se la RHS dell'assign USA una variabile non inizializzata -> errore (non vale 0).
                { const _uv = _bfUninitUsedIn(exp, variables); if (_uv) { throwError(errMsg('err_uninit_var', {n: currentNode, v: _uv})); return null; } }
                exp = _bfSubstituteVars(exp, variables); // WP-M5h: scanner unico (rispetta le stringhe)
                if(!existVariable(varName,variables)){
                  throwError(errMsg('err_not_declared_node', {n: currentNode, v: varName}))
                  return null;
                }
                try{
                  const _assignVal = safeEvaluate(exp, _bfEvalScope(variables));
                  const _tv = getVariable(varName,variables);
                  if (_lhsIdx) {
                    // WP-M2: assegnazione a UN elemento. La variabile deve essere un array;
                    // indice intero. WP-M3 (dimensione DICHIARATA in tabella): range STRETTO
                    // 0..length-1, stile Flowgorithm -- niente piu' append implicito, un
                    // array si ridimensiona solo riassegnandolo intero (a = [...]). Il
                    // valore rispetta il tipo degli elementi (_bfScalarTypeOk).
                    if (!isArrayType(_tv.type)) { throwError(errMsg('err_not_array', {n: currentNode})); return null; }
                    const _n = _bfEvalIndex(_lhsIdx.idxExpr, variables, currentNode);
                    if (_n === null) return null;
                    if (!Array.isArray(_tv.value)) _tv.value = [];
                    if (_n < 0 || _n >= _tv.value.length) { throwError(_bfIndexRangeMsg(currentNode, _n, _tv.value.length)); return null; }
                    const _et = arrayElemType(_tv.type);
                    if (!_bfScalarTypeOk(_et, _assignVal)) {
                      const _got = Array.isArray(_assignVal) ? 'array' : (typeof _assignVal === 'number') ? (Number.isInteger(_assignVal) ? 'int' : 'float') : (typeof _assignVal === 'string') ? 'string' : (typeof _assignVal === 'boolean') ? 'bool' : String(typeof _assignVal);
                      throwError(errMsg('err_type_mismatch', {n: currentNode, type: _et, got: _got}));
                      return null;
                    }
                    _tv.value[_n] = _assignVal;
                    _tv.uninit = false;
                  } else {
                    // P5.4/P3.1: blocca l'assegnazione di un tipo incompatibile (popup + stop).
                    if (!_assertVarType(_tv, _assignVal, currentNode)) return null;
                    _tv.value = _assignVal; _tv.uninit = false; // WP-N7: assegnare INIZIALIZZA la variabile
                  }
                }catch(e){
                  // P2.2/P3.2: div0 e "non dichiarata" ricevono un messaggio chiaro; e su
                  // QUALSIASI errore l'esecuzione ora si FERMA (prima proseguiva al nodo dopo).
                  throwError(_evalErrMsg(e, currentNode, 'err_invalid_expr'));
                  return null;
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
                _termMsg('run_end', {}, 'debug', "End.");
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
        exp = _bfSubstituteVars(exp, variables); // WP-M5h: scanner unico (rispetta le stringhe)
        try { v.value = v.value + safeEvaluate(exp, _bfEvalScope(variables)); } catch (e) { throwError(_evalErrMsg(e, currentNode, 'err_incr_expr')); return false; }
        return true;
    }
    if ((m = s.match(/^([A-Za-z_]\w*)\s*-=\s*(.+)$/))) {
        const v = getVariable(m[1], variables);
        if (!v) { throwError(errMsg('err_not_declared_node', {n: currentNode, v: m[1]})); return false; }
        let exp = m[2];
        exp = _bfSubstituteVars(exp, variables); // WP-M5h: scanner unico (rispetta le stringhe)
        try { v.value = v.value - safeEvaluate(exp, _bfEvalScope(variables)); } catch (e) { throwError(_evalErrMsg(e, currentNode, 'err_incr_expr')); return false; }
        return true;
    }
    if ((m = s.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/))) {
        const v = getVariable(m[1], variables);
        if (!v) { throwError(errMsg('err_not_declared_node', {n: currentNode, v: m[1]})); return false; }
        let exp = m[2];
        exp = _bfSubstituteVars(exp, variables); // WP-M5h: scanner unico (rispetta le stringhe)
        try { v.value = safeEvaluate(exp, _bfEvalScope(variables)); } catch (e) { throwError(_evalErrMsg(e, currentNode, 'err_incr_expr')); return false; }
        return true;
    }
    throwError(errMsg('err_incr_syntax', {n: currentNode, e: incrExpr}));
    return false;
}

// P2.2/P3.2 (round 15): traduce l'errore grezzo di safeEvaluate in un messaggio chiaro e
// tradotto. '__DIV0__' (lanciato da safeEval.mul su /0 o %0) -> err_div_zero; il messaggio
// "identificatore non permesso: X" (variabile non dichiarata rimasta nell'espressione) ->
// err_not_declared_node, invece del testo tecnico. Altrimenti usa la chiave generica passata.
function _evalErrMsg(e, nodeIdx, genericKey) {
  const m = (e && e.message) ? String(e.message) : String(e);
  if (m === '__DIV0__') return errMsg('err_div_zero', {n: nodeIdx});
  // WP-M2 (Ismail 2026-07-20, tipo Array): errori di indicizzazione lanciati da safeEval.js
  // (postfix) tradotti in messaggi chiari -- indice fuori range (con indice e lunghezza),
  // indice non intero, indicizzazione su un valore che non e' un array.
  const rng = m.match(/^__IDXRANGE__:(-?\d+):(\d+)$/);
  if (rng) return _bfIndexRangeMsg(nodeIdx, rng[1], parseInt(rng[2], 10));
  if (m === '__IDXTYPE__') return errMsg('err_index_int', {n: nodeIdx});
  if (m === '__IDXNOTARR__') return errMsg('err_not_array', {n: nodeIdx});
  // WP-M5f: errori delle conversioni carattere<->codice (Asc/Chr e aritmetica sui caratteri).
  const chr = m.match(/^__CHRRANGE__:(.*)$/);
  if (chr) return errMsg('err_chr_range', {n: nodeIdx, v: chr[1]});
  if (m === '__ASCEMPTY__') return errMsg('err_asc_empty', {n: nodeIdx});
  const undecl = m.match(/^identificatore non permesso:\s*(.+)$/);
  if (undecl) return errMsg('err_not_declared_node', {n: nodeIdx, v: undecl[1]});
  return errMsg(genericKey, {n: nodeIdx, e: m});
}

// ============================================================================
// WP-M2 (Ismail 2026-07-20): tipo ARRAY. Il tipo e' la stringa composta 'array:<elem>'
// (es. 'array:int') -- sopravvive tale e quale alla serializzazione .bflow/JSON. Il VALORE
// e' un vero array JS. Helpers condivisi da esecutore/UI/validazioni.
// ============================================================================
// WP-M5b (Ismail 2026-07-21, "ci sia errore quando esci, quando è vuota ecc"): messaggio
// unico per l'indice fuori dai limiti, con un caso dedicato per l'array VUOTO. Con dimensione
// 0 il messaggio generico diceva "indice 0 fuori dai limiti (lunghezza array: 0)": tecnicamente
// giusto ma fuorviante, perche' fa cercare l'errore nell'INDICE quando il problema e' che
// l'array non ha celle. Ogni punto che controlla il range passa da qui, cosi' il testo resta
// uno solo (prima erano tre copie della stessa chiamata a errMsg).
function _bfIndexRangeMsg(nodeIdx, i, len) {
  if (!len) return errMsg('err_index_empty', {n: nodeIdx});
  return errMsg('err_index_range', {n: nodeIdx, i: i, len: len});
}
function isArrayType(t) { return typeof t === 'string' && t.indexOf('array:') === 0; }
function arrayElemType(t) { return isArrayType(t) ? t.slice(6) : null; }
if (typeof window !== 'undefined') { window.isArrayType = isArrayType; window.arrayElemType = arrayElemType; }
// Formattazione uniforme di un array per la UI (terminale, tabella variabili): [1, 2, 3].
function _bfFormatValueForDisplay(v) {
  if (!Array.isArray(v)) return v;
  return '[' + v.map(function (el) { return String(el); }).join(', ') + ']';
}
// Valuta un'ESPRESSIONE-INDICE (es. la `i+1` di `a[i+1]` in un blocco Assegna/Input):
// sostituzione variabili identica agli altri campi + safeEvaluate + vincolo intero.
// Ritorna l'indice (>=0 non garantito: il range lo verifica il chiamante che conosce
// l'array) oppure null dopo aver gia' mostrato l'errore.
function _bfEvalIndex(idxExpr, variables, nodeIdx) {
  let exp = String(idxExpr);
  { const _uv = _bfUninitUsedIn(exp, variables); if (_uv) { throwError(errMsg('err_uninit_var', {n: nodeIdx, v: _uv})); return null; } }
  exp = _bfSubstituteVars(exp, variables); // WP-M5h: scanner unico
  let n;
  try { n = safeEvaluate(exp, _bfEvalScope(variables)); } catch (e) { throwError(_evalErrMsg(e, nodeIdx, 'err_invalid_expr')); return null; }
  if (typeof n !== 'number' || !Number.isInteger(n)) { throwError(errMsg('err_index_int', {n: nodeIdx})); return null; }
  return n;
}
// Riconosce una scrittura `nome[indice]` (LHS di Assegna, blocco Input). Ritorna
// { name, idxExpr } oppure null se non e' una forma indicizzata.
function _bfParseIndexedName(s) {
  const m = String(s).trim().match(/^([A-Za-z_]\w*)\s*\[(.+)\]$/);
  return m ? { name: m[1], idxExpr: m[2] } : null;
}

// P5.4/P3.1 (round 15): coerenza dei tipi stile Flowgorithm (STRICT, nessuna conversione
// implicita). Verifica che `value` sia compatibile col tipo dichiarato di `varObj`. Se lo e'
// ritorna true; altrimenti mostra il popup d'errore (via throwError) e ritorna false, cosi'
// il chiamante interrompe l'esecuzione del nodo. Tipi sconosciuti: nessuna validazione.
// WP-M2: verifica di un singolo valore contro un tipo SCALARE (riusata anche per gli
// elementi di un array, dove t e' il tipo degli elementi).
function _bfScalarTypeOk(t, value) {
  if (t === 'int') return (typeof value === 'number' && Number.isInteger(value));
  if (t === 'float') return (typeof value === 'number');
  if (t === 'string') return (typeof value === 'string');
  if (t === 'bool' || t === 'boolean') return (typeof value === 'boolean');
  return true; // tipo non riconosciuto -> non validare
}
function _assertVarType(varObj, value, nodeIdx) {
  if (!varObj || !varObj.type) return true;
  const t = varObj.type;
  let ok;
  // WP-M2 (Ismail 2026-07-20): tipo Array -- il valore deve essere un array e OGNI elemento
  // deve rispettare il tipo degli elementi (array:int accetta solo interi, ecc.).
  if (isArrayType(t)) {
    const et = arrayElemType(t);
    ok = Array.isArray(value) && value.every(function (el) { return _bfScalarTypeOk(et, el); });
  }
  else if (t === 'int' || t === 'float' || t === 'string' || t === 'bool' || t === 'boolean') ok = _bfScalarTypeOk(t, value);
  else return true; // tipo non riconosciuto -> non validare (nessuna regressione)
  if (ok) return true;
  // WP-M5b (audit array): quando il valore E' un array ma un ELEMENTO ha il tipo sbagliato,
  // il messaggio diceva 'atteso array:int, trovato array' -- letteralmente incomprensibile,
  // perche' un array lo era davvero. Ora si riporta il tipo dell'elemento che non torna
  // ('trovato array:string'), che e' l'informazione che serve per correggere.
  const _elemName = function (el) {
    return (typeof el === 'number') ? (Number.isInteger(el) ? 'int' : 'float')
         : (typeof el === 'string') ? 'string'
         : (typeof el === 'boolean') ? 'bool' : String(typeof el);
  };
  const got = Array.isArray(value) ? (function () {
              if (!isArrayType(t)) return 'array';
              const _et = arrayElemType(t);
              for (let _i = 0; _i < value.length; _i++) {
                if (!_bfScalarTypeOk(_et, value[_i])) return 'array:' + _elemName(value[_i]);
              }
              return 'array';
            })()
            : (typeof value === 'number') ? (Number.isInteger(value) ? 'int' : 'float')
            : (typeof value === 'string') ? 'string'
            : (typeof value === 'boolean') ? 'bool' : String(typeof value);
  throwError(errMsg('err_type_mismatch', {n: nodeIdx, type: t, got: got}));
  return false;
}

// WP-M5h (Ismail 2026-07-21, screenshot: `a[i] = 'a'+1` -> "espressione non valida: token in
// eccesso", e il programma che blocca la pagina). UNA sola causa per entrambi i sintomi.
// La sostituzione delle variabili nelle espressioni era una `String.replace` con
// `\bnome\b` su TUTTO il testo. Una regex non sa cosa sia un letterale stringa: con una
// variabile che si chiama `a`, l'espressione `'a'+1` conteneva una `a` DENTRO le virgolette e
// veniva sostituita anch'essa. Con `a` array da 1000 elementi il risultato era
// `'[ 'x','x',... ]'+1`: 4000 caratteri di spazzatura (da qui "token in eccesso"), ricostruiti
// e ri-tokenizzati a OGNI iterazione del ciclo -- da qui il blocco della pagina.
// checkCondition aveva gia' uno scanner che tratta le stringhe come "isole" intoccabili; qui
// lo si estrae in una funzione unica, usata da TUTTI i punti che sostituiscono variabili
// (Assegna, Output, indici, init del For, incrementi), cosi' il comportamento e' lo stesso
// ovunque invece di dipendere dal blocco in cui ci si trova.
// Effetto collaterale voluto: si sostituisce solo cio' che e' davvero un identificatore, quindi
// un array NON viene piu' serializzato per intero quando il suo nome non compare nel testo.
function _bfSubstituteVars(src, variables) {
  const s = String(src);
  let out = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    // Isola 1: letterale stringa -- copiato verbatim, mai toccato dentro.
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1, lit = ch;
      while (j < s.length) {
        lit += s[j];
        if (s[j] === '\\' && j + 1 < s.length) { lit += s[j + 1]; j += 2; continue; }
        if (s[j] === quote) { j++; break; }
        j++;
      }
      out += lit; i = j; continue;
    }
    // Isola 2: identificatore -- sostituito solo se e' una variabile dichiarata. I membri
    // dopo un punto (Math.floor) e le parole chiave restano invariati, come i nomi non noti
    // (Asc/Chr, o una variabile inesistente: la segnalera' safeEvaluate con il suo errore).
    if (/[A-Za-z_]/.test(ch)) {
      let j = i, id = '';
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) { id += s[j]; j++; }
      const isMember = out.length > 0 && out[out.length - 1] === '.';
      if (!isMember && Array.isArray(variables)) {
        const v = variables.find(function (x) { return x && x.name === id; });
        // WP-M5k: gli ARRAY non si incollano piu' nel testo -- il nome resta com'e' e il
        // valore arriva a safeEvaluate per riferimento tramite l'ambiente (_bfEvalScope).
        // Gli scalari continuano a essere sostituiti testualmente: costano pochi caratteri
        // e cosi' i messaggi d'errore mostrano ancora l'espressione con i valori dentro.
        if (v && !Array.isArray(v.value)) { out += _varValueForExpr(v); i = j; continue; }
      }
      out += id; i = j; continue;
    }
    out += ch; i++;
  }
  return out;
}
// WP-M5k: ambiente da passare a safeEvaluate -- contiene i soli valori che NON vengono
// sostituiti testualmente (gli array). Si ricostruisce ad ogni valutazione, ma e' un oggetto
// con pochissime chiavi e i valori sono riferimenti: non copia nulla.
function _bfEvalScope(variables) {
  if (!Array.isArray(variables)) return undefined;
  let vars = null;
  for (let i = 0; i < variables.length; i++) {
    const v = variables[i];
    if (v && v.name && Array.isArray(v.value)) { if (!vars) vars = {}; vars[v.name] = v.value; }
  }
  return vars ? { vars: vars } : undefined;
}
if (typeof window !== 'undefined') { window._bfSubstituteVars = _bfSubstituteVars; window._bfEvalScope = _bfEvalScope; }

// R13-M: quando una variabile String viene iniettata dentro un'espressione da passare a
// safeEvaluate (condizioni, Assegna, incrementi For), va quotata+escaped -- altrimenti il
// testo sostituito finisce come identificatore "nudo" e safeEvaluate lo rifiuta con
// "identificatore non permesso" (es. y = x con x stringa "hi" diventava l'espressione
// invalida "hi" invece della stringa valida 'hi'). Numeri/bool restano semplicemente
// stringificati come prima (nessuna regressione sui flow numerici esistenti).
function _varValueForExpr(v) {
    if (typeof v.value === 'string') return "'" + v.value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    // WP-M2 (Ismail 2026-07-20, tipo Array): un array si serializza come LETTERALE [e1,e2,...]
    // (safeEval.js lo riparsa in un vero array): cosi' `a[i]`, `a.length`, `b = a` funzionano
    // con la STESSA sostituzione testuale di ogni altro campo (stringhe interne quotate+escaped).
    if (Array.isArray(v.value)) {
        return '[' + v.value.map(function (el) {
            if (typeof el === 'string') return "'" + el.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
            return String(el);
        }).join(',') + ']';
    }
    return v.value.toString();
}

// WP-N7 (Ismail 2026-07-15): usare in un'espressione una variabile DICHIARATA ma NON
// inizializzata (flag `uninit`, impostato in variables.js quando si dichiara senza valore)
// e' un ERRORE ("variabile non inizializzata"), non deve valere 0. Ritorna il NOME della
// prima variabile uninit effettivamente REFERENZIATA in `exp` (confine di parola, stesso
// criterio delle sostituzioni R13-M), oppure null. Il chiamante, se != null, chiama
// throwError(errMsg('err_uninit_var', {n, v})) e ferma l'esecuzione del nodo -- cosi'
// l'errore non passa dalla valutazione (che tratterebbe l'uninit come 0/"").
// WP-M5j (Ismail 2026-07-21, screenshot: `a[i] = 'a'+1` -> «la variabile "a" non è stata
// inizializzata», con `a` dichiarata senza "Assegna"): STESSO difetto gia' corretto in
// WP-M5h per la sostituzione, in una seconda funzione. Il controllo cercava il nome con
// `\bnome\b` su tutto il testo: con una variabile di nome `a`, la `a` DENTRO il letterale
// `'a'` veniva contata come un uso della variabile. Il programma non stava leggendo `a`:
// stava scrivendo `a[i]` e usando la stringa costante 'a' a destra.
// Ora si estraggono gli identificatori REALI con lo stesso criterio dello scanner di
// sostituzione: quel che sta dentro le virgolette non e' un identificatore, e nemmeno un
// membro dopo il punto. Le due funzioni devono per forza vedere l'espressione allo stesso
// modo -- se una crede che ci sia una variabile e l'altra no, si ottengono errori fantasma
// esattamente come questo.
function _bfIdentifiersIn(exp) {
    const s = String(exp);
    const out = [];
    let i = 0;
    while (i < s.length) {
        const ch = s[i];
        if (ch === '"' || ch === "'") { // letterale stringa: si salta per intero
            const q = ch; let j = i + 1;
            while (j < s.length) {
                if (s[j] === '\\' && j + 1 < s.length) { j += 2; continue; }
                if (s[j] === q) { j++; break; }
                j++;
            }
            i = j; continue;
        }
        if (/[A-Za-z_]/.test(ch)) {
            let j = i, id = '';
            while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) { id += s[j]; j++; }
            const prev = (i > 0) ? s[i - 1] : '';
            if (prev !== '.') out.push(id); // Math.floor -> "floor" non e' un identificatore libero
            i = j; continue;
        }
        i++;
    }
    return out;
}
function _bfUninitUsedIn(exp, variables) {
    if (exp === null || exp === undefined || !Array.isArray(variables)) return null;
    const ids = _bfIdentifiersIn(exp);
    if (!ids.length) return null;
    for (let i = 0; i < variables.length; i++) {
        const v = variables[i];
        if (v && v.uninit && v.name && ids.indexOf(String(v.name)) !== -1) return v.name;
    }
    return null;
}
if (typeof window !== 'undefined') window._bfIdentifiersIn = _bfIdentifiersIn;

// R13-M: sostituzione variabili "token-aware" per le condizioni (if/while/do/for).
// PRIMA: uno scan carattere-per-carattere trattava OGNI carattere che non fosse una cifra
// ne' uno tra "+-*/<>!=.()" come inizio di un nome di variabile -- operatori a piu'
// caratteri come && || % ?: finivano quindi inglobati in un identificatore inesistente
// (es. "&&" diventava una presunta variabile "&&", mai dichiarata -> errore). safeEvaluate
// (safeEval.js) supporta gia' && || % ternario, Math.* e true/false: il problema era SOLO
// qui. ORA: si riconoscono solo due "isole" -- stringhe quotate (copiate verbatim, mai
// sostituite dentro: permette name == "Mario") e identificatori (variabili dichiarate ->
// sostituite col valore via _varValueForExpr; membri dopo un punto come Math.floor, o le
// parole chiave true/false/null/Math, lasciati passare invariati) -- tutto il resto
// (operatori, spazi, cifre, parentesi) attraversa lo scan senza essere toccato, cosi'
// safeEvaluate vede l'espressione originale intatta.
function checkCondition(condition, variables) {
    const s = String(condition);
    let expression = "";
    let i = 0;
    while (i < s.length) {
        const ch = s[i];
        if (ch === '"' || ch === "'") {
            const quote = ch;
            let j = i + 1, lit = ch;
            while (j < s.length) {
                lit += s[j];
                if (s[j] === '\\' && j + 1 < s.length) { lit += s[j + 1]; j += 2; continue; }
                if (s[j] === quote) { j++; break; }
                j++;
            }
            expression += lit; i = j; continue;
        }
        if (/[A-Za-z_]/.test(ch)) {
            let j = i, id = "";
            while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) { id += s[j]; j++; }
            const isMember = expression.length > 0 && expression[expression.length - 1] === '.';
            if (isMember || id === 'true' || id === 'false' || id === 'null' || id === 'Math') {
                expression += id;
            } else {
                if (!existVariable(id, variables)) {
                    throwError(errMsg('err_not_declared', {v: id}));
                    return {};
                }
                const v = getVariable(id, variables);
                // WP-N7: variabile dichiarata ma non inizializzata usata in una condizione -> errore.
                if (v && v.uninit) { throwError(errMsg('err_uninit_var', {n: (typeof executingNodeIndex !== 'undefined' && executingNodeIndex >= 0 ? executingNodeIndex : ''), v: id})); return {}; }
                // WP-M5k: stessa regola dello scanner di sostituzione -- l'array resta un
                // nome e viaggia per riferimento nell'ambiente, gli scalari si incollano.
                if (Array.isArray(v.value)) expression += id;
                else expression += _varValueForExpr(v);
            }
            i = j; continue;
        }
        expression += ch; i++;
    }

    try {
        if(!isNaN(expression)){
          return !!safeEvaluate(expression, _bfEvalScope(variables));
        }else{
          return safeEvaluate(expression, _bfEvalScope(variables));
        }
    } catch (e) {
        const _n = (typeof executingNodeIndex !== 'undefined' ? executingNodeIndex : '');
        // P2.2: divisione per zero anche dentro una condizione -> messaggio chiaro.
        if (e && e.message === '__DIV0__') {
            throwError(errMsg('err_div_zero', {n: _n}));
            return {};
        }
        // WP-M5b (Ismail 2026-07-21, audit array): gli errori di INDICE erano tradotti in
        // ogni altro blocco (Assegna, Input, Output, incrementi del For) ma NON qui -- e
        // questo e' il punto dove si sbaglia piu' spesso, perche' e' dove sta il test di un
        // ciclo (`while a[i] > 0`, con i che alla fine esce dai limiti). Il marcatore interno
        // arrivava all'utente grezzo: "Nella condizione: [1,2,3][5] > 0. __IDXRANGE__:5:3".
        // Ora passa dallo stesso traduttore di tutti gli altri blocchi.
        if (e && /^__IDX/.test(String(e.message))) {
            throwError(_evalErrMsg(e, _n, 'err_condition'));
            return {};
        }
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
      // Ismail 2026-07-20: nuovo tipo Boolean -- stesso pattern retry-on-error di int/float
      // sopra. Accetta SOLO "true"/"false" (case-insensitive, spazi tollerati), coerente con
      // l'unico modo in cui un booleano si scrive nel linguaggio (safeEval.js riconosce solo
      // i letterali true/false). Ritorna un vero JS boolean, non una stringa.
      case "bool": {
        const _b = String(input).trim().toLowerCase();
        if (_b !== "true" && _b !== "false") {
          throwError(errMsg('err_input_bool'));
          feedback();
          return inputVariable(name, type);
        }
        printMessage(input);
        return (_b === "true");
      }
    }
  } else {
    return null;
  }
}

// WP-M2 (Ismail 2026-07-20, tipo Array): input di un ARRAY INTERO -- l'utente scrive gli
// elementi separati da virgola (es. "1, 2, 3"). Ogni elemento viene validato col tipo degli
// elementi (stesse regole di inputVariable); un elemento invalido = retry, come per gli
// scalari. WP-M3: `expected` = dimensione DICHIARATA in tabella -- il numero di elementi
// deve combaciare ESATTAMENTE (retry con messaggio dedicato se no).
async function inputArrayVariable(name, elemType, expected) {
  const input = await askUserInput();
  if (input === null) return null;
  const feedback = () => {
      document.getElementById('console-input').classList.add('input-error');
      setTimeout(() => document.getElementById('console-input').classList.remove('input-error'), 500);
    };
  const rawParts = String(input).split(',').map(function (p) { return p.trim(); });
  if (typeof expected === 'number' && expected >= 0 && rawParts.length !== expected) {
    throwError(errMsg('err_input_array_size', {want: expected}));
    feedback();
    return inputArrayVariable(name, elemType, expected);
  }
  const out = [];
  for (let i = 0; i < rawParts.length; i++) {
    const p = rawParts[i];
    if (elemType === 'int') {
      if (!/^-?\d+$/.test(p)) { throwError(errMsg('err_input_array', {type: elemType})); feedback(); return inputArrayVariable(name, elemType, expected); }
      out.push(parseInt(p, 10));
    } else if (elemType === 'float') {
      if (p === '' || isNaN(p)) { throwError(errMsg('err_input_array', {type: elemType})); feedback(); return inputArrayVariable(name, elemType, expected); }
      out.push(parseFloat(p));
    } else if (elemType === 'bool') {
      const _b = p.toLowerCase();
      if (_b !== 'true' && _b !== 'false') { throwError(errMsg('err_input_array', {type: elemType})); feedback(); return inputArrayVariable(name, elemType, expected); }
      out.push(_b === 'true');
    } else {
      out.push(p); // string: sempre valida (le virgole DENTRO una stringa non sono supportate qui)
    }
  }
  printMessage(input);
  return out;
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
  // WP-M (Ismail 2026-07-20): su MOBILE, senza una preferenza gia' salvata dall'utente, il
  // terminale parte "unzoomato di 2" scatti (2 x 0.15 = scala 0.7) cosi' copre meno spazio.
  // Se l'utente ha gia' regolato il suo zoom (chiave presente), quella scelta vince.
  else if (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)').matches) {
    consoleFontScale = 0.7;
  }
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
  // WP-M (Ismail 2026-07-20): range ampliato (era 0.6..2.4) -- "aumentare zoom/unzoom max".
  consoleFontScale = Math.max(0.4, Math.min(3.2, +(consoleFontScale + delta).toFixed(2)));
  applyConsoleFontScale();
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('baseflow-console-font-scale', String(consoleFontScale)); } catch (e) {}
}
function consoleFontReset() {
  consoleFontScale = 1;
  applyConsoleFontScale();
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('baseflow-console-font-scale', '1'); } catch (e) {}
}
// WP-M (Ismail 2026-07-20): PINCH a 2 dita sul terminale = zoom del CARATTERE della console
// (consoleFontScale, stessi limiti dei pulsanti +/-), MAI della pagina. preventDefault sul
// touchmove a 2 dita blocca il pinch nativo del browser solo dentro il terminale.
(function () {
  if (typeof document === 'undefined' || !document.getElementById) return;
  const wire = function () {
    const el = document.getElementById('console-popup');
    if (!el || el._bfPinchWired) return;
    el._bfPinchWired = true;
    let d0 = 0, s0 = 1;
    const dist = function (e) { return Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY); };
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) { d0 = dist(e); s0 = consoleFontScale; }
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 2 || !d0) return;
      e.preventDefault();
      let ns = s0 * (dist(e) / d0);
      ns = Math.max(0.4, Math.min(3.2, +ns.toFixed(2)));
      if (ns !== consoleFontScale) { consoleFontScale = ns; applyConsoleFontScale(); }
    }, { passive: false });
    const end = function (e) {
      if (!e.touches || e.touches.length < 2) {
        if (d0) { try { if (typeof localStorage !== 'undefined') localStorage.setItem('baseflow-console-font-scale', String(consoleFontScale)); } catch (err) {} }
        d0 = 0;
      }
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
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
    // R13-J (Ismail 2026-07-12): Svuota e' una MODIFICA come le altre, non un salvataggio
    // implicito. PRIMA: clearHistory() cancellava TUTTO l'undo/redo (impossibile tornare
    // indietro) e poi saved=true spegneva il pallino come se il contenuto vuoto fosse gia'
    // sul file -- incoerente (Ctrl+Z, se fosse stato disponibile, avrebbe riportato il
    // vecchio grafo, a quel punto DAVVERO non salvato: lo stato mentiva). ORA: pushHistory()
    // salva uno snapshot del grafo PRIMA di svuotarlo (stesso pattern di ogni altra modifica
    // -- Undo disponibile, la cronologia non si tronca, solo il redo si azzera come sempre
    // per una nuova azione), poi saved=false (il pallino si accende: il canvas vuoto non e'
    // ancora scritto sul file). currentFileName NON si tocca: si sta ancora lavorando su
    // quel file, solo svuotato.
    if (typeof pushHistory === 'function') pushHistory();
    flow = { nodes: [ { type: 'start', info: '', next: '1' }, { type: 'end', info: '', next: null } ], variables: [] };
    nodi = [
      { relX: 0.35, relY: 0.05, width: 100, height: 40, color: 'white', text: 'Start' },
      { relX: 0.35, relY: 0.4, width: 100, height: 40, color: 'white', text: 'End' }
    ];
    // WP-M (Ismail 2026-07-20): "Nuovo file" rimosso dalla toolbar (doppione) -- Svuota ora
    // copre anche quel caso: azzera identita' del progetto (nome/autore/handle) come farebbe
    // un reload, cosi' il prossimo Salva chiede nome nuovo e l'header torna "Senza nome".
    // Il pushHistory sopra resta: il CONTENUTO del grafo e' comunque recuperabile con Ctrl+Z.
    currentFileName = null;
    currentAuthor = null;
    currentFileHandle = null;
    saved = true; // stato "progetto nuovo": come all'avvio, pallino spento
    if (typeof calcoloY === 'function') calcoloY(nodi);
    if (typeof draw === 'function') draw(nodi);
    if (typeof markSaved === 'function') markSaved();
    if (typeof updateProjectIdentity === 'function') updateProjectIdentity();
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
// B2 (round 11): limite tecnico del browser -- questo popup e' NATIVO e non stilizzabile (i browser
// lo impongono per sicurezza). Resta come ultima rete per chiusura tab/refresh dalla UI del browser;
// Ctrl+R, Cmd+R e F5 sono gia' intercettati IN-APP con dialog stilizzato (init.js). window._bfBypassUnload
// e' settato dai reload GIA' confermati con quel dialog, per evitare il doppio avviso (stilizzato + nativo).
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('beforeunload', function (e) {
    try {
      if (window._bfBypassUnload) return;
      const dirty = isDirty() && !(typeof isEmpty === 'function' && isEmpty());
      if (dirty) { e.preventDefault(); e.returnValue = ''; return ''; }
    } catch (_) {}
  });
}

// P (round 15, richiesta Ismail): il pallino "non salvato" ora si basa su un HASH del grafo,
// non solo sul flag booleano `saved`. Cosi', se si torna allo stato SALVATO (undo, o modifiche
// manuali che riportano alla disposizione iniziale), il pallino si SPEGNE, invece di restare
// acceso solo perche' "c'e' stata una modifica". markSaved() fissa l'hash di riferimento:
// va chiamata dopo un salvataggio riuscito, all'apertura di un file e all'avvio/nuovo progetto.
var _bfSavedHash = null;
function hashFlow() {
  try {
    if (typeof flow === 'undefined' || !flow || !Array.isArray(flow.nodes)) return '';
    const nodes = flow.nodes.map(function (n) { return n ? { t: n.type, i: n.info, x: n.next, nl: n.newline } : null; });
    const vars = (Array.isArray(flow.variables) ? flow.variables : []).map(function (v) { return v ? { n: v.name, t: v.type, v: v.value } : null; });
    const s = JSON.stringify({ n: nodes, v: vars });
    let h = 5381;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) | 0; }
    return String(h >>> 0);
  } catch (e) { return ''; }
}
function markSaved() { _bfSavedHash = hashFlow(); }
function isDirty() {
  // Prima che un riferimento sia fissato (primissimo avvio), ripiega sul flag `saved`.
  if (_bfSavedHash === null) return (typeof saved !== 'undefined') ? !saved : false;
  return hashFlow() !== _bfSavedHash;
}
if (typeof window !== 'undefined') { window.markSaved = markSaved; window.isDirty = isDirty; window.hashFlow = hashFlow; }

// Sincronizza l'indicatore "modifiche non salvate" (pallino in header) con lo stato reale (hash).
function syncUnsavedIndicator() {
  const el = (typeof document !== 'undefined') ? document.getElementById('unsaved-indicator') : null;
  if (!el) return;
  const dirty = isDirty(); // P: hash-based -- clear canvas resta "sporco", undo-a-salvato torna pulito
  if (dirty) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
  // R13-D: il pallino ora vive DENTRO #project-identity (index.html) -- lo stato "sporco"
  // aggiorna anche il tooltip del blocco intero, non solo la sua visibilita'.
  if (typeof updateProjectIdentity === 'function') updateProjectIdentity();
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', function () {
    try { setInterval(syncUnsavedIndicator, 600); } catch (e) {}
  });
}

// R13-D (Ismail 2026-07-12): riga "NomeProgetto — Autore" nell'header (#project-identity),
// letta da currentFileName/currentAuthor (state.js). Richiamata da syncUnsavedIndicator (gia'
// in polling ogni 600ms, cosi' resta fresca senza dover intercettare OGNI singolo punto che
// tocca i due nomi) e direttamente dopo load/save/nuovo progetto per un aggiornamento immediato
// (niente attesa del prossimo tick di polling). Tooltip sull'intero blocco: nome completo +
// autore + stato salvataggio, tradotto (i18n).
function updateProjectIdentity() {
  if (typeof document === 'undefined') return;
  const txt = document.getElementById('project-identity-text');
  const wrap = document.getElementById('project-identity');
  if (!txt && !wrap) return;
  const t = function (k, fb) { return (typeof i18nText === 'function' && i18nText(k)) || fb; };
  const rawName = (typeof currentFileName === 'string' && currentFileName)
    ? currentFileName.replace(/\.json$/i, '')
    : t('untitled_project', 'Untitled');
  const rawAuthor = (typeof currentAuthor === 'string' && currentAuthor)
    ? currentAuthor
    : t('unknown_author', 'Unknown author');
  // S7 P7.1 (round 15-B, Ismail 2026-07-15, "[= R14-B parte]"): tronca nome/autore PRIMA di
  // comporre il testo VISIBILE, cosi' l'ellissi CSS (#project-identity-text, style.css:
  // overflow:hidden/text-overflow:ellipsis/white-space:nowrap) non taglia mai una parola a
  // meta' (es. "Autore sconosciuto" -> "Autore scon..."). Riusa lo stesso truncateName()
  // gia' introdotto da R14-B.3 (popups.js) per showUnsavedDialog/saveFileAs -- qui si
  // applica SOLO al testo visibile: il tooltip (data-tip sotto) resta sui valori INTERI
  // (rawName/rawAuthor) apposta, e' li' che l'utente legge nome/autore completi al hover.
  // WP-N12 (round 15-C, Ismail 2026-07-15): limiti alzati (24->30 / 20->24) per sfruttare
  // lo spazio maggiore ora dato a #project-identity in style.css (max-width 30ch->58ch) --
  // vedi anche il fix li' che, se lo spazio sulla riga della toolbar non basta comunque,
  // fa andare il blocco a capo invece di schiacciarlo/nasconderlo (min-width 0->14ch, tolto
  // il display:none sotto i 900px).
  const name = (typeof truncateName === 'function') ? truncateName(rawName, 30) : rawName;
  const author = (typeof truncateName === 'function') ? truncateName(rawAuthor, 24) : rawAuthor;
  if (txt) txt.textContent = name + ' — ' + author;
  if (wrap) {
    const dirty = isDirty();
    const stateTxt = dirty ? t('unsaved_dot', 'Unsaved changes') : t('saved_state', 'Saved');
    // R14-B.2 (Ismail 2026-07-13): data-tip (non piu' title) -- letto live dal tooltip
    // istantaneo di js/core/ux.js (stesso meccanismo dei pulsanti .bf-icon, niente
    // ritardo del sistema operativo). Il "title" nativo restava a volte con la
    // traduzione statica sbagliata finche' applyLanguage() non veniva rieseguito
    // (data-i18n-title), oltre al ritardo OS -- entrambi i problemi spariscono qui
    // perche' data-tip non e' mai toccato da applyLanguage().
    wrap.setAttribute('data-tip', rawName + ' — ' + rawAuthor + ' — ' + stateTxt);
  }
}
if (typeof window !== 'undefined') window.updateProjectIdentity = updateProjectIdentity;

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
  // WP-6/R13-I (2026-07-19): mouse -> Pointer Events, il popup si trascina anche a dito
  // (prima su touch il drag non partiva mai: niente mousemove continuo durante il gesto).
  el.addEventListener('pointerdown', function (e) {
    if (el.classList.contains('docked')) return;            // solo popup sganciato
    if (e.isPrimary === false) return;
    if (e.target.closest('button, input, select, textarea, a, #console-output, #console-settings-panel, #console-resize-handle')) return;
    const r = el.getBoundingClientRect();
    el.style.left = r.left + 'px'; el.style.top = r.top + 'px';
    el.style.transform = 'none'; el.style.margin = '0';
    dragging = true; ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
    el.classList.add('dragging'); e.preventDefault();
  });
  window.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    let nx = ox + (e.clientX - sx), ny = oy + (e.clientY - sy);
    nx = Math.max(0, Math.min(window.innerWidth - 60, nx));
    ny = Math.max(0, Math.min(window.innerHeight - 40, ny));
    el.style.left = nx + 'px'; el.style.top = ny + 'px';
  });
  const _bfConsDragEnd = function () {
    if (!dragging) return;
    dragging = false; el.classList.remove('dragging');
  };
  window.addEventListener('pointerup', _bfConsDragEnd);
  window.addEventListener('pointercancel', _bfConsDragEnd); // WP-6: gesto touch interrotto
})();

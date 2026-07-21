let canvas = document.getElementById("canvas"); // Elemento canvas del DOM
let ctx = canvas.getContext("2d"); // Contesto di disegno 2D del canvas
let container = document.getElementById("canvas-container"); // Contenitore del canvas

canvas.width = container.offsetWidth; // Larghezza del canvas impostata come la larghezza del suo contenitore
canvas.height = container.offsetHeight; // Altezza del canvas impostata come l'altezza del suo contenitore
let w = canvas.width; // Larghezza del canvas
let h = canvas.height; // Altezza del canvas

const NODE_BASE_HEIGHT_PX = 40; // Altezza base di un nodo in pixel

// Spaziature del layout in PIXEL FISSI. calcoloY calcola posizioni assolute in px
// (indipendenti dalla dimensione del canvas) e poi converte in relX/relY dividendo
// per la dimensione corrente: cosi' la forma del grafo non cambia col resize.
// FIX round-4 (Ismail 2026-07-06, "refactoring grafico": il grafo diventa troppo
// grande/lungo sia quando i rami/corpi sono VUOTI sia quando ci sono annidamenti --
// tutte le costanti sotto sono state ridotte in proporzione (~25-40% in meno) per
// un layout piu' compatto, SENZA toccare le FORMULE/l'algoritmo (stessa geometria,
// stesse regole di non-sovrapposizione con etichette e archi -- solo i numeri sono
// piu' piccoli). BACKEDGE_SEP_PX (sotto) e LOOP_BACKEDGE_GAP_PX/LOOP_DO_CHECK_GAP_PX
// NON toccati: sono stati tarati appena per il fix P11 (etichetta/back-edge) e per
// la geometria capovolta del Do-While, un'ulteriore riduzione li' rischierebbe di
// far tornare le sovrapposizioni gia' risolte.
const NODE_VERTICAL_SPACING_PX = 28;     // Spazio verticale tra nodi sequenziali (era 40)
// FIX round-4c (Ismail 2026-07-06, "sopra il blocco start c'e' un margine bianco che ne
// copre una parte"): la posizione Y iniziale di Start in calcoloY (layout.js) usava
// NODE_VERTICAL_SPACING_PX/2 come "margine dall'alto del canvas" -- coincidenza
// innocua quando lo spacing valeva 40 (meta' = 20 = meta' altezza nodo, quindi il
// bordo superiore del box finiva esattamente a Y=0), ma con lo spacing ridotto a 28
// (round-4) meta' fa 14 < 20 (meta' altezza nodo): il bordo superiore del box finiva
// a Y=-6, cioe' 6px SOPRA il canvas -- tagliato/coperto dallo sfondo bianco fuori dal
// canvas. Costante dedicata, disaccoppiata dallo spacing fra nodi: deve restare
// SEMPRE >= NODE_BASE_HEIGHT_PX/2 per non tagliare il primo nodo.
const CANVAS_TOP_MARGIN_PX = NODE_BASE_HEIGHT_PX / 2 + 6; // + 6px: il bordo superiore (2px) di Start non tocca/oltrepassa il bordo del canvas (rilievo 21)
// FIX round-4r (Ismail 2026-07-06, screenshot: "guarda IF, vedi che distanza in alto e'
// molto minore rispetto a distanza arco in basso del Print? ... guarda dentro l'arco di
// destra quando ho messo il Print, vedi che pezzo di arco sopra Print e' piu' corto
// rispetto al pezzo arco sotto Print?"): round-4q aveva reso uguali i due gap TOTALI
// (rombo->nodo e nodo->ricongiunzione, entrambi 22px) ma NON le due tratte
// EFFETTIVAMENTE CLICCABILI -- forkY = diaBottom + IF_BRANCH_START_Y_OFFSET_PX/2
// spezzava il gap sopra in DUE pezzi (uno stelo NON cliccabile rombo->forkY, poi
// l'arco CLICCABILE if_true/if_false forkY->nodo, ciascuno meta' del totale, 11px), mentre
// sotto l'INTERO gap (nodo->ricongiunzione, 22px) e' UN SOLO arco cliccabile senza
// interruzioni. Risultato: l'arco cliccabile sopra (11px) appariva letteralmente la META'
// di quello sotto (22px) -- esattamente cio' che lo screenshot mostra, anche se i gap
// TOTALI (che includono lo stelo invisibile) restavano uguali per il calcolo di Test 41/47.
// Fix: si separano le due responsabilita' in due costanti indipendenti invece di una sola
// derivata dall'altra. IF_RECONNECT_GAP_PX torna un valore LETTERALE (fonte di verita':
// e' la lunghezza voluta per l'arco cliccabile "dopo l'ultimo nodo", MAI cambiata in
// questo fix) e IF_FORK_STEM_PX e' un nuovo stelo FISSO, piccolo ma sempre ben visibile
// (mai piu' un frazionamento proporzionale che puo' rimpicciolirsi troppo, causa della
// regressione round-4o/4p). IF_BRANCH_START_Y_OFFSET_PX diventa DERIVATO da questi due
// (stelo + arco cliccabile), non piu' il contrario: cosi' l'arco cliccabile sopra
// (branchTop - forkY = IF_BRANCH_START_Y_OFFSET_PX - IF_FORK_STEM_PX = IF_RECONNECT_GAP_PX
// per costruzione) e' SEMPRE identico, in lunghezza, all'arco cliccabile sotto
// (IF_RECONNECT_GAP_PX) -- qualunque valore assumano i due pezzi in futuro.
const IF_RECONNECT_GAP_PX = 22;          // Spazio (e lunghezza dell'arco cliccabile "dopo l'ultimo nodo") tra fondo del ramo piu' lungo e ricongiunzione
const IF_FORK_STEM_PX = 10;              // Stelo verticale FISSO, sempre visibile, tra il rombo e la biforcazione T/F (NON piu' proporzionale, round-4r)
const IF_BRANCH_START_Y_OFFSET_PX = IF_FORK_STEM_PX + IF_RECONNECT_GAP_PX; // DERIVATO (round-4r): garantisce che l'arco cliccabile fork->nodo sia lungo ESATTAMENTE come IF_RECONNECT_GAP_PX
const IF_JOIN_GAP_PX = 28;               // Spazio tra ricongiunzione e nodo successivo all'IF (era 40)
// R13-G (Ismail 2026-07-12) + P6.1 (round 15-B S6, Ismail 2026-07-15): gap in px fra il
// pallino di ricongiunzione di un IF e QUALSIASI arco che lo tocca -- le due frecce
// orizzontali che vi convergono dall'alto (rendering.js/drawBranchConnections) e l'arco che
// ne ESCE verso il basso, sia quando l'IF disegna la propria uscita da solo
// (drawIfBranches) sia quando -- essendo l'ULTIMO membro del ramo di un IF antenato o del
// corpo di un ciclo -- e' l'ANTENATO a disegnare quel tratto partendo dal SUO pallino
// (drawBranchConnections/fromY, drawLoopBranches/stubTopY, drawDoWhileBranches/bodyBottomY,
// tutti i casi 'lastIsIf'). Costante GLOBALE (principio N5, una sola fonte di verita'):
// usata da 3 funzioni di rendering diverse, non puo' restare una copia locale.
const JOIN_DOT_GAP_PX = 5;
const IF_BRANCH_X_OFFSET_PX = 115;        // Distanza orizzontale dei rami true/false dal centro (era 120) -- si moltiplica per livello di annidamento, la riduzione qui e' quella che pesa di piu' sui grafi annidati
// FIX round-4i (Ismail 2026-07-06, "stessa cosa succede anche dentro if" -- riferito
// all'asimmetria sopra/sotto gia' vista per While/For/Do-While): quando un ramo di un
// IF e' VUOTO e l'altro ha un solo nodo, i due rami CONTRIBUISCONO diversamente alla
// ricongiunzione condivisa (reconnectPxY = max(trueDepth,falseDepth) + IF_RECONNECT_
// GAP_PX in layout.js): un ramo popolato con un nodo contribuisce
// nodeHeight(40)+IF_RECONNECT_GAP_PX(20)=60 oltre a branchTop, mentre un ramo VUOTO
// contribuiva IF_EMPTY_BRANCH_LEN_PX(50)+IF_RECONNECT_GAP_PX(20)=70 -- 10px in piu'.
// Il ramo vuoto "vinceva" il max() e trascinava la ricongiunzione 10px piu' in basso
// del necessario, facendo apparire l'UNICO blocco reale (nell'altro ramo) come se
// avesse un gap sotto (~30px, misurato) molto maggiore di quello sopra (22px,
// IF_BRANCH_START_Y_OFFSET_PX) -- stessa famiglia di bug del round-4e (While/For) e
// round-4f/4g (Do-While), ma qui la causa e' il confronto fra rami anziche' un
// singolo gap fisso. Fix: ridotto a 40 (= NODE_BASE_HEIGHT_PX) cosi' un ramo vuoto
// contribuisce ESATTAMENTE quanto un ramo con un nodo reale (40+20=60 in entrambi i
// casi) -- il gap sotto un blocco reale torna a ~20px, quasi identico ai 22px sopra
// (differenza di soli 2px, per costruzione fra le due costanti, non percepibile).
// Resta ampiamente cliccabile (40px di arco verticale sul ramo vuoto).
const IF_EMPTY_BRANCH_LEN_PX = 40;

// Cicli (While/For/Do): il corpo sta SEMPRE nella stessa colonna del nodo ciclo (a
// differenza dell'IF non c'e' un secondo ramo da scostare lateralmente), l'uscita
// (next.false) prosegue dritta in basso nella stessa colonna dopo il corpo. Serve
// pero' un piccolo scostamento laterale riservato per la curva del back-edge che
// torna dal fondo del corpo su alla condizione (vedi collectLoopBody/layoutNode).
// N1 (review Fable, 2026-07-04 notte-4): ridotto da 30 a 10. Il segmento del corpo
// parte visivamente da 'cy' (il vertice destro dell'esagono, a META' altezza -- voluto,
// vedi drawLoopBranches/DECISIONS: e' la geometria "a screenshot" richiesta da Ismail),
// non da 'diaBottom' (bordo inferiore) come il fork di un IF. A parita' di offset (30),
// la distanza VISIVA totale dal vertice al primo nodo del corpo era quindi 20px in piu'
// (mezza altezza nodo) di quella equivalente per un IF, dando la sensazione "il blocco
// e' troppo in basso" segnalata da Ismail. Con 10 la distanza visiva totale torna a
// 30px (10 + 20 di mezza altezza), uguale a quella di un IF. Verificare a occhio nel
// browser (nessun cambio di X, solo Y): se risultasse ancora percepito come sbagliato,
// e' un valore facile da ritoccare, non serve altra modifica strutturale.
// Usata SOLO da While/For (il Do-While ha un proprio offset dedicato,
// LOOP_DO_CHECK_GAP_PX, riusato anche per il gap "sopra" -- vedi layoutDoWhileNode --
// cosi' i suoi due gap sono UGUALI per costruzione, invece di dover tenere sincronizzate
// due costanti condivise anche con While/For, che non hanno lo stesso vincolo).
const LOOP_BODY_START_Y_OFFSET_PX = 10;  // Spazio tra il ciclo e l'inizio del corpo (solo While/For)
const LOOP_EXIT_GAP_PX = 28;             // Spazio tra fondo del corpo e nodo successivo al ciclo (come IF_JOIN_GAP_PX, era 40)
const LOOP_EMPTY_BODY_LEN_PX = 50;       // Lunghezza extra (px) del corpo VUOTO: spazio per il primo inserimento (come IF_EMPTY_BRANCH_LEN_PX, era 85)
// GEOMETRIA While rivista (2026-07-04 notte-2, richiesta di Ismail + review Fable):
// il corpo sta a DESTRA (come il ramo true di un IF, non piu' nella stessa colonna),
// l'uscita resta dritta in giu nella colonna principale, il back-edge (non cliccabile)
// e' una polilinea stretta appena a fianco della verticale di uscita.
// FIX round-4b (Ismail 2026-07-06, "guarda cosa succede se metti un do annidato a un
// while con le tue modifiche" -- screenshot: due linee verticali quasi coincidenti fra
// While e Do): quando un Do-While e' l'UNICO/primo membro del corpo di un altro ciclo,
// esistono DUE colonne di back-edge distinte vicine fra loro: quella del ciclo
// ESTERNO (cx_esterno + BACKEDGE_SEP_PX, a destra della sua colonna d'uscita) e quella
// del Do-While ANNIDATO stesso (diaLeft_interno - BACKEDGE_SEP_PX, a SINISTRA del suo
// esagono -- unico caso fra i cicli in cui il back-edge sta a sinistra, vedi
// drawDoWhileBranches). Riducendo LOOP_BODY_X_OFFSET_PX in coppia con IF_BRANCH_X_OFFSET_PX
// (120->90) queste due colonne finivano quasi sovrapposte (gap negativo, -4px con
// nodi larghezza standard 100), dando l'aspetto di due linee "annodate" invece di un
// singolo back-edge pulito. Non e' un problema di IF (i rami IF non hanno questo
// doppio back-edge), quindi si disaccoppia da IF_BRANCH_X_OFFSET_PX invece di
// riabbassare la compattezza degli IF: 115 lascia un margine di ~20px fra le due
// colonne coi nodi a larghezza standard (50 mezza-larghezza + 22+22 back-edge = 94,
// +20 margine = 114).
const LOOP_BODY_X_OFFSET_PX = 115; // colonna del corpo dei cicli (disaccoppiato da IF, vedi nota sopra)
// FIX P11 (segnalato da Ismail su prova12.json: l'etichetta "Done"/exit del ciclo
// esterno si sovrapponeva visivamente all'arco di back-edge quando l'ultimo membro
// del corpo e' un ciclo/Do-While annidato -- entrambi ancorati vicino a cx/diaBottom
// con solo ~29px di distanza totale fra label e colonna dell'arco). Era 15, alzato a
// 22 per allontanare la colonna del back-edge dall'etichetta (vedi anche l'offset
// dell'etichetta stessa in rendering.js, spostato da cx-14 a cx-20).
const BACKEDGE_SEP_PX = 22;               // distanza orizzontale tra l'uscita (cx) e il back-edge di ritorno
// FIX round-4e (Ismail 2026-07-06, "quando metti un blocco in un while questo non e'
// centratissimo, si trova leggermente piu' in basso, la distanza sopra e' maggiore
// rispetto a quella di sotto... fai quello basso alto come gli altri"): il connettore
// orizzontale "corpo" parte dal vertice destro dell'esagono (diaRight, cy -- cy e' la
// META' altezza dell'esagono, non il suo bordo inferiore diaBottom), poi scende fino
// al primo nodo del corpo -- il gap VISIVO percepito sopra il blocco e' quindi
// height/2 (meta' esagono, 20px) + LOOP_BODY_START_Y_OFFSET_PX (10px) = 30px, ANCHE
// SE il gap "funzionale" rispetto al vero bordo dell'esagono resta 10px. Il back-edge
// invece riparte dal fondo REALE del corpo e risale fino a diaBottom (bordo vero, non
// il centro): il gap percepito sotto l'ultimo blocco era quindi LOOP_BACKEDGE_GAP_PX
// da solo (15px), meno della meta' del gap percepito sopra -- il blocco (o l'ultimo
// di una sequenza) appariva visivamente spostato in basso nel "riquadro" del corpo.
// Alzato a 30 per farlo coincidere esattamente col gap percepito sopra (height/2 +
// LOOP_BODY_START_Y_OFFSET_PX), qualunque sia il numero di nodi nel corpo.
const LOOP_BACKEDGE_GAP_PX = 30;          // gap verticale sotto il corpo prima della curva del back-edge (vedi nota sopra: height/2 + LOOP_BODY_START_Y_OFFSET_PX = 20+10)
// FIX round-3 (Ismail 2026-07-06, "il false del do-while si sovrappone con arco, fai
// arco sotto piu' lungo di un po'"): quando l'ULTIMO membro del corpo di un While/For
// e' un Do-While annidato, il back-edge del ciclo esterno riparte esattamente dal
// bordo inferiore dell'esagono "Do:" -- ma proprio li' sotto (diaBottom+12) c'e'
// l'etichetta di uscita "False"/"F" di quel Do-While. Con il gap normale (15px) la
// tratta ORIZZONTALE del back-edge cade sopra il testo dell'etichetta: sembra sia che
// la "False" si sovrapponga a una linea, sia che il ciclo interno non si colleghi al
// ciclo esterno (la linea di ritorno e' proprio quella connessione). Un gap piu'
// generoso SOLO in questo caso abbassa la curva sotto l'etichetta, liberandola.
const LOOP_BACKEDGE_GAP_DOWHILE_PX = 34;  // gap verticale quando l'ultimo membro del corpo e' un Do-While (spazio per la sua etichetta "False")
// FIX BUG 4 (Ismail 2026-07-05 sera): gap tra la fine del corpo e l'esagono di
// controllo di un Do-While, che nella nuova geometria sta SOTTO il corpo (non sopra
// come While/For) -- stesso ruolo di LOOP_BODY_START_Y_OFFSET_PX ma nel verso opposto.
// FIX round-4f/4g (Ismail 2026-07-06, "per il do while e' il contrario, quello sopra
// e' piu' corto di quello in basso... fagli uguali"): due problemi corretti insieme.
// (1) Un bug separato (vedi layout.js/layoutDoWhileNode) faceva si' che il gap REALE
// sotto finisse a 28px invece dei 10px dichiarati (il meccanismo generico anti-
// sovrapposizione per colonna vinceva su questo valore, essendo
// NODE_VERTICAL_SPACING_PX=28 piu' grande) -- risolto a parte (round-4f) resettando
// la prenotazione della colonna. (2) Questa stessa costante e' ora riusata ANCHE per
// il gap "sopra" del corpo di un Do-While (layoutDoWhileNode, al posto di
// LOOP_BODY_START_Y_OFFSET_PX condiviso con While/For) cosi' i due gap del Do-While
// sono uguali per costruzione. (3) Serve pero' >= 19px perche' l'etichetta "True"
// (`diaTop-12`, fix P7, testo 13px quindi ±7px di altezza) non cada dentro l'ultimo
// nodo del corpo: `labelTopEdge = lastNodeBottom + GAP_PX - 12 - 7`, che resta SOTTO
// lastNodeBottom (dentro il suo box) se GAP_PX < 19. 22 da' 3px di margine extra.
const LOOP_DO_CHECK_GAP_PX = 22;

// Dimensioni minime del canvas: sotto queste compaiono le scrollbar del
// #canvas-container invece di comprimere/deformare il grafo.
const MIN_CANVAS_W = 600;
const MIN_CANVAS_H = 400;

// Zoom dei blocchi disegnati sul canvas (scala CSS del canvas), NON zoom della pagina.
let zoom = 1;
// WP-M (Ismail 2026-07-20): range ampliato su richiesta ("aumentare zoom e unzoom massimo").
const ZOOM_MIN = 0.15;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.2;

// Palette dei nodi sul canvas, armonizzata col tema viola dell'app.
// Start/End restano verde/rosso ma in tinta; gli altri usano pastelli coerenti.
const NODE_COLORS = {
  start:  "#66bb6a",
  end:    "#ef5350",
  read:   "#b0bec5", input:  "#b0bec5",
  write:  "#90caf9", output: "#90caf9", print: "#90caf9",
  assign: "#fff59d", assignment: "#fff59d",
  if:     "#ce93d8",
  while:  "#80cbc4",
  // FIX B0 (review Fable, 2026-07-05, piano Do-While/For): tinte distinte per i due
  // nuovi tipi di ciclo, nella stessa palette pastello del resto (stesso esagono del
  // While, solo colore/etichette diversi -- vedi LOOP_LABELS sotto).
  for:    "#ffcc80",
  do:     "#9fa8da",
  // Nuovi blocchi "Tools" (Ismail 2026-07-07): non eseguibili (pass-through), solo
  // annotazione/marcatore. Comment = riquadro tratteggiato; Pause = esagono rosa.
  comment: "#fafafa",
  pause:   "#f48fb1",
  // Blocchi GRAFICA / turtle graphics (Ismail 2026-07-08, round 2, stile Flowgorithm).
  forward: "#a5d6a7",
  turn:    "#ffe082",
  home:    "#ffd54f",
  pen:     "#80deea",
  gclear:  "#cfd8dc"
};

// Etichetta visualizzata sul nodo per tipo (default: tipo capitalizzato). Serve per i blocchi
// il cui nome interno differisce dall'etichetta (es. gclear -> "Clear", forward -> "Move/Draw").
const NODE_LABELS = { forward: "Move/Draw", turn: "Turn", home: "Home", pen: "Pen", gclear: "Clear" };
function nodeText(tipo) { return NODE_LABELS[tipo] || (String(tipo).charAt(0).toUpperCase() + String(tipo).slice(1)); }
// Etichetta del nodo TRADOTTA per il canvas (Ismail 2026-07-09d): il nome mostrato sul
// blocco segue la lingua attiva. Mappa tipo -> chiave i18n coerente con la palette; fallback
// all'etichetta inglese (nodeText). i18nText potrebbe non esistere ancora al load: guardato.
const NODE_LABEL_I18N = {
  start: 'nd_start', end: 'nd_end', input: 'blk_input', print: 'blk_output', output: 'blk_output',
  assign: 'blk_assign', if: 'blk_if', while: 'blk_while', for: 'blk_for', do: 'blk_dowhile',
  comment: 'blk_comment', pause: 'blk_pause', forward: 'blk_forward', turn: 'blk_turn',
  home: 'blk_home', pen: 'blk_pen', gclear: 'blk_clearscreen'
};
function nodeDisplayLabel(tipo) {
  const key = NODE_LABEL_I18N[tipo];
  if (key && typeof i18nText === 'function') { const s = i18nText(key); if (s) return s; }
  return nodeText(tipo);
}

// Etichette dell'arco corpo (destra, "vero"/"prosegui") e dell'arco uscita (giu',
// "falso"/"fine") per ciascun tipo di ciclo -- stessa geometria a esagono per
// While/Do-While/For, cambiano solo le etichette (screenshot di Ismail, piano
// Do-While/For 2026-07-05). Centralizzate qui invece che hard-coded in
// drawLoopBranches, cosi' aggiungere un futuro tipo di ciclo richiede solo una nuova
// voce qui, non un altro if sparso nel rendering.
const LOOP_LABELS = {
  while: { body: "True", exit: "False" },
  do:    { body: "True", exit: "False" },
  for:   { body: "Next", exit: "Done" }
};
// S3 P8.4 (round 15-B, Ismail 2026-07-15): le etichette V/F/Prossimo/Fatto degli archi
// IF/ciclo erano hard-coded in inglese in rendering.js (mai tradotte, unica eccezione al
// resto della UI). LOOP_LABELS sopra resta il fallback letterale (usato se i18nText non
// e' ancora disponibile o non trova la chiave); LOOP_LABEL_I18N mappa tipo->chiave i18n,
// edgeLabelText/i18nLabel risolvono nella lingua attiva -- stesso principio di
// nodeDisplayLabel/NODE_LABEL_I18N sopra.
function i18nLabel(key, fallback) {
  if (key && typeof i18nText === 'function') { const s = i18nText(key); if (s) return s; }
  return fallback;
}
const LOOP_LABEL_I18N = {
  while: { body: 'label_true', exit: 'label_false' },
  do:    { body: 'label_true', exit: 'label_false' },
  for:   { body: 'label_next', exit: 'label_done' }
};
function edgeLabelText(loopType, which) {
  const map = LOOP_LABEL_I18N[loopType];
  const fallback = (LOOP_LABELS[loopType] && LOOP_LABELS[loopType][which]) || (which === 'body' ? 'True' : 'False');
  return i18nLabel(map && map[which], fallback);
}
// Colori delle etichette dei rami IF (coerenti ovunque).
const IF_LABEL_TRUE_COLOR = "#2e7d32";  // T = verde scuro
const IF_LABEL_FALSE_COLOR = "#c62828"; // F = rosso scuro

// Ridimensiona il canvas per adattarsi dinamicamente al contenuto dei nodi.
let saved; // Flag per indicare se ci sono modifiche non salvate nel flowchart
// B3 (round 11): "Salva" riusa nome/handle del file aperto/gia' salvato invece di richiedere
// sempre il nome (vedi saveOpen.js saveToCurrentFile). Solo il NOME e' persistito (mai un path
// completo: l'API File System Access non lo espone comunque, per privacy).
let currentFileName = null;
let currentFileHandle = null;
// WP (Ismail 2026-07-22, packaging desktop): path ASSOLUTO del file su disco, popolato SOLO
// nell'app Electron (dialog nativo, vedi fileIO.js/saveOpen.js) -- l'API File System Access del
// browser non lo espone mai (per privacy, vedi commento sopra), quindi su web/PWA resta sempre
// null e il comportamento e' invariato. Serve perche' su desktop "Salva" deve scrivere in modo
// SILENZIOSO sullo stesso file gia' aperto/salvato, invece di riaprire un dialog nativo che
// chiede di sovrascrivere (bug segnalato da Ismail: succedeva SEMPRE dopo un "Apri", perche'
// currentFileHandle -- un handle del browser -- non esiste per un file aperto via IPC nativo).
let currentFilePath = null;
// R14-A (Ismail 2026-07-13, regola confermata): il PRIMO Salva di OGNI sessione (dopo reload,
// apertura file o Nuovo -- tutti e tre azzerano questo flag per costruzione, essendo un reload
// completo della pagina) deve SEMPRE chiedere il popup nome+autore, anche se currentFileName e'
// gia' noto (es. da un file appena aperto). Diventa true SOLO dopo una SCRITTURA RIUSCITA in
// questa sessione (save()/saveToCurrentFile(), vedi saveOpen.js) -- MAI settato dall'apertura
// file (fileIO.js NON lo tocca). I Salva successivi nella stessa sessione restano silenziosi.
let savedThisSession = false;
// R13-D (Ismail 2026-07-12): identita' del progetto in elaborazione, mostrata nell'header
// (#project-identity, index.html) e scritta nel JSON salvato (campo top-level `author`,
// accanto a nodes/variables). null = non ancora noto (progetto nuovo o file vecchio senza
// autore) -> l'header mostra il default localizzato ("Autore sconosciuto"/"Unknown author"/...).
let currentAuthor = null;
// Struttura dati principale per la logica del flowchart
let flow = {
  "nodes": [ 
    { "type": "start", "info": "", "next": "1" },
    { "type": "end", "info": "", "next": null }
  ],
  "variables": [] 
};

let frecceSelected = -1; // Indice della freccia selezionata dall'utente (-1 se nessuna)
let nodoSelected = -1;   // Indice del nodo "in editing" (dialog aperto/salvaInfo) -- NON toccare la semantica (regola 8)
// C4 (round 11): selezione VISIVA a click singolo (bordo colorato), indipendente da
// nodoSelected -- che resta "nodo in editing" per compatibilita' con salvaInfo/deleteNode/
// dialogs esistenti. Il "secondo click" sullo stesso nodo selezionato apre il dialog
// (openNodeEditor), che a sua volta setta nodoSelected.
let selectedNodeIdx = -1; // Indice del nodo con bordo di selezione (-1 se nessuno)
// R12-G/Fase1 (Ismail 2026-07-12): selezione MULTIPLA (Ctrl+click), indipendente da
// selectedNodeIdx (click singolo, C4) e da nodoSelected (nodo in editing, regola 8 -- NON
// toccata). Array di indici RADICE di "unita'": un nodo semplice, oppure l'INTERO
// sottoalbero di un if/ciclo (radice + rami/corpo, impliciti -- niente markup interno da
// tracciare qui). Puo' contenere radici ANNIDATE (un nodo gia' dentro il sottoalbero di
// un'altra unita' selezionata): la deduplica (l'unita' esterna vince) avviene a valle, in
// getSelectionUnits() (interaction.js), non qui -- questo resta il registro grezzo del
// toggle Ctrl+click.
let multiSelected = [];
// R13-H (Ismail 2026-07-12), trigger passato a Shift+click semplice per S5/P4.2 (round
// 15-B, Ismail 2026-07-15): ancora del range -- indice RADICE/nodo dell'ULTIMO estremo
// cliccato (click semplice, Ctrl+click o l'estremo di un range appena completato). null =
// nessuna ancora attiva (Shift+click senza selezione precedente si comporta come una
// selezione singola). Aggiornata da clickNodo/toggleMultiSelect/rangeSelectTo
// (interaction.js), azzerata dai punti che svuotano la selezione (Esc, click su arco/spazio
// vuoto).
let _multiSelAnchor = null;
// R13-B (Ismail 2026-07-12): feedback VISIBILE per un rifiuto di spostamento/copia di
// gruppo -- prima SOLO console.warn (invisibile durante un drag reale). Flash rosso
// ~400ms sui nodi della selezione che ha causato il rifiuto, innescato da
// triggerRejectFlash() (interaction.js, chiamata da warnMoveRejected/copySelectionGroup),
// letto da draw() (rendering.js). _bfRejectFlashUntil=0 => nessun flash attivo.
let _bfRejectFlashMembers = null; // Set<number> dei nodi da evidenziare in rosso, o null
let _bfRejectFlashUntil = 0;      // Date.now() oltre il quale il flash e' scaduto
let hoverArc = null;          // Ramo/arco evidenziato al passaggio del mouse
let executingNodeIndex = -1;  // Nodo attualmente in esecuzione (step/run), evidenziato sul canvas
// R12-F (Ismail 2026-07-12): evidenziazione SEQUENZIALE start->freccia->blocco->...->end.
// Sostituisce il vecchio execEdgeFrom (execute.js): la freccia percorsa ha ora un suo stato
// dedicato, {from,to} | null, mai valorizzato INSIEME a executingNodeIndex>=0 (le due fasi si
// alternano: fase-nodo azzera executingEdge, fase-arco azzera executingNodeIndex -- vedi
// highlightExecNode/highlightExecEdge in execute.js). Letto da drawLine()/draw() in rendering.js.
let executingEdge = null;

let undoStack = []; // Cronologia per Undo (snapshot di flow+nodi)
let redoStack = []; // Cronologia per Redo

//
// --- Drag & Drop (riordino nel flusso) ---
let dragNodeIndex = -1;    // indice del nodo (in nodi/flow.nodes) attualmente trascinato
let dragOverIndex = -1;    // indice del nodo su cui e' in hover il drag (per feedback visivo)
let dragStartX = 0, dragStartY = 0; // coordinate canvas del mousedown, per soglia di attivazione drag
let dragSubtreeEnd = -1; // fine (esclusiva) del sottoalbero trascinato: dragNodeIndex+1 per un nodo semplice, joinIndex per un IF
let dragCurrentX = 0, dragCurrentY = 0; // coordinate canvas correnti del mouse durante il drag (per il "ghost" che segue il cursore)
let isDraggingNode = false; // true quando il drag ha superato la soglia di attivazione
let suppressNextClick = false; // evita che il 'click' dopo un drag riapra il popup di modifica
// R12-G/Fase2 (Ismail 2026-07-12): true quando il drag in corso sposta l'INTERA
// selezione multipla contigua (moveSelectionGroup/moveRange), non un singolo nodo/blocco.
// dragNodeIndex/dragSubtreeEnd, in questo caso, coprono l'intero range [blockStart,
// blockEnd) del gruppo -- riusano cosi' GRATIS il fade "isBeingDragged" e l'esclusione
// archi interni di rendering.js/onCanvasMouseMove (pattern del drag-IF esistente).
let dragIsGroup = false;
// R14 (Ismail 2026-07-13): drag di gruppo SPARSO (unita' su archi/annidamenti diversi) --
// attivo solo insieme a dragIsGroup; il fade in rendering usa il member-set, non il range.
let dragScattered = false;
// 2026-07-19 (Ismail, "animazione piu' ganza quando trascini piu' blocchi"): "marching ants"
// -- l'offset ANIMATO del tratteggio del bordo di selezione durante il drag di gruppo, cosi'
// i trattini SCORRONO lungo il perimetro (effetto "selezione viva" dei tool di grafica) invece
// di restare fermi. Incrementato da un loop rAF in interaction.js (_bfGroupDragAnimTick), letto
// da rendering.js come ctx.lineDashOffset. 0 = fermo (nessun drag di gruppo in corso).
let _bfAntsOffset = 0;
let _bfAntsRAF = null; // handle del loop rAF (null = non in esecuzione)
// 2026-07-20 (Ismail): effetto "raccolta" -- quando parte un drag di GRUPPO, i ghost dei
// blocchi selezionati CONVERGONO (si animano dalle loro posizioni fino al blocco afferrato,
// sotto il cursore) e poi resta una PILA con un BADGE che mostra quanti blocchi stai
// trascinando. _bfDragCollapseT0 = timestamp d'inizio dell'animazione (0 = nessuna raccolta
// in corso); il progresso 0->1 si calcola in rendering da (now - T0)/durata.
let _bfDragCollapseT0 = 0;

// --- Dark mode ---
let darkMode = false; // stato corrente del tema (persistito in localStorage)

let nodi = []; // Array degli oggetti nodo visuali (per il disegno)
let frecce = []; // Array degli oggetti freccia visuali (per il disegno e l'interazione)

let tabVariabili = document.getElementById("tabVariabili"); // Elemento tabella HTML per le variabili
// Array per la gestione delle righe della tabella (non usato attivamente nel codice fornito)
let rigaTabella = [];

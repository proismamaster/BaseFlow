# test-fixtures/

Fixture JSON usate per verificare a mano `validateFlow()` (js/core/utils.js).
Le suite di test automatiche storiche (`test-if.js`, `test-eval.js`, `test-export.js`)
sono perse (file a 0 byte, vedi PLANS/PROBLEMS.md) — questi file coprono la stessa
funzione manualmente: caricali da "Apri" nell'app e verifica l'esito nella modale.

## 2026-07-11-if-rami-condivisi.json — DEVE essere RIFIUTATA

Fornita da Ismail. `if(2){true→3, false→6}` e `if(3){true→4, false→6}`: il nodo 6 è
condiviso tra il ramo false di if(3) e il ramo false di if(2) (rami non disgiunti),
e il sottoalbero di if(2) non è contiguo (l'`end` al nodo 5 si intromette tra i nodi
4 e 6). L'app (inserimenti via `inserisciNodo`) non può MAI produrre questa forma:
ogni inserimento shifta contiguamente gli indici e aggiorna un solo puntatore per
volta — questa è quindi la firma di un file corrotto o modificato a mano. Passa i
controlli di struttura/join/back-edge/raggiungibilità (1-4) ma rompe drag&drop,
cascade-delete e calcoloY, che si fidano ciecamente della contiguità/disgiunzione
dei sottoalberi.

Aggiunta da R12-C (Ismail 2026-07-11 / 2026-07-12): `validateFlow` ora rifiuta
questo file con errori leggibili (non-contiguità di if(2) e if(3), `end` dentro
l'intervallo del blocco di if(2)).

## 2026-07-12-if-annidato-valido.json — fixture di controllo, DEVE essere ACCETTATA

If annidato "gemello" della fixture sopra per forma (if esterno con un if interno
nel ramo true, nessun else esterno), ma costruito seguendo esattamente la sequenza
di inserimenti che produrrebbe `inserisciNodo` via UI (simulata in uno script scratch
che replica la stessa logica di splice + shift dei puntatori, non scritta a mano
libera): sottoalberi contigui, rami disgiunti, `end` fuori da ogni intervallo di
blocco. Serve come regressione negativa: se una futura modifica a `validateFlow`
rifiutasse anche questo file, è un falso positivo da correggere subito.

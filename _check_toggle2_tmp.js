// SCRATCH ESAURITO (manual.html: fix DEFINITIVO icona menu vicino al titolo -- bottone
// tornato dentro .man-title come flex-item normale, niente piu' JS di posizionamento,
// Sonnet 2026-07-17, dopo che Ismail ha chiesto di annullare i tentativi precedenti)
// -- verificato con jsdom: #man-toc-toggle e' figlio di .man-title (dentro .man-wrap, non
// piu' figlio diretto di body), .man-title-text contiene h1/p, il click sul bottone alterna
// ancora aria-expanded, il backdrop chiude ancora, il click su un link dell'indice chiude
// ancora in automatico, i 9 capitoli restano nell'ordine giusto. Nessun errore a runtime.
// Non e' un harness permanente. Cancellazione via rm dal sandbox bash -> EPERM (limite del
// mount): va cancellato a mano da Windows quando comodo, insieme all'altro scratch
// _check_toggle_tmp.js (dei due tentativi precedenti, ora anch'esso esaurito). Nessun altro
// file lo referenzia.

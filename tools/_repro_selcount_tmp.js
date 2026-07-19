// SCRATCH ESAURITO (indagine "il contatore (n) nel menu contestuale mostra sempre 1 quando
// seleziono un padre con figli", Sonnet 2026-07-18/19). Risultato: getSelectionUnits() conta
// CORRETTAMENTE 2 unita' quando si selezionano (via Ctrl+click) due IF/cicli SEPARATI, anche
// se ciascuno ha figli propri (verificato con flow costruito ad-hoc). Il caso che DA VERAMENTE
// sempre 1 e' rangeSelectTo() (Shift+click): quando il range deve attraversare un contenitore
// (if/ciclo) per raggiungere il bersaglio, lo prende SEMPRE per intero (tutta la sua unita',
// non solo il pezzo necessario) -- comportamento gia' investigato a fondo e CONFERMATO VOLUTO
// da Ismail il 2026-07-18 (vedi JOURNAL.md, voce "Taglia selezione nel menu contestuale +
// indagine a fondo su 2 bug di selezione/drag con cicli annidati": "prende tutto quello che
// c'e' dal nodo fino all'annidato... nessuna modifica necessaria"). Non toccato nel codice:
// serve prima capire da Ismail se questa e' la STESSA cosa gia' confermata ieri o un caso
// diverso. Non e' un harness permanente. Cancellazione via rm dal sandbox bash -> EPERM
// (limite del mount): va cancellato a mano da Windows quando comodo. Nessun altro file lo
// referenzia.

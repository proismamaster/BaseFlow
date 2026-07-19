// SCRATCH ESAURITO (fix "il numero nel menu contestuale di gruppo conta solo i padri, non
// anche i figli", Sonnet 2026-07-19) -- verificato: con 2 IF separati selezionati (Ctrl+click),
// ciascuno con 2 figli nei rami, il totale nodi (radici+figli) e' 6 -- confermato che
// groupUnits.reduce(sum, u => sum + u.members.size) in showContextMenu (interaction.js) da'
// il numero giusto, non piu' groupUnits.length (che dava 2, contando solo le radici). Suite
// esistenti rilanciate dopo il fix, tutte verdi: repro-r13b-selection-group 27/27,
// repro-r14-scattered-move 36/36, repro-r15-move-corruption 8/8, repro-r15b-range-select
// 9/9. Non e' un harness permanente. Cancellazione via rm dal sandbox bash -> EPERM (limite
// del mount): va cancellato a mano da Windows insieme a _repro_selcount_tmp.js (stessa
// indagine). Nessun altro file lo referenzia.

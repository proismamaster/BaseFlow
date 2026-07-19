// ROUND-15F WP-E3 — SUPERSEDUTO (Ismail, 2026-07-18, "il pallino non hai capito un cazzo, rifai
// tutto come prima"): questo file testava un fix del pallino di ricongiunzione (raggio ingrandito)
// che e' stato COMPLETAMENTE ANNULLATO su richiesta esplicita di Ismail -- il pallino e' tornato
// esattamente come prima (raggio 3, nessuna JOIN_DOT_RADIUS_PX). Le assert qui sotto non sono piu'
// valide (referenziavano una costante rimossa) e il file e' stato svuotato per non lasciare un
// harness rotto/fuorviante nella repo (non e' stato possibile cancellare il file dalla sandbox,
// permesso negato dal mount -- quindi resta come no-op documentato invece che sparire).
//
// Il test valido per lo STELO (Problema 1, l'unico ancora in piedi da questo round) e' ora in
// tools/repro-e3-if-stem-exec-only.js. Il vero "punto 2" di Ismail (le frecce non si connettono
// bene agli angoli, in generale, su TUTTI i tipi di arco) e' un problema diverso, ancora da
// indagare/fixare separatamente -- vedi JOURNAL.md 2026-07-18 per lo stato.
console.log('repro-e3-if-stem-and-join-dot: SUPERSEDUTO, nessun assert eseguito qui. Vedi repro-e3-if-stem-exec-only.js per il test dello stelo.');
process.exit(0);

// SCRATCH ESAURITO (manual.html: verifica del ripristino allo stato iniziale del bottone
// hamburger, richiesto esplicitamente da Ismail dopo che i tentativi di "icona vicino al
// titolo" avevano fatto danni, Sonnet 2026-07-17) -- verificato con jsdom: bottone tornato
// figlio diretto di body (fuori da .man-wrap, position:fixed), .man-title senza icona dentro,
// .man-title-text rimosso, .man-topbar-end ripristinato, toggle/backdrop/click-su-link ancora
// funzionanti, 9 capitoli intatti, nessun errore a runtime. Non e' un harness permanente.
// Cancellazione via rm dal sandbox bash -> EPERM (limite del mount): va cancellato a mano da
// Windows insieme agli altri scratch _check_toggle*_tmp.js (tutti esauriti, stessa saga).
// Nessun altro file lo referenzia.

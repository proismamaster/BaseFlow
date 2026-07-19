// SCRATCH ESAURITO (manual.html: .man-toc unificato in un unico pannello SEMPRE fisso/overlay
// a qualunque dimensione del popup, rimosso il vecchio @media max-width:820px; aggiunto
// padding-block-start 4.25rem per non finire piu' sotto l'hamburger fisso, Sonnet 2026-07-17)
// -- verificato con jsdom: position:fixed confermato (prima era sticky sopra 820px), padding-
// top 4.25rem applicato, z-index in ordine (toggle 950 > toc 900 > backdrop 890), nessun
// @media(max-width:820px) rimasto nel file, toggle apre/chiude su piu' click, backdrop chiude
// al click. NB: getComputedStyle di jsdom su "display" per il backdrop nascosto ha dato un
// falso "block" (limite noto di jsdom nel risolvere cascade con selettori composti tipo
// "body:not(.x) #y" -- gia' visto in sessione, non e' un bug reale: il comportamento
// funzionale via classList/click e' quello verificato ed e' corretto). Non e' un harness
// permanente. Cancellazione via rm/fs.unlinkSync dal sandbox bash -> EPERM (limite del mount):
// va cancellato a mano da Windows quando comodo. Nessun altro file lo referenzia.

// SCRATCH ESAURITO (manual.html: fix icona menu vicino al titolo, round 3 -- posizionamento
// dinamico via JS invece di CSS a mano, Sonnet 2026-07-17) -- verificato con jsdom: il bottone
// #man-toc-toggle esiste, positionTocToggle() non lancia errori su resize ne' su cambio lingua
// (chiamata da applyManualLanguage()/applyManZoom()), il click sul bottone continua ad
// alternare aria-expanded true/false come prima. jsdom non ha un vero motore di layout quindi
// non puo' verificare i pixel reali (getBoundingClientRect resta 0x0) -- quello va controllato
// a vista nell'app. Non e' un harness permanente. Cancellazione via rm dal sandbox bash ->
// EPERM (limite del mount): va cancellato a mano da Windows quando comodo (creato per errore
// nella root del progetto invece che in tools/, stessa convenzione degli altri scratch
// _*_tmp.js comunque). Nessun altro file lo referenzia.

// SCRATCH ESAURITO (manual.html: click su un link dell'indice chiude automaticamente il
// pannello TOC, delegato su #man-toc-nav con e.target.closest('a'), Sonnet 2026-07-17) --
// verificato con jsdom: click su un <a> chiude il pannello, click su un elemento NIDIFICATO
// dentro un <a> (es. uno <span>) chiude comunque (closest() risale correttamente), click sul
// <h2> "Indice" (non un link) NON chiude il pannello. Non e' un harness permanente.
// Cancellazione via rm/fs.unlinkSync dal sandbox bash -> EPERM (limite del mount): va
// cancellato a mano da Windows quando comodo. Nessun altro file lo referenzia.

// SCRATCH ESAURITO (manual.html: hamburger #man-toc-toggle diventato `position: fixed` in
// alto, rimossa la X interna #man-toc-close su richiesta esplicita di Ismail, Sonnet
// 2026-07-16/17) -- verificato con jsdom: #man-toc-close e .man-toc-head non esistono più nel
// DOM, #man-toc-toggle ha computed position "fixed", un solo bottone apre E chiude
// correttamente il drawer (aria-expanded + classe body.man-toc-hidden), il backdrop chiude
// ancora al click. Non è un harness permanente. Cancellazione via rm/fs.unlinkSync dal
// sandbox bash -> EPERM (limite del mount): va cancellato a mano da Windows quando comodo.
// Nessun altro file lo referenzia.

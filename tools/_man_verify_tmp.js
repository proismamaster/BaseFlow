// SCRATCH ESAURITO (manual.html: hamburger TOC + coerenza temi/custom + lingua isolata,
// Sonnet 2026-07-16) -- harness jsdom usato per verificare a runtime le 6 casistiche (tema
// custom propaga le CSS vars, tema builtin nessuna regressione, 'baseflow-manual-lang' ha
// priorita' su 'baseflow-lang', il selettore lingua del manuale non tocca piu' 'baseflow-lang',
// toggle hamburger + persistenza). Tutti e 6 i test OK. Non e' un harness permanente.
// Cancellazione via rm/fs.unlinkSync dal sandbox bash -> EPERM (limite del mount): va
// cancellato a mano da Windows quando comodo. Nessun altro file lo referenzia.

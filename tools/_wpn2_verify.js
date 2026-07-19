// SCRATCH ESAURITO (WP-N2, round 15-C, Sonnet 2026-07-15) -- usato una tantum per verificare
// headless il fix di WP-N2 (apri file / svuota durante l'esecuzione -> reset a Start), PASS su
// entrambi gli scenari (Run attivo + Apri file; Svuota da pausa). Non e' un harness permanente
// (non richiesto dal piano per WP-N2). La cancellazione via `rm`/`fs.unlinkSync` dal sandbox
// bash ha dato EPERM (limite del mount, non del permesso file) -- va cancellato a mano da
// Windows quando comodo. Sicuro da ignorare/cancellare, nessun altro file lo referenzia.

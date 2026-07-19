// SCRATCH ESAURITO (manual.html: rimozione pulsanti zoom + lingua in fondo + drawer laterale
// sempre + persistenza zoom, Sonnet 2026-07-16) -- harness jsdom, 5 casi tutti OK: pulsanti
// rimossi dal DOM, Ctrl++ da tastiera ancora funziona e salva il livello, il livello salvato
// viene riapplicato al prossimo apri, regola CSS del drawer laterale presente, selettore
// lingua (spostato in fondo) ancora funzionante. Non e' un harness permanente. Cancellazione
// via rm/fs.unlinkSync dal sandbox bash -> EPERM (limite del mount): va cancellato a mano da
// Windows quando comodo. Nessun altro file lo referenzia.

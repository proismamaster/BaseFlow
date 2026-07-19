// SCRATCH ESAURITO (WP-N6, round 15-C, Sonnet 2026-07-15) -- riproduzione riuscita del bug reale:
// crea un Assegna, aprilo, Salva SENZA scrivere niente -> node.info passava da "" a " = "
// (canvas: "Assign: ="). Fix applicato in js/core/popups.js (salvaInfo). Non e' un harness
// permanente. Cancellazione via rm/fs.unlinkSync dal sandbox bash -> EPERM (limite del mount):
// va cancellato a mano da Windows quando comodo. Nessun altro file lo referenzia.

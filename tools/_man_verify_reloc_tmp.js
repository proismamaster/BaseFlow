// SCRATCH ESAURITO (manual.html: hamburger + backdrop + pannello indice spostati FUORI da
// .man-wrap, come fratelli diretti di <body>, Sonnet 2026-07-17) -- causa reale: .man-wrap
// riceve `zoom` via JS quando si usa lo zoom-contenuto, e in Chromium un ancestor con `zoom`
// impostato crea un nuovo containing block per i discendenti `position:fixed`, che smettono
// di essere relativi al vero viewport -- con `height:100vh` il pannello poteva non riempire
// davvero tutto lo spazio verticale reale. Verificato con jsdom: i 3 elementi sono ora figli
// diretti di <body> (non più dentro .man-wrap), toggle/link-click/backdrop-click funzionano
// tutti ancora correttamente. Sintassi dei 2 <script> ricontrollata riga per riga, struttura
// tag HTML bilanciata (self-closing SVG gestiti correttamente nel controllo). Non è un
// harness permanente. Cancellazione via rm/fs.unlinkSync dal sandbox bash -> EPERM (limite
// del mount): va cancellato a mano da Windows quando comodo. Nessun altro file lo referenzia.

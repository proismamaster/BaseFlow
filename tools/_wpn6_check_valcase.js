// SCRATCH ESAURITO (WP-N6, round 15-C, Sonnet 2026-07-15) -- verifica dei 4 casi
// var/val vuoti-o-pieni dopo il fix di popups.js salvaInfo(): (var=x,val="")->"x = " invariato,
// (var="",val=5)->"" (era buggato anche questo), (var=x,val=5)->"x = 5" invariato,
// (var="",val="")->"" (il caso segnalato da Ismail, ora corretto). Non e' un harness permanente.
// Cancellazione via rm/fs.unlinkSync dal sandbox bash -> EPERM: va cancellato a mano da Windows.

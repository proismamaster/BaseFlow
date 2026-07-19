// SCRATCH ESAURITO (manual.html: revisione completa del manuale -- nuovi capitoli "Variabili
// e tipi" e "Comandi generali", fix a For/If, riparata una corruzione da collisione
// concorrente scoperta durante la verifica, Sonnet 2026-07-17) -- verificato con jsdom:
// 9 capitoli in DOM nell'ordine giusto (intro,variables,blocks,syntax,math,run,editor,
// commands,errors), 9 voci TOC coerenti, navigazione hash verso i 2 capitoli nuovi
// funzionante (pager "2/9" e "8/9" corretti), tabella math intatta (19 righe), hamburger/
// backdrop/click-su-link ancora funzionanti, regola overscroll-behavior:contain presente,
// TUTTE le chiavi i18n nuove (var_*/cmd_*/sc_*) renderizzano contenuto non vuoto in
// tutte e 4 le lingue (cambio lingua via evento 'change' sulla select, non accesso diretto
// alle var interne alla IIFE). Sintassi dei 2 <script> ricontrollata riga per riga dopo
// ogni modifica. Non è un harness permanente. Cancellazione via rm/fs.unlinkSync dal
// sandbox bash -> EPERM (limite del mount): va cancellato a mano da Windows quando comodo.
// Nessun altro file lo referenzia.

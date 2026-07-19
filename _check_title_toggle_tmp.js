// SCRATCH ESAURITO (manual.html: titolo "Manuale di BaseFlow" non deve piu' andare a capo
// restringendo il popup, hamburger e titolo sulla stessa riga sotto i 560px -- richiesta con
// screenshot/freccia, Sonnet 2026-07-18, DOPO i 5 tentativi precedenti del 17/07 annullati su
// richiesta esplicita di Ismail, vedi JOURNAL.md) -- verificato con jsdom (girato da /tmp, la
// vista bash su questo mount si e' bloccata a tempo indeterminato su `require('jsdom')`/
// `fs.readFileSync` diretti sul mount, stesso sintomo gia' noto in PROBLEMS.md "vista bash
// STALE sul mount": copiare prima il file + i node_modules altrove ha risolto):
// - #man-toc-toggle-mobile esiste, e' il PRIMO figlio di .man-title, .man-title-text avvolge
//   h1+p come previsto dal nuovo markup.
// - i due bottoni (#man-toc-toggle fisso "grande schermo" + #man-toc-toggle-mobile "sotto i
//   560px") restano SINCRONIZZATI: click su uno qualsiasi, sul backdrop, o su un link
//   dell'indice aggiorna aria-expanded su ENTRAMBI e la classe man-toc-hidden su body allo
//   stesso modo di prima (comportamento identico al singolo bottone pre-modifica).
// - i18n: data-mi-title e' presente su entrambi i bottoni (stessa chiave toc_toggle_tip) e il
//   loop generico in applyManualLanguage() aggiorna il title-tooltip su ENTRAMBI ad ogni cambio
//   lingua (verificato it/en/ar, incluso RTL su ar); l'h1 dentro .man-title-text si traduce
//   normalmente nelle 4 lingue.
// - 9 capitoli .man-chapter intatti, nessun errore a runtime (window.onerror muto).
// jsdom non ha un vero motore di layout (niente CSS box model reale) quindi NON puo' verificare
// che il titolo resti visivamente su una riga sola / non vada a capo sotto i 560px: quello va
// controllato a schermo da Ismail.
//
// GIRO 2 (Ismail, screenshot: "evita che ci vada sopra icona haha") -- bug reale trovato: il
// blocco @media(max-width:560px) coi #man-toc-toggle{display:none}/.man-title h1{font-size:
// clamp(...)} era scritto PRIMA delle regole base equivalenti (#man-toc-toggle,#man-toc-toggle-
// mobile{display:inline-flex}, .man-title h1{font-size:1.6rem}) piu' in basso nello stesso
// <style>. A parita' di specificita' (stesso singolo selettore #id/classe) vince chi viene DOPO
// nel sorgente, quindi le regole base "always-on" sovrascrivevano silenziosamente le eccezioni
// per lo schermo stretto, A QUALUNQUE LARGHEZZA: il bottone fisso restava sempre visibile in
// alto a sinistra (mai display:none) sopra al titolo, che nel frattempo aveva perso la sua
// vecchia riserva verticale (rimossa nel giro 1 assumendo, erroneamente, che il bottone non
// fluttuasse piu' li') -> icona sopra al testo "Ma[nuale]". Fix: spostato l'INTERO blocco
// @media dopo tutte le regole base che tocca (adesso e' l'ultima occorrenza nel file di questi
// selettori) -- confermato via grep che non resta nessun'altra dichiarazione successiva per
// #man-toc-toggle/#man-toc-toggle-mobile/.man-title h1 che potrebbe ri-vincere il tie-break.
// jsdom NON supporta la rivalutazione dei @media al resize (window.resizeTo "Not implemented",
// innerWidth resta fisso a 1024 qualunque assegnazione) quindi questo secondo giro non e' stato
// riverificabile con getComputedStyle a piu' larghezze -- la correttezza qui si basa sulla
// regola CSS standard "a parita' di specificita' vince l'ultima dichiarazione nel sorgente"
// (verificata leggendo l'ordine reale nel file, non assunta) e va comunque confermata a schermo.
//
// Non e' un harness permanente. Cancellazione via rm dal sandbox bash -> EPERM (limite del
// mount, stesso problema degli altri scratch _*_tmp.js): va cancellato a mano da Windows quando
// comodo. Nessun altro file lo referenzia.

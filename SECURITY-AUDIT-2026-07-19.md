# BaseFlow — Audit di sicurezza (2026-07-19)

Revisione statica di `js/**`, `index.html`, `manual.html`, `sw.js`, `manifest.json`, `style.css`.
Modello di minaccia principale: **apertura di un file di flowchart ostile** (condiviso da terzi) e
**CDN/rete compromessa**. BaseFlow è un'app puramente client-side senza backend: non c'è
autenticazione, database, né dati di altri utenti da rubare — l'impatto di un'eventuale XSS è
limitato al browser di chi apre il file (localStorage dell'app, azioni nella pagina, redirect).

Legenda severità: 🔴 ALTO · 🟠 MEDIO · 🟢 BASSO/informativo. Stato: ✅ CORRETTO oggi · ⏳ da fare · ℹ️ accettato/nota.

---

## Corretti in questa sessione

### 1. 🔴✅ XSS memorizzato via file ostile — nomi/valori di variabile nel "watch" di esecuzione
**Dove:** `js/execute.js`, `renderWatch()` (il pannello che mostra le variabili durante l'esecuzione).
**Causa:** il valore veniva escappato solo parzialmente (`.replace(/</g,'&lt;')`) e **il nome della
variabile non veniva escappato affatto**, poi entrambi finivano in `innerHTML`. `validateFlow`
valida la struttura dei *nodi* ma **non** il contenuto di `variables[]` (name/type/value sono
stringhe libere). Un file `.json`/`.bflow` con `variables:[{name:"<img src=x onerror=alert(document.cookie)>"}]`
eseguiva JavaScript arbitrario appena la vittima premeva "Esegui" (il watch renderizza i nomi).
**Fix:** helper `_bfEscapeHtml` che escappa tutti e 5 i caratteri (`& < > " '`) applicato a **nome
e valore**. Vettore chiuso. (Verifica: `node --check` + suite render/execute verdi.)

### 2. 🟠✅ Corruzione silenziosa dei file al caricamento (motivo della richiesta)
**Dove:** `js/core/fileIO.js` (caricamento), `js/saveOpen.js` (salvataggio).
**Causa:** salvataggio/caricamento in JSON grezzo. Un file **troncato** (crash, disco pieno, sync
cloud interrotto) che restasse *sintatticamente* valido veniva caricato con contenuto **mutilato**
senza che nessuno se ne accorgesse; `validateFlow` copre la struttura logica, non l'integrità dei byte.
**Fix:** nuovo formato **`.bflow`** (`js/core/fileFormat.js`) — contenitore con magic + versione +
**checksum cyrb53** del payload. Al caricamento il checksum viene ricalcolato e confrontato: file
danneggiato → **rifiutato** con messaggio dedicato, stato corrente intatto. Retrocompatibile (i
`.json` legacy si aprono ancora). Harness `tools/repro-bflow-format.js` 15/15 (corruzione di 1
carattere, checksum alterato, troncamento, payload mutilato-ma-valido, versione futura, legacy).
*Nota:* il checksum è **anti-corruzione, non anti-manomissione** — un attaccante che riscrive il
file ricalcola anche il checksum. Contro i file ostili la vera difesa resta la validazione (falla #1/#3).

### 3. 🟠✅ Validazione incompleta del contenuto — DoS da file gigante
**Dove:** `js/core/fileIO.js`.
**Causa:** (a) `console.log("Contenuto file:", content)` scaricava l'**intero** file in console (un
file da MB congelava DevTools); (b) nessun tetto dimensione: un file enorme/ostile mandava
`JSON.parse` + `validateFlow` (walker su sottoalberi/reachability) + layout in **blocco totale
della tab**.
**Fix:** rimosso il dump integrale; tetto **10 MB** sul testo prima del parse e **10.000 nodi /
1.000 variabili** prima di `validateFlow`, con rifiuto localizzato e messaggio tradotto (4 lingue).

---

## Corretti nel secondo giro (2026-07-19, "risolvi i problemi")

### 4. 🟢✅ `new Function` in `layout.js` (validazione nodo) — RIMOSSO
**Era:** `nodeHasError()` usava `new Function('return ('+expr+')')` per validare la sintassi (compila,
non esegue → nessun RCE, ma code-smell + valida grammatica JS invece di quella di `safeEval`).
**Fix:** nuovo `_bfExprSyntaxOk()` che **neutralizza gli identificatori** (ogni nome di variabile → `1`,
tranne `Math.<fn>`/booleani/null) e valida con `safeEvaluate` (parser sicuro, allowlist, nessun accesso
a globali). Zero `new Function`/`eval` nel codice. Verificato con casi mirati (trailing operator, paren
non chiusa, `Math.max`, ternario, logici) + `render-headless` (ora carica anche `safeEval.js`).

### 5. 🟠◐ Shepherd.js da CDN senza SRI — MITIGATO (self-host completo lasciato a Ismail)
**Fatto:** versione **pinnata** (`shepherd.js@11`, prima senza versione) + `crossorigin`; la CSP (#6)
limita `script-src` alla sola origin `cdn.jsdelivr.net`. Script pronto `tools/vendor-shepherd.sh` che
scarica Shepherd in `js/vendor/`, calcola l'**SRI** e stampa i tag da incollare.
**Da completare da una macchina con rete** (il proxy della sandbox blocca jsdelivr con 403): eseguire
lo script, sostituire i 2 URL con i file locali+`integrity`, togliere jsdelivr dalla CSP, aggiungerli
al PRECACHE di `sw.js`.

### 6. 🟠✅ Content-Security-Policy — AGGIUNTA
**Fix:** `<meta http-equiv="Content-Security-Policy">` in `index.html`. `script-src`/`style-src`
mantengono `'unsafe-inline'` (obbligatorio: l'app ha script inline **e** molti `onclick=` inline) +
allowlist `cdn.jsdelivr.net`; ma bloccano il resto: `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'`, `connect-src 'self' https://api.github.com` (l'esfiltrazione può andare solo lì),
`img-src 'self' data: https:`. Riduce la portata di qualunque XSS residua. *Nota:* `frame-ancestors`
e `sandbox` via meta sono ignorati dai browser (servono come header HTTP): se il sito verrà servito da
un web server, aggiungerli lì (una riga nel README di deploy).

### 7. 🟢✅ `<iframe>` del manuale — SANDBOX aggiunto
`sandbox="allow-scripts allow-same-origin"` (il manuale usa JS proprio e legge il tema dal parent; niente
`allow-popups`/`allow-top-navigation`).

### 8. 🟢✅ Colori dei temi personalizzati — VALIDATI
`theme.js` (`applyCustomTheme`) e lo script early-theme in `index.html` ora applicano `setProperty` solo
su chiavi `--var` con valore **hex valido** (`_bfIsValidColorVar`, `^#([0-9a-fA-F]{3,8})$`).

### 9. 🟢✅ Contributors — href/avatar solo `https://`
`a.href` e `img.src` accettati solo se iniziano con `https://` (mai `javascript:`/`data:`).

---

## Punti verificati e SANI (nessuna azione)

- **`eval()` — ELIMINATO.** `grep "\beval("` in `js/**` (escluso vendor) = **zero**. L'esecutore usa
  `js/core/safeEval.js` (parser a discesa ricorsiva con allowlist Math), che **non** accede a
  `window`/prototype/globali. Chiude la falla 🔴 #1 del vecchio `AUDIT.md` (2026-07-07).
- **Console output** usa `textContent` (`printMessage`/`throwError`) — nessuna XSS lì.
- **Modali** (`bf-modal-msg`/`title`) usano `textContent` per i messaggi.
- **`updateProjectIdentity`** (nome file/autore in header) usa `textContent` — safe.
- **`target="_blank"`** esterni hanno tutti `rel="noopener"` (niente reverse tabnabbing).
- **Service worker** (`sw.js`): network-first con cache versionata, `clients.claim()`, pulizia cache
  vecchie; nessuna logica sfruttabile. In sviluppo è comunque **disattivato** (script no-cache in `index.html`).
- **`validateFlow`** (`utils.js`) rifiuta strutturalmente file corrotti/non prodotti da BaseFlow
  (indici fuori range, cicli senza back-edge, if non riconvergenti, nodi irraggiungibili, sottoalberi
  non contigui) **prima** di toccare lo stato — ottima base, ora affiancata da checksum + tetti DoS.
- **`_bfAbortExecOnEdit`** azzera lo stato d'esecuzione prima di sostituire `flow` all'apertura di un file.

---

## Stato finale (2026-07-19, dopo il secondo giro)
Tutte le falle dell'elenco sono state affrontate. **Corrette in-app:** #1, #2, #3, #4, #6, #7, #8, #9.
**Mitigata + azione manuale residua:** #5 (Shepherd pinnato + CSP che ne limita l'origin + script
`tools/vendor-shepherd.sh` pronto; il self-host completo con SRI va eseguito da una macchina con rete).

**Unico TODO rimasto (non eseguibile nella sandbox):**
- Eseguire `bash tools/vendor-shepherd.sh`, sostituire i 2 URL jsdelivr coi file locali+`integrity`,
  togliere `cdn.jsdelivr.net` dalla CSP, aggiungere i file al PRECACHE di `sw.js`.
- (Opzionale, se il sito verrà servito da un web server) spostare `frame-ancestors 'self'` e l'header
  `X-Content-Type-Options: nosniff` a livello di header HTTP (i meta non li applicano).

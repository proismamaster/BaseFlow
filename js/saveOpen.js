// Salvataggio del flowchart: usa (se disponibile) l'API File System Access per scegliere
// nome/posizione con un vero picker nativo; fallback su download <a download> se l'API non
// e' supportata. save() e' la funzione "chiedi sempre" (primo salvataggio o Salva-con-nome,
// vedi saveFileAs in popups.js); saveToCurrentFile() riusa nome/handle quando gia' noti
// (pulsante "Salva" su un file gia' aperto/salvato in questa sessione).
//
// BUG FIX (round 11, WP-B/B3): tre bug reali trovati durante la ricognizione del piano:
// (1) la scrittura tramite showSaveFilePicker ignorava il parametro `json` e scriveva
//     sempre `flow` (poteva salvare contenuto DIVERSO da quello passato dal chiamante);
// (2) annullare il picker nativo (AbortError) faceva partire comunque il download di
//     fallback, "salvando" un file che l'utente aveva appena annullato;
// (3) `saved = true` veniva settato SEMPRE, anche su annullamento/fallimento (falso
//     "salvato": l'indicatore di modifiche non salvate si spegneva senza che nulla fosse
//     davvero scritto).
// Ora saved=true SOLO a scrittura riuscita, in OGNI ramo; annullare il picker non scarica
// nulla e non tocca saved.
async function save(json, name) {
    name = name.replace(/[\\/:*?"<>|]/g, "");
    name = name.trim();
    if (name == "") {
        name = "test";
    }
    if (!name.toLowerCase().endsWith(".json")) {
        name += ".json";
    }

    function fallbackDownload() {
        const dati = JSON.stringify(json, null, 2);
        const blob = new Blob([dati], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        currentFileName = name;
        currentFileHandle = null; // il download non da' un handle riscrivibile
        saved = true;
        savedThisSession = true; // R14-A: scrittura riuscita -- i prossimi Salva in questa sessione sono silenziosi
        if (typeof syncUnsavedIndicator === 'function') syncUnsavedIndicator();
    }

    if (window.showSaveFilePicker) {
        const options = {
            suggestedName: name,
            types: [
                {
                    description: 'JSON file',
                    accept: { 'application/json': ['.json'] }
                }
            ]
        };
        try {
            const handle = await window.showSaveFilePicker(options);
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(json, null, 2)); // FIX round 11: era `flow` a prescindere dal parametro
            await writable.close();
            currentFileHandle = handle;
            currentFileName = handle.name || name;
            saved = true;
            savedThisSession = true; // R14-A: scrittura riuscita -- i prossimi Salva in questa sessione sono silenziosi
            if (typeof syncUnsavedIndicator === 'function') syncUnsavedIndicator();
        } catch (err) {
            if (err && err.name === 'AbortError') return; // FIX round 11: annullato -> NIENTE download, NIENTE saved
            console.error("Salvataggio fallito, uso il download di fallback:", err);
            fallbackDownload();
        }
    } else {
        fallbackDownload();
    }
}
if (typeof window !== 'undefined') { window.save = save; }

// B3 (round 11): "Salva" silenzioso -- riusa l'handle/nome del file gia' aperto o salvato in
// questa sessione, senza chiedere nulla quando possibile.
async function saveToCurrentFile() {
    // R14-A (Ismail 2026-07-13): il PRIMO Salva di ogni sessione chiede SEMPRE il popup
    // nome+autore, anche se currentFileName e' gia' noto (es. da un file appena aperto con
    // "Apri" -- fileIO.js setta currentFileName ma MAI savedThisSession). Senza questo gate,
    // aprire un file esistente e premere subito "Salva" scriveva silenziosamente riusando il
    // nome del file aperto, saltando la conferma nome/autore che la regola vuole al primo giro.
    if (!savedThisSession) {
        if (typeof saveFileAs === 'function') saveFileAs();
        return;
    }
    if (currentFileHandle) {
        try {
            // Alcuni browser richiedono ri-conferma del permesso di scrittura su handle riusati
            // (es. dopo un certo tempo, o su handle ottenuti in un giro precedente).
            if (typeof currentFileHandle.requestPermission === 'function') {
                const perm = await currentFileHandle.requestPermission({ mode: 'readwrite' });
                if (perm !== 'granted') throw new Error('permesso di scrittura negato');
            }
            const writable = await currentFileHandle.createWritable();
            // R13-D (Ismail 2026-07-12): scrive anche `author` (currentAuthor, state.js) -- non
            // muta l'oggetto `flow` live (Object.assign su un oggetto nuovo), cosi' il resto del
            // codice che legge flow.nodes/flow.variables non vede un campo extra inatteso.
            await writable.write(JSON.stringify(Object.assign({}, flow, { author: (typeof currentAuthor !== 'undefined' ? currentAuthor : null) }), null, 2));
            await writable.close();
            saved = true;
            savedThisSession = true; // R14-A: scrittura riuscita -- i prossimi Salva in questa sessione sono silenziosi
            if (typeof syncUnsavedIndicator === 'function') syncUnsavedIndicator();
            return;
        } catch (err) {
            console.error("Scrittura sull'handle esistente fallita, torno al flusso con picker/nome:", err);
            currentFileHandle = null; // handle non piu' valido: non ritentarlo, ricadi sotto
        }
    }
    if (currentFileName) {
        // Nessun handle scrivibile (es. file aperto da <input type=file>, oppure handle appena
        // invalidato sopra): riusa il NOME. Con l'API File System Access questo riapre il
        // picker nativo precompilato (non il nostro popup); senza l'API scarica direttamente,
        // senza chiedere nulla -- comportamento onesto per un "Salva", non un "Salva con nome".
        // R13-D: include l'autore corrente anche nel "Salva" silenzioso (riusa nome, non chiede nulla).
        await save(Object.assign({}, flow, { author: (typeof currentAuthor !== 'undefined' ? currentAuthor : null) }), currentFileName);
        return;
    }
    // Primo salvataggio di un flow nuovo: nessun nome noto, chiedi (comportamento invariato).
    if (typeof saveFileAs === 'function') saveFileAs();
}
if (typeof window !== 'undefined') { window.saveToCurrentFile = saveToCurrentFile; }

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
// Serializza il payload nel formato .bflow (con checksum d'integrità) se il modulo
// fileFormat.js è disponibile; altrimenti fallback al JSON grezzo legacy (nessun crash se
// per qualche motivo lo script non fosse caricato).
function _bfSerialize(json) {
    if (typeof bfSerializeForSave === 'function') return bfSerializeForSave(json);
    return JSON.stringify(json, null, 2);
}
async function save(json, name) {
    name = name.replace(/[\\/:*?"<>|]/g, "");
    name = name.trim();
    if (name == "") {
        name = "test";
    }
    // 2026-07-19: il formato nuovo usa l'estensione .bflow. Un nome che finisce col vecchio
    // .json viene MIGRATO a .bflow (il contenuto è comunque il contenitore con checksum).
    if (/\.json$/i.test(name)) name = name.replace(/\.json$/i, '.bflow');
    if (!/\.bflow$/i.test(name)) name += '.bflow';

    function fallbackDownload() {
        const dati = _bfSerialize(json);
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
        if (typeof markSaved === 'function') markSaved(); // P (round 15): fissa l'hash "salvato" per il pallino
        if (typeof syncUnsavedIndicator === 'function') syncUnsavedIndicator();
    }

    // WP (Ismail 2026-07-22, packaging desktop): nell'app Electron si scrive un file VERO su
    // disco via IPC (dialog nativo + fs.writeFile nel main, vedi electron/main.js/preload.js)
    // invece di affidarsi a showSaveFilePicker/download del browser. Serve un PATH reale (che il
    // browser non espone mai) cosi' il prossimo "Salva" (saveToCurrentFile) puo' scrivere in
    // modo silenzioso sullo STESSO file invece di riaprire un dialog che chiede di sovrascrivere.
    if (window.BaseFlowDesktop && window.BaseFlowDesktop.isDesktop && window.BaseFlowDesktop.saveFileDialog) {
        try {
            const filePath = await window.BaseFlowDesktop.saveFileDialog(name);
            if (!filePath) return; // dialog annullato: niente scrittura, niente stato toccato
            const res = await window.BaseFlowDesktop.writeFile(filePath, _bfSerialize(json));
            if (!res || !res.ok) {
                console.error('Salvataggio desktop fallito:', res && res.error);
                if (typeof showStyledAlert === 'function') showStyledAlert(String((res && res.error) || 'Salvataggio fallito.'), { danger: true });
                return;
            }
            currentFilePath = filePath;
            currentFileName = filePath.replace(/^.*[\\/]/, ''); // basename, funziona sia con \ che /
            currentFileHandle = null;
            saved = true;
            savedThisSession = true;
            if (typeof markSaved === 'function') markSaved();
            if (typeof syncUnsavedIndicator === 'function') syncUnsavedIndicator();
        } catch (err) {
            console.error('Salvataggio desktop fallito:', err);
        }
        return;
    }

    if (window.showSaveFilePicker) {
        const options = {
            suggestedName: name,
            types: [
                {
                    description: 'BaseFlow file',
                    accept: { 'application/json': ['.bflow', '.json'] }
                }
            ]
        };
        try {
            const handle = await window.showSaveFilePicker(options);
            const writable = await handle.createWritable();
            await writable.write(_bfSerialize(json)); // FIX round 11: era `flow` a prescindere dal parametro; 2026-07-19: formato .bflow con checksum
            await writable.close();
            currentFileHandle = handle;
            currentFileName = handle.name || name;
            saved = true;
            savedThisSession = true; // R14-A: scrittura riuscita -- i prossimi Salva in questa sessione sono silenziosi
            if (typeof markSaved === 'function') markSaved(); // P (round 15): fissa l'hash "salvato" per il pallino
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
    // P1.2 (round 15, 2026-07-13): "Salva" e' SILENZIOSO quando nome/handle sono gia' noti.
    // Ribalta il gate R14-A (che riapriva SEMPRE il popup al primo Salva di sessione): un file
    // con nome+autore gia' noti non deve richiedere di nuovo nome/autore. Il popup nome+autore
    // resta solo per "Salva con nome" (saveFileAs) e per il PRIMO salvataggio di un progetto
    // NUOVO senza nome (ramo finale in fondo a questa funzione). Il flag savedThisSession non
    // e' piu' usato come gate qui (resta settato altrove, innocuo).
    //
    // WP (Ismail 2026-07-22, packaging desktop): bug segnalato -- su Windows, "Salva" su un file
    // gia' aperto/salvato riapriva SEMPRE un dialog nativo che chiedeva di sovrascrivere, invece
    // di scrivere subito. Causa: dopo un "Apri" (che usa <input type=file>, non l'API browser)
    // `currentFileHandle` e' sempre null -- quindi si cadeva nel ramo "riusa il NOME" qui sotto,
    // che con l'API File System Access disponibile in Electron riapre un picker nativo
    // precompilato, e Windows/macOS lo trattano come un salvataggio NUOVO su un nome esistente:
    // da li' il prompt di overwrite. Con un path VERO (currentFilePath, popolato da fileIO.js su
    // desktop) si scrive via IPC senza alcun dialog -- comportamento "Salva" onesto.
    if (window.BaseFlowDesktop && window.BaseFlowDesktop.isDesktop && currentFilePath) {
        try {
            const res = await window.BaseFlowDesktop.writeFile(
                currentFilePath,
                _bfSerialize(Object.assign({}, flow, { author: (typeof currentAuthor !== 'undefined' ? currentAuthor : null) }))
            );
            if (res && res.ok) {
                saved = true;
                savedThisSession = true;
                if (typeof markSaved === 'function') markSaved();
                if (typeof syncUnsavedIndicator === 'function') syncUnsavedIndicator();
                return;
            }
            console.error('Scrittura silenziosa fallita, ripiego sul dialog:', res && res.error);
        } catch (err) {
            console.error('Scrittura silenziosa fallita, ripiego sul dialog:', err);
        }
        currentFilePath = null; // path non piu' valido (es. file spostato/cancellato): non ritentarlo, ricadi sotto
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
            // 2026-07-19: serializzato nel formato .bflow con checksum (_bfSerialize).
            await writable.write(_bfSerialize(Object.assign({}, flow, { author: (typeof currentAuthor !== 'undefined' ? currentAuthor : null) })));
            await writable.close();
            saved = true;
            savedThisSession = true; // R14-A: scrittura riuscita -- i prossimi Salva in questa sessione sono silenziosi
            if (typeof markSaved === 'function') markSaved(); // P (round 15): fissa l'hash "salvato" per il pallino
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

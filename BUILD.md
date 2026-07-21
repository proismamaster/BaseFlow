# BaseFlow — build dei pacchetti installabili

BaseFlow resta una web app statica. Da quegli stessi sorgenti si producono tre cose:

| Target | Tecnologia | Output |
|---|---|---|
| Windows / macOS / Linux | Electron + electron-builder | `.exe`, `.dmg`, `.AppImage`, `.deb`, `.rpm` |
| Android | Capacitor | `.apk` (test) / `.aab` (Play Store) |
| Browser | la web app di sempre | pubblica il contenuto di `app/` |

---

## Struttura del repo

```
app/                  <- LA WEB APP (index.html, style.css, js/, img/, manual.html, ...)
electron/             <- processo main + preload di Electron
build/                <- icone generate + entitlements macOS
tools/                <- script di supporto (icone, vendoring Shepherd)
electron-builder.yml  <- configurazione dei pacchetti desktop
capacitor.config.json <- configurazione Android
dist/                 <- output degli installer (gitignorato)
android/              <- progetto Android generato da Capacitor (gitignorato)
```

**Attenzione al deploy web:** i sorgenti prima stavano nella root, ora sono in `app/`.
Se pubblichi via FTP/rsync o GitHub Pages, la cartella da caricare adesso è `app/`, non la root.

---

## Prerequisiti

- **Node.js 20+** (testato con 22)
- **Windows**: niente altro
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: per il `.rpm` serve `rpm` (`sudo apt install rpm`)
- **Android**: [Android Studio](https://developer.android.com/studio) + JDK 17

Prima cosa, una volta sola:

```bash
npm install
```

---

## Desktop (Windows / macOS / Linux)

### Provare l'app senza pacchettizzare

```bash
npm start
```

Apre la finestra Electron caricando direttamente `app/`. È il ciclo di sviluppo più veloce:
modifichi un file in `app/`, premi `Ctrl+R` (`Cmd+R` su Mac) nella finestra e vedi il risultato.

### Creare gli installer

```bash
npm run dist:win      # Windows: setup NSIS + versione portable
npm run dist:mac      # macOS: .dmg per Intel e Apple Silicon
npm run dist:linux    # Linux: AppImage + .deb + .rpm
npm run dist          # tutti i target compatibili con la macchina corrente
```

Gli output finiscono in `dist/`.

**Puoi buildare solo per la piattaforma su cui sei** (in pratica): Windows produce `.exe` da
Windows, `.dmg` richiede macOS perché serve creare un bundle `.app` firmato. Linux e Windows si
possono incrociare con Docker, ma la strada semplice è una macchina per OS oppure una GitHub
Action con matrice `windows-latest` / `macos-latest` / `ubuntu-latest`.

### Firma del codice — leggilo prima di distribuire

Non è configurata, quindi:

- **Windows**: SmartScreen mostrerà "Applicazione non riconosciuta" al primo avvio. L'utente deve
  fare *Ulteriori informazioni → Esegui comunque*. Per toglierlo serve un certificato di code
  signing (~200-400 €/anno).
- **macOS**: senza Apple Developer ID (99 $/anno) e notarizzazione, il `.dmg` va aperto con
  **tasto destro → Apri**, altrimenti Gatekeeper lo blocca. `build/entitlements.mac.plist` è già
  pronto per quando deciderai di firmare.
- **Linux**: nessun problema, non c'è nessun gatekeeper.

---

## Android

```bash
npm run android:add     # una volta sola: crea la cartella android/
npm run android:sync    # dopo ogni modifica ad app/: ricopia la web app nel progetto nativo
npm run android:open    # apre Android Studio
```

Da Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)** per un APK di test, oppure
**Build → Generate Signed Bundle/APK** per l'`.aab` firmato da caricare sul Play Store.

Da riga di comando, senza aprire lo Studio:

```bash
cd android && ./gradlew assembleDebug     # APK di test, non firmato per il Play Store
```

Il file esce in `android/app/build/outputs/apk/debug/app-debug.apk`.

**`npm run android:sync` va rilanciato ogni volta che tocchi `app/`** — Capacitor copia i file
dentro il progetto nativo, non li legge al volo.

### Icone Android

`npm run icons` genera le icone desktop, non i mipmap Android. Per quelli:

```bash
npx @capacitor/assets generate --android
```

### Personalizzare il progetto nativo

`android/` è in `.gitignore` perché rigenerabile. Se però modifichi il `AndroidManifest.xml`
(permessi), la splash screen o la configurazione di firma, **togli quella riga dal `.gitignore` e
committa la cartella** — altrimenti al prossimo `cap add` le modifiche spariscono senza avviso.

---

## Icone

Sorgente unica: `app/img/icon.png`. Da lì:

```bash
npm run icons
```

genera `build/icon.ico` (Windows), `build/icon.icns` (macOS), `build/icons/*.png` (Linux).

> **Da sistemare:** l'icona sorgente attuale è 244×243 px. Per i pacchetti servono fino a
> 1024×1024, quindi le taglie grandi sono un upscaling e si vedono sgranate — soprattutto
> l'icona del `.dmg` su macOS e quella del Play Store (che richiede 512×512 nitidi).
> Rifai `app/img/icon.png` a **1024×1024, quadrato, PNG con trasparenza** e rilancia
> `npm run icons`: tutto il resto si riallinea da solo.

---

## Dipendenze offline

I pacchetti nativi girano senza rete garantita, quindi **niente CDN**: jsPDF e Shepherd.js sono
entrambi serviti da `app/js/vendor/`. Se aggiorni Shepherd:

```bash
npm run vendor:shepherd
```

Lo script rifiuta versioni ≥ 12 perché dalla 12 non esiste più il build UMD che `index.html`
carica con `<script src>` — passare a quelle richiederebbe riscrivere `tutorial.js` a moduli ES.

---

## Note tecniche su Electron

- L'app **non** è caricata da `file://` ma da un protocollo custom `app://baseflow`. Con `file://`
  l'origine è opaca: la CSP `default-src 'self'` non matcherebbe nulla e `localStorage` non
  sarebbe affidabile (diagrammi e tema persi tra un avvio e l'altro). Con un protocollo
  registrato come *standard + secure* l'app ha un'origine vera e si comporta come nel browser.
- La finestra gira con `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
  La pagina non ha accesso a Node. L'unico ponte è `electron/preload.js`, che espone solo
  `window.BaseFlowDesktop` (flag + versioni, sola lettura).
- I link esterni vengono aperti nel browser di sistema, mai dentro la finestra dell'app.
- Posizione e dimensione della finestra sono salvate in `window-state.json` dentro la cartella
  dati utente.

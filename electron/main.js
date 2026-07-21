/*
 * BaseFlow -- processo MAIN di Electron (desktop: Windows / macOS / Linux).
 *
 * Scelte importanti, spiegate perche' non sono ovvie:
 *
 * 1) L'app NON viene caricata con file:// ma da un protocollo custom "app://".
 *    Con file:// l'origine e' opaca ("null"): la CSP `default-src 'self'` non
 *    matcha niente, localStorage e' inaffidabile e fetch() sui file locali viene
 *    bloccata. Con un protocollo registrato come "standard + secure" l'app gira
 *    su un'origine vera (app://baseflow), quindi la stessa CSP che usiamo sul web
 *    vale identica anche qui e localStorage/IndexedDB persistono come nel browser.
 *    Conseguenza pratica: i salvataggi (tema, diagrammi in locale) sopravvivono
 *    ai riavvii, cosa che con file:// non e' garantita.
 *
 * 2) La finestra e' sandboxata: nodeIntegration off, contextIsolation on.
 *    Il codice della web app non ha (e non deve avere) accesso a Node. L'unico
 *    ponte e' preload.js, che espone una manciata di campi di sola lettura.
 *
 * 3) Navigazione e link esterni sono bloccati dentro la finestra e reindirizzati
 *    al browser di sistema: se domani un link nel manuale puntasse fuori, non si
 *    porta via l'intera app dentro la stessa finestra.
 */

const { app, BrowserWindow, Menu, shell, protocol, net, dialog, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const url = require('node:url');

// Radice dei sorgenti web. In sviluppo e' ../app; nel pacchetto, app/ viene
// copiata dentro le resources (vedi "files" in electron-builder.yml).
const APP_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : path.join(__dirname, '..', 'app');

const APP_ORIGIN = 'app://baseflow';
const IS_MAC = process.platform === 'darwin';

// Il protocollo va dichiarato PRIMA di app.whenReady(), altrimenti "standard" e
// "secure" non hanno effetto e ci ritroviamo con un'origine opaca come file://.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,        // origine vera -> la CSP 'self' funziona
      secure: true,          // trattato come https -> niente mixed-content warning
      supportFetchAPI: true, // fetch()/XHR sui file dell'app
      stream: true           // range requests (utile se un giorno c'e' audio/video)
    }
  }
]);

/* --------------------------------------------------------------------------
 * Stato finestra (posizione/dimensione) persistito tra i riavvii.
 * Volutamente banale: un JSON in userData. Se e' corrotto o assente si torna ai
 * default, senza mai impedire l'avvio dell'app.
 * ------------------------------------------------------------------------ */
const STATE_FILE = () => path.join(app.getPath('userData'), 'window-state.json');
const DEFAULT_STATE = { width: 1280, height: 800, maximized: false };

function loadWindowState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8'));
    const ok = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;
    return {
      width: ok(raw.width) ? raw.width : DEFAULT_STATE.width,
      height: ok(raw.height) ? raw.height : DEFAULT_STATE.height,
      x: ok(raw.x) ? raw.x : undefined,
      y: ok(raw.y) ? raw.y : undefined,
      maximized: !!raw.maximized
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveWindowState(win) {
  try {
    if (!win || win.isDestroyed()) return;
    const bounds = win.isMaximized() || win.isFullScreen() ? win.getNormalBounds() : win.getBounds();
    fs.writeFileSync(STATE_FILE(), JSON.stringify({ ...bounds, maximized: win.isMaximized() }, null, 2));
  } catch { /* disco pieno o permessi: non e' un motivo per far fallire la chiusura */ }
}

/* --------------------------------------------------------------------------
 * Handler del protocollo app://
 * Serve i file da APP_ROOT. La difesa che conta e' il controllo di path
 * traversal: senza, una richiesta tipo app://baseflow/../../etc/passwd
 * leggerebbe fuori dalla cartella dell'app.
 * ------------------------------------------------------------------------ */
function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url);
    // decodeURIComponent: i nomi file con spazi/accenti arrivano percent-encoded.
    let rel = decodeURIComponent(pathname);
    if (rel === '/' || rel === '') rel = '/index.html';

    const resolved = path.normalize(path.join(APP_ROOT, rel));

    // path.relative() vuoto o che inizia con ".." significa "fuori da APP_ROOT".
    const relToRoot = path.relative(APP_ROOT, resolved);
    if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
      return new Response('Forbidden', { status: 403 });
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      return new Response('Not found', { status: 404 });
    }

    return net.fetch(url.pathToFileURL(resolved).toString());
  });
}

/* --------------------------------------------------------------------------
 * IPC: apertura/salvataggio file nativi (WP Ismail 2026-07-22)
 * Perche' non basta l'API File System Access del browser: non espone MAI un
 * path reale (privacy by design), quindi ogni "Salva" su un file gia' noto
 * puo' solo riusare il NOME e riaprire un picker nativo precompilato -- che
 * su un nome gia' esistente sul disco Windows/macOS trattano come un
 * salvataggio NUOVO e chiedono conferma di overwrite. Con un path VERO (che
 * qui possiamo dare, essendo codice Node nel main) il dialog nativo serve
 * solo alla PRIMA apertura/salvataggio; i "Salva" successivi scrivono
 * direttamente con fs, zero dialog, zero prompt di overwrite.
 * ------------------------------------------------------------------------ */
const BF_FILE_FILTERS = [{ name: 'BaseFlow files', extensions: ['bflow', 'json'] }];
const BF_ALLOWED_EXT = /\.(?:bflow|json)$/i;

function registerFileIpc() {
  ipcMain.handle('bf:open-dialog', async () => {
    const res = await dialog.showOpenDialog(mainWindow, { filters: BF_FILE_FILTERS, properties: ['openFile'] });
    if (res.canceled || !res.filePaths[0]) return null; // annullato: nessuno stato da toccare
    const filePath = res.filePaths[0];
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return { ok: true, path: filePath, content };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  ipcMain.handle('bf:save-dialog', async (event, suggestedName) => {
    const res = await dialog.showSaveDialog(mainWindow, {
      defaultPath: (typeof suggestedName === 'string' && suggestedName) ? suggestedName : 'flowchart.bflow',
      filters: BF_FILE_FILTERS
    });
    if (res.canceled || !res.filePath) return null;
    return res.filePath;
  });

  // Scrittura diretta: nessun dialog. Il path arriva SEMPRE da bf:open-dialog/bf:save-dialog
  // (scelto dall'utente in un picker nativo) o da un path gia' scritto in precedenza nella
  // stessa sessione -- l'estensione e' comunque ricontrollata qui come difesa in profondita'.
  ipcMain.handle('bf:write-file', async (event, filePath, content) => {
    if (typeof filePath !== 'string' || !BF_ALLOWED_EXT.test(filePath)) {
      return { ok: false, error: 'Estensione file non ammessa.' };
    }
    if (typeof content !== 'string') return { ok: false, error: 'Contenuto non valido.' };
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });
}

/* --------------------------------------------------------------------------
 * Finestra principale
 * ------------------------------------------------------------------------ */
let mainWindow = null;

function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 480,   // sotto i 760px l'app passa gia' al layout mobile: regge
    minHeight: 480,
    backgroundColor: '#ffffff', // evita il flash bianco/nero prima del primo paint
    show: false,                // si mostra a "ready-to-show": niente finestra vuota
    title: 'BaseFlow',
    // WP (Ismail 2026-07-22): la barra File/Modifica/Visualizza/Finestra/? e' ridondante con la
    // UI dell'app (manuale/editor gia' raggiungibili da li') e su Windows/Linux occupa spazio in
    // alto senza motivo -- nascosta di default, si riapre con un tocco di Alt se mai servisse
    // (es. DevTools). Su macOS non si applica: la barra dei menu vive fuori dalla finestra.
    autoHideMenuBar: true,
    icon: process.platform === 'linux' ? path.join(__dirname, '..', 'build', 'icon.png') : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,  // il preload gira in un mondo separato dalla pagina
      nodeIntegration: false,  // la pagina NON vede require/process
      sandbox: true,
      webviewTag: false,       // niente <webview>: superficie d'attacco inutile qui
      spellcheck: false
    }
  });

  // Cintura e bretelle: autoHideMenuBar copre gia' la maggior parte delle build di Electron, ma
  // setMenuBarVisibility(false) e' il modo esplicito per assicurarsi che la barra parta nascosta.
  if (!IS_MAC) mainWindow.setMenuBarVisibility(false);

  if (state.maximized) mainWindow.maximize();

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.loadURL(`${APP_ORIGIN}/index.html`);

  // Link esterni (target=_blank, window.open) -> browser di sistema, mai in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//i.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });

  // Navigazione fuori dall'origine dell'app -> bloccata e aperta nel browser.
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith(APP_ORIGIN)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(target)) shell.openExternal(target);
    }
  });

  ['resize', 'move'].forEach((ev) => mainWindow.on(ev, () => saveWindowState(mainWindow)));
  mainWindow.on('close', () => saveWindowState(mainWindow));
  mainWindow.on('closed', () => { mainWindow = null; });
}

/* --------------------------------------------------------------------------
 * Menu applicativo
 * I "role" di Electron danno gratis le scorciatoie native corrette per ogni OS
 * (Cmd vs Ctrl, voci macOS obbligatorie come Services/Hide) -- meglio che
 * ricostruirle a mano.
 * ------------------------------------------------------------------------ */
function buildMenu() {
  const template = [
    ...(IS_MAC ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Manuale',
          accelerator: 'F1',
          click: () => mainWindow && mainWindow.loadURL(`${APP_ORIGIN}/manual.html`)
        },
        {
          label: 'Editor',
          click: () => mainWindow && mainWindow.loadURL(`${APP_ORIGIN}/index.html`)
        },
        { type: 'separator' },
        IS_MAC ? { role: 'close' } : { role: 'quit' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'Visualizza',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Sito del progetto',
          click: () => shell.openExternal('https://github.com/proismamaster/BaseFlow')
        },
        {
          label: 'Informazioni su BaseFlow',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'BaseFlow',
              message: `BaseFlow ${app.getVersion()}`,
              detail: `Electron ${process.versions.electron} · Chromium ${process.versions.chrome} · Node ${process.versions.node}`,
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* --------------------------------------------------------------------------
 * Ciclo di vita
 * ------------------------------------------------------------------------ */

// Istanza singola: un secondo avvio riporta in primo piano la finestra esistente
// invece di aprire una seconda copia dell'editor (due copie = due localStorage
// che si sovrascrivono a vicenda).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    registerFileIpc();
    buildMenu();
    createWindow();

    // macOS: cliccare l'icona nel Dock con zero finestre aperte deve riaprirne una.
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  // Su macOS la convenzione e' che l'app resti viva a finestre chiuse.
  app.on('window-all-closed', () => {
    if (!IS_MAC) app.quit();
  });
}

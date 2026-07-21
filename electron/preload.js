/*
 * BaseFlow -- preload di Electron.
 *
 * Gira con contextIsolation attiva, quindi in un "mondo" JavaScript separato da
 * quello della pagina: la web app NON puo' raggiungere niente di quello che c'e'
 * qui dentro, se non cio' che esponiamo esplicitamente con contextBridge.
 *
 * Regola che vale la pena tenere: non esporre MAI oggetti Node grezzi (fs, child_process,
 * ipcRenderer intero). Se domani serve leggere/scrivere file dal disco, si aggiunge un
 * metodo specifico e stretto (es. saveDiagram(json)) con un handler ipcMain lato main --
 * non un accesso generico al filesystem.
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('BaseFlowDesktop', {
  // Usato in index.html per saltare il purge cache/service-worker pensato per il
  // browser in sviluppo (nel pacchetto non serve e causerebbe un reload a ogni avvio).
  isDesktop: true,
  platform: process.platform, // 'win32' | 'darwin' | 'linux'
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }
});

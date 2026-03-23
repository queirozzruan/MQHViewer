const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mhq', {
  openComicFile: () => ipcRenderer.invoke('dialog:open-comic-file'),
  loadComic: (filePath) => ipcRenderer.invoke('comic:load', filePath),
  getPdfJsPaths: () => ipcRenderer.invoke('pdfjs:get-paths')
});

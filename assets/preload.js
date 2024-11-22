const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  searchEverything: (query) =>
    ipcRenderer.invoke('search-everything', { query }),
  openFile: (filePath) =>
    ipcRenderer.send('open-file', filePath),
});

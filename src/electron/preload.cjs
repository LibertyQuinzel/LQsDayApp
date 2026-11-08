const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('myDay', {
  readState: () => ipcRenderer.invoke('state:read'),
  writeState: (state) => ipcRenderer.send('state:write', state),
  notify: (options) => ipcRenderer.invoke('notification:show', options)
});

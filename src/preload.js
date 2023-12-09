// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electron', {
  send: (command, ...args) => ipcRenderer.send(command, args),
  on: (command, callback) => ipcRenderer.on(command, callback),
})

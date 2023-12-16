// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from "electron";

type ContextBridgeElectron = {
  send: (command: string, arg: any) => void;
  on: (command: string, callback: (event: Electron.IpcRendererEvent, arg: any) => void) => void;
}

const electron: ContextBridgeElectron = {
  send: (command: string, arg: any) => ipcRenderer.send(command, arg),
  on: (
    command: string,
    callback: (event: Electron.IpcRendererEvent, arg: any) => void
  ) => ipcRenderer.on(command, callback),
};

contextBridge.exposeInMainWorld("electron", electron);

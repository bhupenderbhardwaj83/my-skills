// Electron preload — the renderer's whole view of the desktop. Keep it this small: named
// functions with fixed channels, never ipcRenderer itself, never Node modules.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("calmDesktop", {
  platform: process.platform,
  openExternal: (url: string) => ipcRenderer.invoke("calm:open-external", String(url)),
});

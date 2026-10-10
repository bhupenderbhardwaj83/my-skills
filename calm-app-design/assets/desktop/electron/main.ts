// Electron main process — secure defaults for a calm-app-design app (electron-vite layout).
// The renderer is an ordinary web page: no Node, no remote content, one tiny bridge (preload.ts).
import { app, BrowserWindow, ipcMain, nativeTheme, session, shell } from "electron";
import path from "node:path";

const isDev = !app.isPackaged;
const DEV_URL = process.env.ELECTRON_RENDERER_URL; // set by electron-vite in dev

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' http://127.0.0.1:*" + (isDev ? " ws://localhost:*" : ""),
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

function safeExternal(url: string): boolean {
  try { const u = new URL(url); return u.protocol === "https:" || u.protocol === "mailto:"; } catch { return false; }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0f1420" : "#f6f7fa", // = --bg, so no flash on open
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
    },
  });
  win.once("ready-to-show", () => win.show());

  // Links never open inside the app: https/mailto go to the system browser, everything else is dropped.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (safeExternal(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    const allowed = isDev && DEV_URL ? url.startsWith(DEV_URL) : url.startsWith("file://");
    if (!allowed) { e.preventDefault(); if (safeExternal(url)) void shell.openExternal(url); }
  });

  if (isDev && DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadFile(path.join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, cb) =>
    cb({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [CSP] } }));
  // Camera, microphone, notifications… are denied unless the app adds a reviewed exception here.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));

  // The only bridge channels. Validate every argument: the renderer is untrusted.
  ipcMain.handle("calm:open-external", (_e, url: unknown) => {
    if (typeof url === "string" && safeExternal(url)) return shell.openExternal(url);
  });

  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("web-contents-created", (_e, contents) => {
  contents.on("will-attach-webview", (e) => e.preventDefault()); // no <webview> tags
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

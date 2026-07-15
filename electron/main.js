const { app, BrowserWindow, Menu, shell, ipcMain, session } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = process.env.NODE_ENV === "development";

// Single machine, no server/client mode: the API always lives at
// localhost:5000 (the local Express process this same app starts below).
// No arbitrary LAN IP to account for, so the CSP connect-src is a fixed,
// known value instead of something built at runtime from a saved config.
function buildCSP() {
  const apiOrigin = "http://localhost:5000";

  const connectSrc = isDev
    ? `'self' http://localhost:5173 ws://localhost:5173 ${apiOrigin}`
    : `'self' ${apiOrigin}`;

  const scriptSrc = isDev ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self'";

  // Google Fonts fix: style-src allows fonts.googleapis.com (the
  // stylesheet URL), and font-src allows fonts.gstatic.com (where the
  // actual .woff2 files are hosted). Previously neither was present, so
  // the Inter font request was blocked outright on every single launch.
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src ${connectSrc}`,
  ].join("; ");
}

function applyCSP(targetSession) {
  targetSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [buildCSP()],
      },
    });
  });
}

// Diagnostic logger — kept permanently (not just for the white-screen
// investigation). Writes to a plain text file on disk so support issues
// can be diagnosed on any deployed PC without needing DevTools, a dev
// environment, or remote access — just ask the office to send this file.
// Low overhead (a few short fs.appendFileSync calls per page load), so
// there's no real cost to leaving it in for production.
const diagLogPath = path.join(app.getPath("userData"), "load-debug.log");
function diagLog(line) {
  try {
    fs.appendFileSync(diagLogPath, `[${new Date().toISOString()}] ${line}\n`, "utf8");
  } catch {
    // never let logging itself crash the app
  }
}

let mainWindow;
function prepareServerDatabase() {
  const userDataDir = app.getPath("userData");
  const writableDbPath = path.join(userDataDir, "revenue.db");

  process.env.SQLITE_DB_PATH = writableDbPath;

  process.env.SQLITE_SCHEMA_PATH = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar", "server", "data", "schema.sql")
    : path.join(__dirname, "..", "server", "data", "schema.sql");

  const bundledDbPath = app.isPackaged
    ? path.join(process.resourcesPath, "app.asar", "server", "data", "revenue.db")
    : path.join(__dirname, "..", "server", "data", "revenue.db");

  try {
    if (!fs.existsSync(writableDbPath)) {
      if (fs.existsSync(bundledDbPath)) {
        fs.copyFileSync(bundledDbPath, writableDbPath);
        diagLog(`SQLite DB copied to writable path: ${writableDbPath}`);
      } else {
        diagLog(`WARNING: Bundled revenue.db not found at: ${bundledDbPath}`);
      }
    }

    diagLog(`SQLITE_DB_PATH = ${process.env.SQLITE_DB_PATH}`);
    diagLog(`SQLITE_SCHEMA_PATH = ${process.env.SQLITE_SCHEMA_PATH}`);
  } catch (err) {
    diagLog(`ERROR preparing SQLite DB: ${err.message}`);
    throw err;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);

  applyCSP(mainWindow.webContents.session);

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    diagLog(`did-fail-load: code=${errorCode} desc="${errorDescription}" url="${validatedURL}"`);
  });

  mainWindow.webContents.on("render-process-gone", (event, details) => {
    diagLog(`render-process-gone: reason=${details.reason} exitCode=${details.exitCode}`);
  });

  mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
    diagLog(`console[${level}]: ${message} (${sourceId}:${line})`);
  });

  // Single machine, no server/client mode: dev always points at the Vite
  // dev server; production always points at the local Express process
  // this same app starts in app.whenReady() below.
  if (isDev) {
    diagLog("Loading dev server at http://localhost:5173");
    mainWindow.loadURL("http://localhost:5173");
  } else {
    diagLog("Loading local server at http://localhost:5000");
    mainWindow.loadURL("http://localhost:5000");
  }

  mainWindow.once("ready-to-show", () => {
    diagLog("ready-to-show fired");
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "about:blank") {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 850,
          height: 1000,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });

  // DevTools only in dev mode now — the forced openDevTools({ mode:
  // "detach" }) used during the white-screen investigation has been
  // removed. All three root causes found during that investigation
  // (BrowserRouter incompatible with file://, absolute /seal.jpg paths,
  // api.js baseURL race condition) are now fixed and confirmed via
  // load-debug.log + DevTools testing, so production builds no longer
  // need DevTools forced open for end users.
  if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
}

// ── Printing: detect printers and print official receipts ────────────────────
//
// getPrintersAsync() enumerates every printer the OS exposes — USB/wired,
// network/IP, AND wireless — with no per-connection-type handling needed.
// Access stays entirely in the main process; the renderer reaches it only
// through the narrow contextBridge channels in preload.js (listPrinters /
// printReceipt), consistent with the existing IPC pattern and the strict
// contextIsolation/sandbox posture of every window.
ipcMain.handle("printers:list", async () => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return [];
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      description: p.description || "",
      status: typeof p.status === "number" ? (p.status === 0 ? "Ready" : `Status ${p.status}`) : "",
      isDefault: !!p.isDefault,
    }));
  } catch (err) {
    diagLog(`printers:list error: ${err.message}`);
    return [];
  }
});

// Renderer builds the data-only overlay HTML (single source of coordinate
// logic in OfficialReceiptForm51.jsx) and hands it here as a string. We render
// it in a hidden window sized to the form and print SILENTLY to the chosen
// device — so nothing but the variable data lands on the pre-printed pad.
ipcMain.handle("receipt:print", async (event, payload) => {
  const {
    html,
    deviceName = "",
    copies = 1,
    pageWidthMm = 128,
    pageHeightMm = 208,
  } = payload || {};

  if (!html || typeof html !== "string") {
    return { success: false, failureReason: "No receipt content to print." };
  }

  let printWin = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  try {
    await printWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    // brief settle so layout/fonts are ready before the print snapshot
    await new Promise((r) => setTimeout(r, 150));

    const result = await new Promise((resolve) => {
      printWin.webContents.print(
        {
          silent: true,
          deviceName: deviceName || undefined,
          printBackground: false,
          margins: { marginType: "none" },
          copies: Math.max(1, Number(copies) || 1),
          pageSize: {
            width: Math.round(pageWidthMm * 1000),   // mm -> microns
            height: Math.round(pageHeightMm * 1000),
          },
        },
        (success, failureReason) => resolve({ success, failureReason })
      );
    });

    if (!result.success) diagLog(`receipt:print failed: ${result.failureReason}`);
    return result;
  } catch (err) {
    diagLog(`receipt:print error: ${err.message}`);
    return { success: false, failureReason: err.message };
  } finally {
    if (printWin && !printWin.isDestroyed()) printWin.close();
    printWin = null;
  }
});

// Receives crash reports forwarded by preload.js's window.onerror /
// unhandledrejection listeners. Kept permanently for the same reason as
// diagLog above — console-message alone never catches silent renderer
// crashes (uncaught exceptions thrown before any console.error call),
// and having this land in load-debug.log means a future white-screen-
// style bug on any deployed PC is diagnosable from one log file instead
// of requiring DevTools access in person.
ipcMain.on("renderer-crash-log", (event, payload) => {
  diagLog(`RENDERER CRASH [${payload.type}]: ${payload.message || payload.reason}`);
  if (payload.filename) diagLog(`  at ${payload.filename}:${payload.lineno}:${payload.colno}`);
  if (payload.stack) diagLog(`  stack: ${payload.stack}`);
});

app.whenReady().then(() => {
  // Single machine, no server/client mode: this app always owns and
  // starts its own local Express + SQLite process. In dev, the server is
  // started separately by "npm run dev:server" (nodemon), so only start
  // it here for production/packaged builds.
  if (!isDev) {
    prepareServerDatabase();
    require("../server/server");
  }

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
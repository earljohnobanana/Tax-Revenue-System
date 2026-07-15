const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  appVersion: () => process.env.npm_package_version || "1.0.0",

  // ── Official-receipt printing ──────────────────────────────────────────────
  // listPrinters() returns all OS printers (wired, network, wireless) so the
  // operator can pick their counter printer. printReceipt() hands the main
  // process a finished data-only overlay HTML string plus the chosen device
  // and page size; main renders it hidden and prints silently. Same narrow,
  // invoke-only pattern — no raw Node API crosses into the renderer.
  listPrinters: () => ipcRenderer.invoke("printers:list"),
  printReceipt: (payload) => ipcRenderer.invoke("receipt:print", payload),
});

// ── TEMPORARY DIAGNOSTIC: catch silent renderer crashes ──────────────────────
//
// console-message events in main.js only fire for explicit console.log/
// console.error/console.warn calls — they do NOT fire for uncaught
// exceptions or unhandled promise rejections. A React app that throws
// during initial mount (before any try/catch or error boundary runs)
// produces a fully blank white screen with ZERO console-message output,
// which is exactly the symptom seen on Client PCs: ready-to-show fires,
// the page loads, and then nothing — no error, no UI, no log entry.
//
// This listens at the lowest possible level (window.onerror /
// unhandledrejection, registered in the preload script BEFORE any
// renderer/app code runs) and forwards the error back to main.js over
// the same safe, narrow IPC channel pattern as the rest of this file —
// no raw Node API exposed to the renderer, just a one-way "here is what
// crashed" message. Remove this block once the white-screen issue is
// confirmed fixed and root-caused.
window.addEventListener("error", (event) => {
  ipcRenderer.send("renderer-crash-log", {
    type: "error",
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack || null,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  ipcRenderer.send("renderer-crash-log", {
    type: "unhandledrejection",
    reason: event.reason?.message || String(event.reason),
    stack: event.reason?.stack || null,
  });
});
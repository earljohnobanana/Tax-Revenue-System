// sta-catalina-btrf/src/components/receipts/ReceiptPrintModal.jsx
// ---------------------------------------------------------------------------
// Shared print-preview modal for Official Receipts (Form 51 overlay).
//
// This is the ONE place in the app that talks to window.electronAPI's
// printer IPC. Every page that prints a receipt (PaymentsPage, ReceiptsPage)
// renders this modal instead of calling printReceipt() directly, so there is
// exactly one printer-detection + preview + print flow, not several
// slightly-different copies that can silently drift apart.
//
// Flow:
//   1. Caller builds the receipt HTML (buildOverlayHtml) and opens this modal
//      with it — nothing is sent to a printer yet.
//   2. On open, printers are detected via window.electronAPI.listPrinters()
//      (Electron main process; enumerates wired, network AND wireless
//      printers uniformly via getPrintersAsync()).
//   3. The operator sees a live preview of exactly what will be printed
//      (an iframe rendering the same HTML, sized to the real page
//      dimensions) before committing to anything.
//   4. Operator picks a printer + copies, clicks Print -> printReceipt() IPC
//      (silent print straight to the chosen device).
//   5. Non-Electron (browser/dev) fallback: no printer list to fetch, but
//      still shows the same preview; "Print" opens a real window and calls
//      window.print() so the OS/browser print dialog takes over.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { Printer, X, Loader2 } from "lucide-react";

const PRINTER_PREF_KEY = "bpls.receiptPrinter";
const MM_TO_PX = 96 / 25.4; // CSS px per mm at 96 DPI — preview sizing only, never sent to the printer

export default function ReceiptPrintModal({
  open,
  html,
  pageWidthMm = 128,
  pageHeightMm = 208,
  title = "Print Official Receipt",
  onClose,
}) {
  const isElectron = typeof window !== "undefined" && !!window.electronAPI?.printReceipt;

  const [printers, setPrinters] = useState([]);
  const [selected, setSelected] = useState("");
  const [copies, setCopies] = useState(1);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setError("");
    setCopies(1);

    if (!isElectron) return; // browser/dev fallback has no printer list to load

    let cancelled = false;
    setLoadingPrinters(true);
    window.electronAPI
      .listPrinters()
      .then((list) => {
        if (cancelled) return;
        setPrinters(list || []);
        const remembered = localStorage.getItem(PRINTER_PREF_KEY);
        const def =
          (list || []).find((p) => p.name === remembered) ||
          (list || []).find((p) => p.isDefault) ||
          (list || [])[0];
        setSelected(def ? def.name : "");
      })
      .catch((e) => {
        if (!cancelled) setError("Could not read printers: " + e.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingPrinters(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, isElectron]);

  if (!open) return null;

  async function handlePrintClick() {
    setError("");

    if (!isElectron) {
      // Browser/dev fallback: real window + native print dialog.
      const win = window.open("", "_blank", "width=520,height=760");
      if (!win) {
        setError("Please allow pop-ups to print the official receipt.");
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.onload = () => win.print();
      onClose();
      return;
    }

    if (!selected) {
      setError("Choose a printer first.");
      return;
    }

    setPrinting(true);
    try {
      const res = await window.electronAPI.printReceipt({
        html,
        deviceName: selected,
        copies: Number(copies) || 1,
        pageWidthMm,
        pageHeightMm,
      });
      if (res?.success) {
        localStorage.setItem(PRINTER_PREF_KEY, selected);
        onClose();
      } else {
        setError("Print failed: " + (res?.failureReason || "unknown error"));
      }
    } catch (e) {
      setError("Print error: " + e.message);
    } finally {
      setPrinting(false);
    }
  }

  const previewWidthPx = Math.round(pageWidthMm * MM_TO_PX);
  const previewHeightPx = Math.round(pageHeightMm * MM_TO_PX);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex flex-1 flex-col">
          <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="text-[14px] font-bold text-gray-900">{title}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Preview pane — shows exactly what will be printed before anything is sent to a device */}
            <div className="flex flex-1 items-start justify-center overflow-auto bg-gray-100 p-4">
              <div className="bg-white shadow-md" style={{ width: previewWidthPx, height: previewHeightPx }}>
                <iframe
                  title="Receipt preview"
                  srcDoc={html}
                  style={{ width: "100%", height: "100%", border: "none" }}
                />
              </div>
            </div>

            {/* Controls pane */}
            <div className="w-[240px] flex-shrink-0 overflow-y-auto border-l border-gray-100 p-4">
              {isElectron ? (
                loadingPrinters ? (
                  <div className="flex items-center gap-2 py-6 text-[12px] text-slate-500">
                    <Loader2 className="animate-spin" size={16} /> Detecting printers…
                  </div>
                ) : (
                  <>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Printer</label>
                    <select
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                      className="mb-3 w-full rounded-lg border border-slate-300 px-2 py-2 text-[12px]"
                    >
                      {printers.length === 0 && <option value="">No printers found</option>}
                      {printers.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.displayName}
                          {p.isDefault ? " (default)" : ""}
                        </option>
                      ))}
                    </select>

                    {printers.length === 0 && (
                      <p className="mb-3 text-[10px] text-amber-700">
                        No printers detected on this PC. Install/connect a printer in Windows, then reopen this dialog.
                      </p>
                    )}

                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Copies</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={copies}
                      onChange={(e) => setCopies(e.target.value)}
                      className="mb-3 w-20 rounded-lg border border-slate-300 px-2 py-2 text-[12px]"
                    />
                    <p className="mb-4 text-[10px] text-slate-400">
                      Pre-printed carbon triplicate forms: leave copies at 1 — the carbon makes all three.
                    </p>
                  </>
                )
              ) : (
                <p className="mb-4 text-[11px] text-slate-500">
                  Running in browser/dev mode — Print will open your OS print dialog instead of a direct printer.
                </p>
              )}

              {error && <p className="mb-3 text-[11px] text-red-600">{error}</p>}

              <div className="flex flex-col gap-2">
                <button
                  onClick={handlePrintClick}
                  disabled={printing || loadingPrinters || (isElectron && !selected)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-[12px] font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                >
                  {printing ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} />}
                  {printing ? "Printing…" : "Print"}
                </button>
                <button
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

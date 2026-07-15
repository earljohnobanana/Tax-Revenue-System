// sta-catalina-btrf/src/components/receipts/OfficialReceiptForm51.jsx
// ---------------------------------------------------------------------------
// Prints a BPLS payment batch onto the PRE-PRINTED Accountable Form No. 51.
//
// Only VARIABLE data is printed (OR number, payor, date, agency, the
// nature-of-collection lines with amounts, total, amount-in-words, payment-mode
// check, check/MO details, and collecting officer). The pre-printed pad
// supplies every border, seal, heading and grid — so this must NOT redraw them.
//
// Two print paths, auto-detected:
//   • Electron (window.electronAPI.printReceipt present): silent print to a
//     chosen printer. Printers are detected via the main process
//     (getPrintersAsync), which enumerates wired, network AND wireless printers
//     uniformly. A small picker lets the operator choose their counter printer.
//   • Browser / dev fallback: window.open + window.print().
//
// Collecting officer and agency are DB-driven — pass them as props sourced from
// municipality_settings. Nothing here is hardcoded.
//
// Exports:
//   - default <OfficialReceiptForm51 />  the print button (+ printer picker)
//   - printOfficialReceipt(batch, opts)  imperative browser-fallback helper
//   - buildOverlayHtml(receipt, cfg)     pure HTML builder (also used by main)
//   - mapBatchToReceipt(batch, opts)     batch -> receipt view model
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { Printer, X, Loader2 } from 'lucide-react';
import { amountInWords, formatPeso } from '../../utils/amountToWords';
import { FORM51_CONFIG } from '../../config/receiptForm51.config';

const PRINTER_PREF_KEY = 'bpls.receiptPrinter';

// ── helpers ─────────────────────────────────────────────────────────────────
function formatDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function toLine(p) {
  return {
    nature: p.taxType ?? p.tax_type ?? '',
    code: p.accountCode ?? p.account_code ?? '', // from API; never hardcoded
    amount: Number(p.totalPaid ?? p.total_paid ?? 0),
  };
}

/** Map a payment batch (one shared OR) + settings into the receipt view model. */
export function mapBatchToReceipt(batch, opts = {}) {
  const rows = batch.payments ?? batch.items ?? [];
  const first = rows[0] ?? {};

  const rawMode = (first.paymentMethod ?? first.payment_method ?? 'Cash').toLowerCase();
  const mode = rawMode.includes('check')
    ? 'Check'
    : rawMode.includes('money') || rawMode.includes('order')
      ? 'Money Order'
      : 'Cash';

  const lines = rows.map(toLine).filter((l) => l.amount > 0);
  const total = lines.reduce((s, l) => s + l.amount, 0);

  return {
    orNumber: batch.orNumber ?? first.orNumber ?? first.or_number ?? '',
    payor: batch.ownerName ?? first.ownerName ?? first.owner_name ?? '',
    date: formatDate(batch.datePaid ?? first.datePaid ?? first.date_paid ?? ''),
    agency: opts.agency ?? batch.agency ?? 'MTO',
    fund: opts.fund ?? batch.fund ?? '',
    mode,
    draweeBank: first.draweeBank ?? first.drawee_bank ?? '',
    instNum: first.instrumentNumber ?? first.instrument_number ?? '',
    instDate: formatDate(first.instrumentDate ?? first.instrument_date ?? ''),
    collectingOfficer: opts.collectingOfficer ?? batch.collectingOfficer ?? '',
    lines,
    total,
  };
}

/** Build the isolated, data-only overlay document. Pure — no side effects. */
export function buildOverlayHtml(r, cfg = FORM51_CONFIG) {
  const p = cfg.pos;
  const off = (x, y) => `left:calc(${x}% + ${cfg.offX}mm);top:calc(${y}% + ${cfg.offY}mm);`;
  const F = [];
  const add = (cond, x, y, text, cls = '', style = '') => {
    if (cond && text !== '' && text != null) {
      F.push(`<div class="f ${cls}" style="${off(x, y)}${style}">${esc(text)}</div>`);
    }
  };

  if (p.orNumber) add(!!r.orNumber, p.orNumber.x, p.orNumber.y, r.orNumber, 'b');
  add(true, p.date.x, p.date.y, r.date);
  add(true, p.agency.x, p.agency.y, r.agency);
  add(!!r.fund, p.fund.x, p.fund.y, r.fund);
  add(true, p.payor.x, p.payor.y, r.payor);

  // The nature-of-collection rows sit between firstRowY and the pre-printed
  // TOTAL box (totalY). At the calibrated rowStep, only so many rows fit
  // before the last one would land on top of TOTAL instead of above it. A
  // receipt with more lines than that no longer refuses to print — instead
  // the rows compress (smaller step, slightly smaller type) so every line
  // still fits above TOTAL, matching how a clerk would hand-write extra
  // rows tighter to fit the same pre-printed box.
  const n = r.lines.length;
  const totalGap = 2.2; // % — breathing room between the last row and TOTAL
  const available = p.totalY - p.firstRowY - totalGap;
  const naturalSpan = (n - 1) * p.rowStep;
  const step = n > 1 && naturalSpan > available && available > 0
    ? available / (n - 1)
    : p.rowStep;
  const rowFontScale = step < p.rowStep ? Math.max(0.72, step / p.rowStep) : 1;
  const rowStyle = rowFontScale < 1 ? `font-size:${(cfg.fontSize * rowFontScale).toFixed(2)}px;` : '';

  let lastRowY = p.firstRowY;
  r.lines.forEach((l, i) => {
    const y = p.firstRowY + i * step;
    lastRowY = y;
    add(true, p.natureX, y, l.nature, '', rowStyle);
    add(!!l.code, p.codeX, y, l.code, '', rowStyle);
    F.push(`<div class="f r" style="${off(p.amountRightX, y)}${rowStyle}">${formatPeso(l.amount)}</div>`);
  });

  // TOTAL normally sits at the form's pre-printed position; only pushed
  // lower than that if an extreme line count still runs past it even after
  // compression, so it's never printed on top of a collection line.
  const totalY = Math.max(p.totalY, lastRowY + step * 0.9);
  F.push(`<div class="f r" style="${off(p.totalRightX, totalY)}">${formatPeso(r.total)}</div>`);
  add(true, p.wordsX, p.wordsY, amountInWords(r.total));

  const modeY = r.mode === 'Cash' ? p.cashY : r.mode === 'Check' ? p.checkY : p.moY;
  F.push(`<div class="f b" style="${off(p.modeMarkX, modeY)}">&#10003;</div>`);

  if (r.mode !== 'Cash') {
    add(!!r.draweeBank, p.draweeX, p.checkDetailsY, r.draweeBank);
    add(!!r.instNum, p.instNumX, p.checkDetailsY, r.instNum);
    add(!!r.instDate, p.instDateX, p.checkDetailsY, r.instDate);
  }

  if (p.collectingOfficer) {
    // Printed in caps to match the pre-printed form's convention, regardless
    // of how the name was typed into Settings.
    add(!!r.collectingOfficer, p.collectingOfficer.x, p.collectingOfficer.y, String(r.collectingOfficer).toUpperCase(), 'cen b');
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Official Receipt</title>
<style>
  @page { size: ${cfg.pageW}mm ${cfg.pageH}mm; margin: 0; }
  html,body { margin:0; padding:0; }
  #sheet { position:relative; width:${cfg.pageW}mm; height:${cfg.pageH}mm;
    font-family: Arial, Helvetica, sans-serif; font-size:${cfg.fontSize}px; color:#000; }
  .f { position:absolute; white-space:nowrap; line-height:1.05; font-variant-numeric:tabular-nums; }
  .f.r { transform:translateX(-100%); text-align:right; }
  .f.cen { transform:translateX(-50%); text-align:center; }
  .f.b { font-weight:700; }
</style></head><body><div id="sheet">${F.join('')}</div></body></html>`;
}

function mergeConfig(override) {
  if (!override) return FORM51_CONFIG;
  return { ...FORM51_CONFIG, ...override, pos: { ...FORM51_CONFIG.pos, ...(override.pos || {}) } };
}

/** Browser / dev fallback: open a window and print. */
export function printOfficialReceipt(batch, opts = {}) {
  const cfg = mergeConfig(opts.configOverride);
  const receipt = mapBatchToReceipt(batch, opts);
  if (!receipt.lines.length) {
    // eslint-disable-next-line no-alert
    alert('Nothing to print: this receipt has no collection lines with an amount.');
    return;
  }
  const win = window.open('', '_blank', 'width=520,height=760');
  if (!win) {
    // eslint-disable-next-line no-alert
    alert('Please allow pop-ups to print the official receipt.');
    return;
  }
  win.document.open();
  win.document.write(buildOverlayHtml(receipt, cfg));
  win.document.close();
  win.focus();
  win.onload = () => win.print();
}

// ── the button + printer picker ───────────────────────────────────────────────
export default function OfficialReceiptForm51({
  batch,
  collectingOfficer = '',
  agency,
  fund,
  configOverride,
  label = 'Print Official Receipt',
  className = '',
  disabled = false,
}) {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.printReceipt;

  const [open, setOpen] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [selected, setSelected] = useState('');
  const [copies, setCopies] = useState(1);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState('');

  const opts = { collectingOfficer, agency, fund, configOverride };

  async function handleClick() {
    setError('');
    if (!isElectron) {
      printOfficialReceipt(batch, opts); // browser/dev
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const list = await window.electronAPI.listPrinters();
      setPrinters(list || []);
      const remembered = localStorage.getItem(PRINTER_PREF_KEY);
      const def = (list || []).find((p) => p.name === remembered)
        || (list || []).find((p) => p.isDefault)
        || (list || [])[0];
      setSelected(def ? def.name : '');
    } catch (e) {
      setError('Could not read printers: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function doPrint() {
    setError('');
    setPrinting(true);
    try {
      const cfg = mergeConfig(configOverride);
      const receipt = mapBatchToReceipt(batch, opts);
      if (!receipt.lines.length) {
        setError('This receipt has no collection lines with an amount.');
        return;
      }
      const html = buildOverlayHtml(receipt, cfg);
      const res = await window.electronAPI.printReceipt({
        html,
        deviceName: selected,
        copies: Number(copies) || 1,
        pageWidthMm: cfg.pageW,
        pageHeightMm: cfg.pageH,
      });
      if (res?.success) {
        if (selected) localStorage.setItem(PRINTER_PREF_KEY, selected);
        setOpen(false);
      } else {
        setError('Print failed: ' + (res?.failureReason || 'unknown error'));
      }
    } catch (e) {
      setError('Print error: ' + e.message);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        className={className ||
          'inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50'}
      >
        <Printer size={16} />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[420px] rounded-xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Print Official Receipt</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-6 text-slate-500">
                <Loader2 className="animate-spin" size={18} /> Detecting printers…
              </div>
            ) : (
              <>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Printer (wired or wireless)</label>
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {printers.length === 0 && <option value="">No printers found</option>}
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName}{p.isDefault ? '  (default)' : ''}{p.status ? ` — ${p.status}` : ''}
                    </option>
                  ))}
                </select>

                <label className="mb-1 block text-xs font-semibold text-slate-500">Copies</label>
                <input
                  type="number" min={1} max={5} value={copies}
                  onChange={(e) => setCopies(e.target.value)}
                  className="mb-2 w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <p className="mb-4 text-xs text-slate-400">
                  For pre-printed carbon triplicate forms, leave copies at 1 — the carbon makes all three.
                </p>

                {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-2">
                  <button onClick={() => setOpen(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Cancel
                  </button>
                  <button onClick={doPrint} disabled={printing || !selected}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">
                    {printing ? <Loader2 className="animate-spin" size={16} /> : <Printer size={16} />}
                    {printing ? 'Printing…' : 'Print'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

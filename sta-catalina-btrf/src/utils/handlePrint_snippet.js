// Drop into PaymentsPage.jsx, REPLACING the existing handlePrint function.
// Also add at the top of PaymentsPage.jsx:
//   import sealImg from "../../assets/seal.jpg";
// Needs one new import added at the top of PaymentsPage.jsx:
//   import { amountToWords } from "../../utils/numberToWords";

// Renders one printable Official Receipt for every payment row that shares
// the clicked row's OR number — not just the single row clicked. A batch
// submission (Business Tax + Mayor's Permit + Regulatory Fees recorded
// together) shares one OR number across multiple `payments` rows by design
// (see payments.controller.js createPayments), so printing only the
// clicked row would silently omit the other line items from the receipt.
const handlePrint = (payment) => {
  const sameOR = payments.filter((p) => p.orNumber === payment.orNumber);
  const rows = sameOR.length > 0 ? sameOR : [payment];

  const grandTotal = rows.reduce((sum, p) => sum + moneyNumber(p.totalPaid), 0);

  // One row in the "Nature of Collection" table per distinct line item.
  // taxType is the most specific label available per row (Business Tax /
  // Mayor's Permit / Regulatory Fees) — matches the confirmed mapping.
  const natureRows = rows
    .map((p) => ({
      label: p.taxType || "—",
      amount: moneyNumber(p.totalPaid),
    }))
    .filter((r) => r.amount > 0);

  // Pad to a fixed number of visual rows so the table always has the same
  // shape as the physical form, regardless of how many line items exist.
  const MIN_ROWS = 6;
  const blankRowsNeeded = Math.max(MIN_ROWS - natureRows.length, 0);

  const first = rows[0];

  const win = window.open("", "_blank", "width=850,height=1000");
  if (!win) {
    toast.error("Popup blocked. Please allow popups to print receipts.");
    return;
  }

  win.document.write(`
    <html>
      <head>
        <title>OR ${first.orNumber}</title>
        <style>
          @page { size: 5.5in 8.5in; margin: 0.4in; }
          body { font-family: Georgia, 'Times New Roman', serif; color: #111827; margin: 0; }
          .receipt { border: 1.5px solid #000; padding: 14px; }
          .header { display: flex; align-items: center; justify-content: center; gap: 14px; text-align: center; border-bottom: 1.5px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
          .header img { width: 52px; height: 52px; object-fit: contain; }
          .header .titles p { margin: 1px 0; }
          .header .titles .republic { font-size: 11px; }
          .header .titles .prov { font-size: 13px; font-weight: bold; letter-spacing: 0.5px; }
          .header .titles .office { font-size: 11px; }
          .header .titles .city { font-size: 11px; font-style: italic; }
          .meta-row { display: flex; justify-content: space-between; border-bottom: 1px solid #000; padding-bottom: 6px; margin-bottom: 6px; font-size: 11px; }
          .meta-row .form-no p { margin: 0; }
          .meta-row .or-no { text-align: right; }
          .meta-row .or-no .dup { font-weight: bold; font-size: 12px; letter-spacing: 1px; }
          .meta-row .or-no .num { font-weight: bold; font-size: 16px; }
          .field-row { display: flex; gap: 16px; font-size: 12px; margin-bottom: 4px; }
          .field-row .field { flex: 1; border-bottom: 1px solid #999; padding-bottom: 2px; }
          .field-row .field .label { font-size: 9px; text-transform: uppercase; color: #555; display: block; }
          table.nature { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          table.nature th, table.nature td { border: 1px solid #000; padding: 4px 6px; }
          table.nature th { background: #f3f4f6; font-size: 9px; text-transform: uppercase; }
          table.nature td.amount { text-align: right; font-family: monospace; }
          table.nature tr.blank td { height: 18px; }
          table.nature tr.total td { font-weight: bold; }
          .words-row { font-size: 11px; border: 1px solid #000; border-top: none; padding: 6px; }
          .words-row .label { font-size: 9px; text-transform: uppercase; color: #555; display: block; margin-bottom: 2px; }
          .pay-method { display: flex; gap: 18px; font-size: 11px; margin-top: 8px; align-items: flex-start; }
          .pay-method .checks { display: flex; flex-direction: column; gap: 3px; }
          .pay-method .checks label { display: flex; align-items: center; gap: 5px; }
          .pay-method .bank-fields { flex: 1; display: flex; gap: 10px; }
          .pay-method .bank-fields .field { flex: 1; border-bottom: 1px solid #999; font-size: 10px; padding-bottom: 2px; }
          .received { margin-top: 18px; font-size: 12px; }
          .signature { margin-top: 38px; text-align: center; font-size: 12px; }
          .signature .name { font-weight: bold; border-top: 1px solid #000; display: inline-block; padding-top: 2px; min-width: 220px; }
          .signature .role { font-size: 10px; text-transform: uppercase; color: #555; margin-top: 2px; }
          .note { font-size: 9px; color: #555; border-top: 1px solid #000; margin-top: 14px; padding-top: 6px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <img src="${sealImg}" alt="Seal" />
            <div class="titles">
              <p class="republic">Republic of the Philippines</p>
              <p class="prov">PROVINCE OF NEGROS ORIENTAL</p>
              <p class="office">OFFICE OF THE TREASURER</p>
              <p class="city">Santa Catalina</p>
            </div>
            <img src="${sealImg}" alt="Seal" />
          </div>

          <div class="meta-row">
            <div class="form-no">
              <p>Accountable Form No. 51</p>
              <p>(Revised January 1992)</p>
            </div>
            <div class="or-no">
              <p class="dup">OFFICIAL RECEIPT</p>
              <p class="num">NO No. ${first.orNumber}</p>
            </div>
          </div>

          <div class="field-row">
            <div class="field"><span class="label">Date</span>${first.datePaid}</div>
            <div class="field"><span class="label">Agency</span>MTO</div>
            <div class="field"><span class="label">Fund</span>&nbsp;</div>
          </div>
          <div class="field-row">
            <div class="field"><span class="label">Payor</span>${first.ownerName || "—"}${first.businessName ? ` — ${first.businessName}` : ""}</div>
          </div>

          <table class="nature">
            <thead>
              <tr>
                <th style="width:55%">Nature of Collection</th>
                <th style="width:20%">Account Code</th>
                <th style="width:25%">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${natureRows.map((r) => `
                <tr>
                  <td>${r.label}</td>
                  <td></td>
                  <td class="amount">${formatPeso(r.amount)}</td>
                </tr>
              `).join("")}
              ${Array.from({ length: blankRowsNeeded }).map(() => `
                <tr class="blank"><td></td><td></td><td></td></tr>
              `).join("")}
              <tr class="total">
                <td colspan="2" style="text-align:right">TOTAL</td>
                <td class="amount">${formatPeso(grandTotal)}</td>
              </tr>
            </tbody>
          </table>

          <div class="words-row">
            <span class="label">Amount in Words</span>
            ${amountToWords(grandTotal)}
          </div>

          <div class="pay-method">
            <div class="checks">
              <label><input type="checkbox" checked /> Cash</label>
              <label><input type="checkbox" /> Check</label>
              <label><input type="checkbox" /> Money Order</label>
            </div>
            <div class="bank-fields">
              <div class="field"><span class="label">Drawee Bank</span>&nbsp;</div>
              <div class="field"><span class="label">Number</span>&nbsp;</div>
              <div class="field"><span class="label">Date</span>&nbsp;</div>
            </div>
          </div>

          <p class="received">Received the amount stated above.</p>

          <div class="signature">
            <p class="name">${first.processedBy || "—"}</p>
            <p class="role">Collecting Officer</p>
          </div>

          <p class="note">
            NOTE: Write the number and date of this receipt on the back of check or money order received.
          </p>
        </div>
        <script>window.print();</script>
      </body>
    </html>
  `);
  win.document.close();
};
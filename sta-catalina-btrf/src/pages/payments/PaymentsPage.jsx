// sta-catalina-btrf/src/pages/payments/PaymentsPage.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Printer,
  CreditCard,
  AlertCircle,
  Edit,
  Trash2,
  X,
  Save,
  CheckSquare,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import PageHeader from "../../components/shared/PageHeader";
import useRegulatoryFees from "../../hooks/useRegulatoryFees";
import usePolling from "../../hooks/usePolling";
import {
  formatPeso,
  computeInterest,
  getDueDate,
  getPeriodLabel,
} from "../../utils/taxUtils";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { FORM51_CONFIG } from "../../config/receiptForm51.config";
import { buildOverlayHtml } from "../../components/receipts/OfficialReceiptForm51";
import ReceiptPrintModal from "../../components/receipts/ReceiptPrintModal";

const PAY_METHODS = ["FULL PAYMENT", "QUARTERLY", "BIANNUAL"];
const QUARTERS = [1, 2, 3, 4];
const HALVES = [1, 2];

// Maps assessments.payment_frequency (DB enum) to the PAY_METHODS string
// this page and the backend's installmentCalc.js both use. Must stay in
// sync with FREQUENCY_TO_METHOD in server/utils/installmentCalc.js — that
// file is the real enforcement point; this is only the UI's mirror of it.
const FREQUENCY_TO_METHOD = {
  Annual: "FULL PAYMENT",
  Quarterly: "QUARTERLY",
  "Semi-Annual": "BIANNUAL",
};

const defaultBizEntry = () => ({
  selected: false,
  payBusinessTax: false,
  businessTaxAmount: "",
  btMethod: "FULL PAYMENT",
  btQuarter: 1,
  btHalf: 1,
  btORNumber: "",
  payMayorsPermit: false,
  mpAmount: "",
  mpORNumber: "",
  payRegFees: false,
  selectedFees: [],
  feeAmounts: {},
  regORNumber: "",
});

const safeText = (value) => String(value ?? "");
const safeLower = (value) => safeText(value).toLowerCase();
const toId = (value) => (value === null || value === undefined ? "" : String(value));
const sameId = (a, b) => toId(a) === toId(b);
const moneyNumber = (value) => Number(value || 0);
const firstValue = (...values) => values.find((v) => v !== undefined && v !== null && v !== "");

const getPayloadArray = (payload, key) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
};

const dateOnly = (value) => {
  if (!value) return new Date().toISOString().split("T")[0];
  return String(value).split("T")[0];
};

const taxYearFromDate = (value) => {
  const year = Number(dateOnly(value).slice(0, 4));
  return Number.isFinite(year) ? year : new Date().getFullYear();
};

const normalizeOwner = (owner = {}) => ({
  ...owner,
  id: toId(firstValue(owner.id, owner.ownerId, owner.owner_id)),
  name: firstValue(owner.name, owner.ownerName, owner.owner_name, owner.fullName, owner.full_name, "Unnamed Owner"),
  contact: firstValue(owner.contact, owner.contactNumber, owner.contact_number, owner.phone, ""),
  address: firstValue(owner.address, owner.ownerAddress, owner.owner_address, ""),
  businessCount: Number(firstValue(owner.businessCount, owner.business_count, owner.totalBusinesses, owner.total_businesses, 0)) || 0,
});

const normalizeBusiness = (business = {}) => ({
  ...business,
  id: toId(firstValue(business.id, business.businessId, business.business_id)),
  ownerId: toId(firstValue(business.ownerId, business.owner_id, business.ownerID)),
  businessName: firstValue(business.businessName, business.business_name, business.name, business.tradeName, business.trade_name, "Unnamed Business"),
  lineOfBusiness: firstValue(business.lineOfBusiness, business.line_of_business, business.businessLine, business.business_line, business.type, ""),
  address: firstValue(business.address, business.businessAddress, business.business_address, ""),
  status: firstValue(business.status, business.businessStatus, business.business_status, "Active"),
});

// Normalizes one row from GET /assessments/payable into the shape
// BizPaymentCard needs. nextInstallment is null when the assessment is
// already fully paid off (shouldn't normally appear since the backend
// only returns non-Paid assessments, but defended here anyway).
const normalizePayableAssessment = (row = {}) => ({
  id: firstValue(row.id, row.assessmentId),
  businessId: toId(firstValue(row.businessId, row.business_id)),
  businessStatus: firstValue(row.businessStatus, row.business_status, "Active"),
  year: Number(firstValue(row.year, row.assessmentYear, row.assessment_year)),
  taxType: firstValue(row.taxType, row.tax_type, "Business Tax"),
  paymentFrequency: firstValue(row.paymentFrequency, row.payment_frequency, "Annual"),
  paymentMethod: firstValue(row.paymentMethod, FREQUENCY_TO_METHOD[firstValue(row.paymentFrequency, row.payment_frequency)] || "FULL PAYMENT"),
  assessmentAmount: moneyNumber(firstValue(row.assessmentAmount, row.assessment_amount, 0)),
  paidAmount: moneyNumber(firstValue(row.paidAmount, row.paid_amount, 0)),
  balanceAmount: moneyNumber(firstValue(row.balanceAmount, row.balance_amount, 0)),
  dueDate: row.dueDate || row.due_date || null,
  nextInstallment: row.nextInstallment || row.next_installment || null,
  // > 1 means this business has more than one outstanding year for this
  // tax type — this row is the OLDEST of them (oldest-unpaid-first is
  // intentional), and at least one newer assessment (possibly with a
  // different payment_frequency) is waiting behind it. Used purely to
  // surface a "X more year(s) waiting" notice; never changes which
  // assessment gets locked in for payment.
  outstandingCount: Number(firstValue(row.outstandingCount, row.outstanding_count, 1)),
});

const normalizePayment = (payment = {}) => {
  const baseTax = moneyNumber(firstValue(payment.baseTax, payment.base_tax, payment.amount, 0));
  const interest = moneyNumber(firstValue(payment.interest, payment.interest_amount, 0));
  const penalty = moneyNumber(firstValue(payment.penalty, payment.penalty_amount, 0));
  const regulatoryFees = moneyNumber(firstValue(payment.regulatoryFees, payment.regulatory_fees, payment.reg_fee_amount, 0));
  const totalPaid = moneyNumber(firstValue(payment.totalPaid, payment.total_paid, payment.total_amount, baseTax + interest + penalty + regulatoryFees));
  const taxType = firstValue(payment.taxType, payment.tax_type, payment.type, "Business Tax");
  const paymentCategory = firstValue(
    payment.paymentCategory,
    payment.payment_category,
    payment.category,
    taxType === "Regulatory Fees" ? "Regulatory Fees" : "Business Tax"
  );

  return {
    ...payment,
    id: firstValue(payment.id, payment.paymentId, payment.payment_id),
    ownerId: toId(firstValue(payment.ownerId, payment.owner_id)),
    businessId: toId(firstValue(payment.businessId, payment.business_id)),
    orNumber: firstValue(payment.orNumber, payment.or_number, payment.orNo, payment.or_no, ""),
    datePaid: dateOnly(firstValue(payment.datePaid, payment.date_paid, payment.paymentDate, payment.payment_date, payment.created_at)),
    businessName: firstValue(payment.businessName, payment.business_name, payment.name, ""),
    ownerName: firstValue(payment.ownerName, payment.owner_name, payment.owner, ""),
    taxType,
    paymentCategory,
    periodCovered: firstValue(payment.periodCovered, payment.period_covered, payment.period, ""),
    paymentMethod: firstValue(payment.paymentMethod, payment.payment_method, "FULL PAYMENT"),
    baseTax,
    interest,
    penalty,
    regulatoryFees,
    totalPaid,
    feeDetails: firstValue(payment.feeDetails, payment.fee_details, ""),
    processedBy: firstValue(payment.processedBy, payment.processed_by, payment.recordedBy, payment.recorded_by, "—"),
    paymentType: firstValue(payment.paymentType, payment.payment_type, "Cash"),
    draweeBank: firstValue(payment.draweeBank, payment.drawee_bank, ""),
    instrumentNumber: firstValue(payment.instrumentNumber, payment.instrument_number, ""),
    instrumentDate: (payment.instrumentDate || payment.instrument_date)
      ? dateOnly(firstValue(payment.instrumentDate, payment.instrument_date))
      : "",
  };
};

function FieldLabel({ children }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
      {children}
    </label>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <AlertCircle size={18} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-gray-900">{title}</h3>
            <p className="text-[10px] text-gray-400">Please confirm this action</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-[12px] text-gray-600 leading-relaxed">{message}</p>
        </div>
        <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-gray-300 bg-white text-[12px] font-semibold text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-red-600 text-white text-[12px] font-bold hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[10px] text-gray-400">{label}</span>
      <span className={`text-[11px] font-semibold text-gray-700 ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function EditModal({ payment, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    ...payment,
    orNumber: payment.orNumber || "",
    datePaid: dateOnly(payment.datePaid),
    periodCovered: payment.periodCovered || "",
    paymentMethod: payment.paymentMethod || "FULL PAYMENT",
    baseTax: payment.baseTax ?? 0,
    interest: payment.interest ?? 0,
    penalty: payment.penalty ?? 0,
    regulatoryFees: payment.regulatoryFees ?? 0,
    feeDetails: payment.feeDetails || "",
  }));

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const originalTotal = moneyNumber(payment.totalPaid);
  const calculatedTotal =
    moneyNumber(form.baseTax) +
    moneyNumber(form.interest) +
    moneyNumber(form.penalty) +
    moneyNumber(form.regulatoryFees);
  const totalChanged = Math.abs(calculatedTotal - originalTotal) > 0.005;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...payment,
      ...form,
      baseTax: moneyNumber(form.baseTax),
      interest: moneyNumber(form.interest),
      penalty: moneyNumber(form.penalty),
      regulatoryFees: moneyNumber(form.regulatoryFees),
      totalPaid: calculatedTotal,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden"
      >
        <div className="bg-[#0F2D5A] text-white px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/50">Payment Record</p>
            <h3 className="text-[14px] font-bold">Edit Payment</h3>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white">
            <X size={17} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {/* Original record — compact, read-only summary. This is the part
              that lets staff actually spot a mistake: the as-recorded
              values sit right above the editable fields below, instead of
              being mixed into one undifferentiated grid of inputs. */}
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              As Recorded
            </p>
            <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
              <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-gray-100">
                <div>
                  <p className="text-[12px] font-bold text-gray-900">{payment.businessName || "—"}</p>
                  <p className="text-[10px] text-gray-400">{payment.ownerName || "—"}</p>
                </div>
                <span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{payment.orNumber}</span>
              </div>
              <SummaryRow label="Date Paid" value={dateOnly(payment.datePaid)} />
              <SummaryRow label="Tax Type" value={payment.taxType} />
              <SummaryRow label="Method" value={payment.paymentMethod} />
              <SummaryRow label="Period Covered" value={payment.periodCovered} />
              <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-gray-100">
                <span className="text-[10px] text-gray-400">Original Total</span>
                <span className="font-mono text-[13px] font-bold text-gray-700">
                  {formatPeso(originalTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Editable fields — visually distinct section, smaller and
              denser than the original-record card above, so it reads as
              "the part you're changing" rather than a continuation of the
              same form. */}
          <div className="px-5 py-3 space-y-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
              Edit Fields
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <FieldLabel>OR Number</FieldLabel>
                <input
                  value={form.orNumber}
                  onChange={(e) => setField("orNumber", e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-[11px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                />
              </div>
              <div>
                <FieldLabel>Date Paid</FieldLabel>
                <input
                  type="date"
                  value={form.datePaid}
                  onChange={(e) => setField("datePaid", e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-[11px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                />
              </div>

              <div>
                <FieldLabel>Tax Type</FieldLabel>
                <input
                  value={form.taxType}
                  onChange={(e) => setField("taxType", e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-[11px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                />
              </div>
              <div>
                <FieldLabel>Category</FieldLabel>
                <select
                  value={form.paymentCategory}
                  onChange={(e) => setField("paymentCategory", e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                >
                  <option value="Business Tax">Business Tax</option>
                  <option value="Regulatory Fees">Regulatory Fees</option>
                </select>
              </div>

              <div>
                <FieldLabel>Period Covered</FieldLabel>
                <input
                  value={form.periodCovered}
                  onChange={(e) => setField("periodCovered", e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-[11px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                />
              </div>
              <div>
                <FieldLabel>Payment Method</FieldLabel>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setField("paymentMethod", e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                >
                  {PAY_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Amounts
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Base Tax / Permit</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.baseTax}
                    onChange={(e) => setField("baseTax", e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                  />
                </div>
                <div>
                  <FieldLabel>Interest</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.interest}
                    onChange={(e) => setField("interest", e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                  />
                </div>
                <div>
                  <FieldLabel>Penalty</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.penalty}
                    onChange={(e) => setField("penalty", e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                  />
                </div>
                <div>
                  <FieldLabel>Regulatory Fees</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.regulatoryFees}
                    onChange={(e) => setField("regulatoryFees", e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                  />
                </div>
              </div>
            </div>

            <div>
              <FieldLabel>Fee Details</FieldLabel>
              <textarea
                rows={2}
                value={form.feeDetails}
                onChange={(e) => setField("feeDetails", e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-[11px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
              />
            </div>

            {/* Live before/after comparison — this is the actual "spot the
                mistake" moment. Unchanged stays neutral blue; changed
                switches to amber so an accidental edit is visually loud
                before staff commit it, not after. */}
            <div
              className={`rounded-lg px-3.5 py-2.5 flex items-center justify-between border ${
                totalChanged
                  ? "bg-amber-50 border-amber-200"
                  : "bg-[#EBF0FA] border-[#BFCFE8]"
              }`}
            >
              <div>
                <span className={`text-[10px] font-semibold ${totalChanged ? "text-amber-700" : "text-[#0F2D5A]"}`}>
                  New Total
                </span>
                {totalChanged && (
                  <p className="text-[9px] text-amber-600 mt-0.5">
                    Was {formatPeso(originalTotal)}
                  </p>
                )}
              </div>
              <span className={`font-mono text-[17px] font-bold ${totalChanged ? "text-amber-700" : "text-[#1E4E9D]"}`}>
                {formatPeso(calculatedTotal)}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2 border-t border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-[12px] font-semibold text-gray-600 hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-[#1E4E9D] text-white rounded-md text-[12px] font-bold hover:bg-[#163d7a]"
          >
            <Save size={13} /> Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

// `assessment` is the locked, server-derived record for this business
// (from GET /assessments/payable) — null if this business has no
// outstanding assessment at all, in which case Business Tax payment is
// disabled for it entirely and an explanatory message is shown instead
// of the old freely-editable Base Tax / Method / Quarter inputs.
function BizPaymentCard({ biz, entry, onChange, regFees, paymentDate, assessment, assessmentsLoading }) {
  const taxYear = taxYearFromDate(paymentDate);

  // Business Tax fields are now READ-ONLY and entirely driven by the
  // locked assessment + its nextInstallment, never by free typing or a
  // user-editable <select>. This is what closes both bugs: the method
  // can no longer disagree with payment_frequency, and the amount can
  // no longer disagree with assessment_amount, because neither is
  // editable anymore — they are exactly what the server already computed.
  const lockedMethod = assessment?.paymentMethod || null;
  const lockedPeriodNo = assessment?.nextInstallment?.periodNo ?? null;
  const lockedAmount = assessment?.nextInstallment?.amount ?? 0;
  const lockedPeriodLabel = assessment?.nextInstallment?.periodLabel || "";
  const fullyPaid = assessment && !assessment.nextInstallment;

  const dueDate = assessment && lockedMethod
    ? getDueDate(
        lockedMethod,
        lockedMethod === "QUARTERLY" ? lockedPeriodNo : 1,
        lockedMethod === "BIANNUAL" ? lockedPeriodNo : 1,
        assessment.year
      )
    : null;

  const btAmount = lockedAmount;
  const interest = entry.payBusinessTax && dueDate ? computeInterest(btAmount, dueDate, paymentDate) : 0;
  const regTotal = entry.selectedFees.reduce((sum, feeId) => sum + moneyNumber(entry.feeAmounts[feeId]), 0);
  const sectionTotal =
    (entry.payBusinessTax ? btAmount + interest : 0) +
    (entry.payMayorsPermit ? moneyNumber(entry.mpAmount) : 0) +
    (entry.payRegFees ? regTotal : 0);

  const patch = (changes) => onChange({ ...entry, ...changes });

  const toggleFee = (fee) => {
    const feeId = toId(fee.id);
    const selected = entry.selectedFees.includes(feeId);

    if (selected) {
      patch({
        selectedFees: entry.selectedFees.filter((id) => id !== feeId),
      });
      return;
    }

    patch({
      selected: true,
      payRegFees: true,
      selectedFees: [...entry.selectedFees, feeId],
      feeAmounts: {
        ...entry.feeAmounts,
        [feeId]: firstValue(fee.amount, fee.defaultAmount, fee.default_amount, fee.rate, ""),
      },
    });
  };

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${entry.selected ? "border-[#1E4E9D] shadow-sm" : "border-gray-200"}`}>
      <div className="bg-white px-4 py-3 flex items-start justify-between gap-3">
        <label className="flex items-start gap-3 cursor-pointer flex-1">
          <input
            type="checkbox"
            checked={entry.selected}
            onChange={(e) => patch({ selected: e.target.checked })}
            className="mt-1 w-4 h-4 accent-[#1E4E9D]"
          />
          <div>
            <p className="text-[13px] font-bold text-gray-900">{biz.businessName}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {biz.lineOfBusiness || "Business"}{biz.address ? ` · ${biz.address}` : ""}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Business ID: {biz.id}</p>
          </div>
        </label>

        <div className="text-right">
          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Selected Total</p>
          <p className="font-mono text-[16px] font-bold text-green-700">{formatPeso(sectionTotal)}</p>
        </div>
      </div>

      {entry.selected && (
        <div className="bg-gray-50 border-t border-gray-100 p-4 space-y-3">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={entry.payBusinessTax}
                disabled={!assessment || fullyPaid}
                onChange={(e) => patch({ selected: true, payBusinessTax: e.target.checked })}
                className="w-4 h-4 accent-[#1E4E9D] disabled:opacity-40"
              />
              <span className="text-[12px] font-bold text-gray-800">Business Tax</span>
              {interest > 0 && (
                <span className="ml-auto text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded">
                  +{formatPeso(interest)} interest
                </span>
              )}
            </label>

            {!assessmentsLoading && !assessment && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-[11px] text-amber-800">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  No outstanding Business Tax assessment found for this business. Generate a tax
                  assessment first (Tax Assessments page) before a payment can be recorded.
                </span>
              </div>
            )}

            {assessment && assessment.businessStatus === "Inactive" && (
              <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-md px-3 py-2 text-[11px] text-orange-800 mb-2">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  This business is marked Inactive. Outstanding back taxes can still be recorded here —
                  this is informational only and does not block payment.
                </span>
              </div>
            )}

            {assessment && fullyPaid && (
              <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-md px-3 py-2 text-[11px] text-green-800">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  The {assessment.year} Business Tax assessment for this business is already fully paid.
                </span>
              </div>
            )}

            {assessment && assessment.outstandingCount > 1 && !fullyPaid && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-[11px] text-blue-800 mb-2">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  This business has {assessment.outstandingCount} outstanding Business Tax years.
                  Showing the oldest one ({assessment.year}) first — it must be settled before any
                  newer year, including a different payment frequency, becomes payable.
                </span>
              </div>
            )}

            {entry.payBusinessTax && assessment && !fullyPaid && (
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <FieldLabel>Base Tax (this installment)</FieldLabel>
                  <div className="relative">
                    <input
                      readOnly
                      value={btAmount.toFixed(2)}
                      className="w-full px-2 py-1.5 border border-gray-200 bg-gray-100 rounded text-[12px] text-gray-700 cursor-not-allowed"
                    />
                    <Lock size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>
                <div>
                  <FieldLabel>Method</FieldLabel>
                  <div className="relative">
                    <input
                      readOnly
                      value={lockedMethod}
                      className="w-full px-2 py-1.5 border border-gray-200 bg-gray-100 rounded text-[12px] text-gray-700 cursor-not-allowed"
                    />
                    <Lock size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>
                {lockedMethod !== "FULL PAYMENT" && (
                  <div>
                    <FieldLabel>{lockedMethod === "QUARTERLY" ? "Quarter" : "Half"}</FieldLabel>
                    <div className="relative">
                      <input
                        readOnly
                        value={lockedPeriodLabel}
                        className="w-full px-2 py-1.5 border border-gray-200 bg-gray-100 rounded text-[12px] text-gray-700 cursor-not-allowed"
                      />
                      <Lock size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>
                )}
                <div>
                  <FieldLabel>OR Override</FieldLabel>
                  <input
                    value={entry.btORNumber}
                    onChange={(e) => patch({ btORNumber: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                  />
                </div>
                <div className="col-span-4 text-[10px] text-gray-400">
                  Period: {assessment.year} {lockedPeriodLabel || "Full Year"} · Due: {safeText(dueDate)}
                  {" · "}Assessment ID: {assessment.id}
                  {assessment.paidAmount > 0 && (
                    <> · Already paid this year: {formatPeso(assessment.paidAmount)} of {formatPeso(assessment.assessmentAmount)}</>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={entry.payMayorsPermit}
                onChange={(e) => patch({ selected: true, payMayorsPermit: e.target.checked })}
                className="w-4 h-4 accent-[#1E4E9D]"
              />
              <span className="text-[12px] font-bold text-gray-800">Mayor's Permit</span>
            </label>

            {entry.payMayorsPermit && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Permit Amount</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entry.mpAmount}
                    onChange={(e) => patch({ mpAmount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                  />
                </div>
                <div>
                  <FieldLabel>OR Override</FieldLabel>
                  <input
                    value={entry.mpORNumber}
                    onChange={(e) => patch({ mpORNumber: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={entry.payRegFees}
                onChange={(e) => patch({ selected: true, payRegFees: e.target.checked })}
                className="w-4 h-4 accent-[#1E4E9D]"
              />
              <span className="text-[12px] font-bold text-gray-800">Regulatory Fees</span>
              {entry.payRegFees && regTotal > 0 && (
                <span className="ml-auto text-[10px] font-bold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded">
                  {formatPeso(regTotal)}
                </span>
              )}
            </label>

            {entry.payRegFees && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {regFees.map((fee) => {
                    const feeId = toId(fee.id);
                    const checked = entry.selectedFees.includes(feeId);
                    return (
                      <div key={feeId} className={`rounded border p-2 ${checked ? "border-[#1E4E9D] bg-[#EBF0FA]" : "border-gray-200 bg-white"}`}>
                        <label className="flex items-center gap-2 cursor-pointer mb-1.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFee(fee)}
                            className="w-3.5 h-3.5 accent-[#1E4E9D]"
                          />
                          <span className="text-[11px] font-semibold text-gray-700 truncate">{fee.name}</span>
                        </label>
                        {checked && (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={entry.feeAmounts[feeId] ?? ""}
                            onChange={(e) => patch({
                              feeAmounts: { ...entry.feeAmounts, [feeId]: e.target.value },
                            })}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div>
                  <FieldLabel>Regulatory OR Override</FieldLabel>
                  <input
                    value={entry.regORNumber}
                    onChange={(e) => patch({ regORNumber: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [owners, setOwners] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

const { fees: regulatoryFees } = useRegulatoryFees();

  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [bizEntries, setBizEntries] = useState({});

  // assessmentsByBusiness: { [businessId]: normalizedPayableAssessment }
  // Fetched fresh every time Step 2 opens for a given owner, from the new
  // GET /assessments/payable?ownerId=... endpoint. This is the single
  // source of truth BizPaymentCard locks its Business Tax fields to —
  // it is never edited locally, only replaced wholesale on refetch.
  const [assessmentsByBusiness, setAssessmentsByBusiness] = useState({});
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);

  // How the whole receipt/OR was physically paid — one choice covers every
  // line item in this submission (Business Tax + Mayor's Permit + Regulatory
  // Fees together), matching payments.controller.js's batch-level paymentType.
  const [paymentType, setPaymentType] = useState("Cash");
  const [draweeBank, setDraweeBank] = useState("");
  const [instrumentNumber, setInstrumentNumber] = useState("");
  const [instrumentDate, setInstrumentDate] = useState("");

  const [editingPayment, setEditingPayment] = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(null);

  // Print preview + printer picker — nothing is sent to a device until the
  // operator confirms inside ReceiptPrintModal. See handlePrint below.
  const [printModal, setPrintModal] = useState({
    open: false,
    html: "",
    pageWidthMm: FORM51_CONFIG.pageW,
    pageHeightMm: FORM51_CONFIG.pageH,
  });
  const [tableSearch, setTableSearch] = useState("");

  // Tracks whether the incoming navigation state (from Delinquent Accounts'
  // "Pay Now") has already been consumed, so the auto-select effect below
  // only fires once per navigation instead of re-triggering on every
  // re-render or every time `owners`/`businesses` refetch.
  const [prefillHandled, setPrefillHandled] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ownersRes, bizRes, payRes] = await Promise.all([
        api.get("/owners"),
        api.get("/businesses"),
        api.get("/payments"),
      ]);

      const businessList = getPayloadArray(bizRes.data, "businesses").map(normalizeBusiness);
      const ownerList = getPayloadArray(ownersRes.data, "owners")
        .map(normalizeOwner)
        .map((owner) => ({
          ...owner,
          businessCount:
            owner.businessCount || businessList.filter((business) => sameId(business.ownerId, owner.id)).length,
        }));
      const paymentList = getPayloadArray(payRes.data, "payments").map(normalizePayment);

      setOwners(ownerList);
      setBusinesses(businessList);
      setPayments(paymentList);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load payments data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Pauses background polling while the Record Payment modal is open —
  // a refetch mid-edit would flash the table behind the modal to its
  // loading state and refresh owners/businesses data while bizEntries
  // (a separate piece of state, keyed by business ID) is mid-edit.
  // Skipping ticks while showModal is true just means the next tick
  // (15s later) tries again once the modal closes; nothing is lost.
  const isPaymentModalOpenRef = useRef(false);
  useEffect(() => {
    isPaymentModalOpenRef.current = showModal;
  }, [showModal]);

  usePolling(fetchAll, { intervalMs: 15000, isPausedRef: isPaymentModalOpenRef });

  // Fetches the locked, payable assessment for every business of the
  // given owner in one call. Called whenever Step 2 is entered for an
  // owner (normal selection, prefill selection, or owner switch), so the
  // Business Tax section always reflects the latest server-side state —
  // e.g. if a payment was just recorded elsewhere, the next open of this
  // modal reflects the updated balance/installment, never a stale value
  // carried over from a previous session.
  const loadPayableAssessments = useCallback(async (ownerId) => {
    if (!ownerId) {
      setAssessmentsByBusiness({});
      return;
    }
    setAssessmentsLoading(true);
    try {
      const { data } = await api.get("/assessments/payable", { params: { ownerId } });
      const rows = getPayloadArray(data, "assessments").map(normalizePayableAssessment);
      const map = {};
      rows.forEach((row) => {
        // One Business Tax assessment per business is the expected shape
        // today (composite unique key on business_id+assessment_year+tax_type,
        // and /payable already collapses to the single oldest unpaid one
        // per business+taxType). If multiple tax_types existed per business
        // in the future, this would need to key by businessId+taxType instead.
        map[row.businessId] = row;
      });
      setAssessmentsByBusiness(map);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load tax assessments for this owner.");
      setAssessmentsByBusiness({});
    } finally {
      setAssessmentsLoading(false);
    }
  }, []);

  const filteredOwners = owners.filter((owner) => {
    const q = safeLower(ownerSearch.trim());
    if (!q) return true;
    return (
      safeLower(owner.name).includes(q) ||
      safeLower(owner.id).includes(q) ||
      safeLower(owner.contact).includes(q) ||
      safeLower(owner.address).includes(q)
    );
  });

  const ownerBusinesses = selectedOwner
    ? businesses.filter((business) => sameId(business.ownerId, selectedOwner.id))
    : [];

  const openModal = () => {
    setStep(1);
    setSelectedOwner(null);
    setOwnerSearch("");
    setBizEntries({});
    setAssessmentsByBusiness({});
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentType("Cash");
    setDraweeBank("");
    setInstrumentNumber("");
    setInstrumentDate("");
    setShowModal(true);
  };

  const handleSelectOwner = (owner) => {
    setSelectedOwner(owner);
    const entries = {};
    businesses
      .filter((business) => sameId(business.ownerId, owner.id))
      .forEach((business) => {
        entries[business.id] = defaultBizEntry();
      });
    setBizEntries(entries);
    setStep(2);
    setOwnerSearch("");
    loadPayableAssessments(owner.id);
  };

  // Applies the entry shape Delinquent Accounts' "Pay Now" needs on top of
  // a normal handleSelectOwner: pre-selects the specific delinquent business
  // and pre-checks/pre-fills the correct payment section (Business Tax,
  // Mayor's Permit, or Regulatory Fees) using the live, freshly-fetched
  // business list — not anything passed in from the Delinquent page itself.
  //
  // For Business Tax specifically, the prefilled amount is no longer
  // trusted as the literal baseTax to submit — once loadPayableAssessments
  // resolves, the locked assessment's nextInstallment amount takes over
  // (see the effect below). The prefill here only pre-checks the
  // "Business Tax" checkbox so the section is already expanded for staff.
  const handleSelectOwnerWithPrefill = (owner, prefill) => {
    setSelectedOwner(owner);
    const entries = {};
    businesses
      .filter((business) => sameId(business.ownerId, owner.id))
      .forEach((business) => {
        entries[business.id] = defaultBizEntry();
      });

    const targetBizId = prefill?.prefillBusinessId ? toId(prefill.prefillBusinessId) : null;
    if (targetBizId && entries[targetBizId]) {
      const amount = moneyNumber(prefill.prefillAmount);
      const taxType = prefill.prefillTaxType;

      if (taxType === "Mayor's Permit") {
        entries[targetBizId] = {
          ...entries[targetBizId],
          selected: true,
          payMayorsPermit: true,
          mpAmount: amount > 0 ? String(amount) : "",
        };
      } else if (taxType === "Regulatory Fees") {
        entries[targetBizId] = {
          ...entries[targetBizId],
          selected: true,
          payRegFees: true,
        };
      } else {
        // Default / "Business Tax": just pre-check the section. The actual
        // amount/method/quarter are populated from the locked assessment
        // once loadPayableAssessments resolves (see effect below) — this
        // intentionally does NOT set businessTaxAmount anymore, since that
        // field is now read-only and server-derived.
        entries[targetBizId] = {
          ...entries[targetBizId],
          selected: true,
          payBusinessTax: true,
        };
      }
    }

    setBizEntries(entries);
    setStep(2);
    setOwnerSearch("");
    loadPayableAssessments(owner.id);
  };

  // Consumes navigation state from Delinquent Accounts' "Pay Now" button.
  // Runs only after fetchAll() has resolved (loading === false), because
  // handleSelectOwnerWithPrefill needs `owners` and `businesses` to already
  // be populated — calling it during the initial fetch would select nothing.
  // The owner is looked up fresh from this page's own `owners` state rather
  // than trusting any owner object the Delinquent page might have passed,
  // so the data reflects the current businessCount/contact/etc., not a
  // possibly-stale snapshot from a different page's last fetch.
  useEffect(() => {
    if (loading || prefillHandled) return;

    const prefill = location.state;
    if (!prefill?.prefillOwnerId) return;

    setPrefillHandled(true);

    const owner = owners.find((o) => sameId(o.id, prefill.prefillOwnerId));
    if (!owner) {
      toast.error("Could not find that owner. Please search manually.");
      setShowModal(true);
      setStep(1);
      // Clear the unusable state so a refresh doesn't retry with stale data.
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    setShowModal(true);
    handleSelectOwnerWithPrefill(owner, prefill);
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentType("Cash");
    setDraweeBank("");
    setInstrumentNumber("");
    setInstrumentDate("");

    // Clear the route state after consuming it, so navigating away and
    // back (or refreshing) doesn't re-trigger the same prefill again.
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, prefillHandled, location.state, owners, businesses]);

  // Once the locked assessments arrive (or whenever they change), sync
  // every business's btMethod/btQuarter/btHalf entry fields to match —
  // this is what guarantees the submitted payload can never disagree
  // with the assessment, because the values are copied directly from it
  // rather than being a separately-editable piece of local state.
  useEffect(() => {
    if (Object.keys(assessmentsByBusiness).length === 0) return;

    setBizEntries((prev) => {
      const next = { ...prev };
      let changed = false;

      Object.entries(assessmentsByBusiness).forEach(([businessId, assessment]) => {
        const entry = next[businessId];
        if (!entry) return;

        const method = assessment.paymentMethod || "FULL PAYMENT";
        const periodNo = assessment.nextInstallment?.periodNo ?? 1;
        const amount = assessment.nextInstallment?.amount ?? 0;

        if (
          entry.btMethod !== method ||
          (method === "QUARTERLY" && entry.btQuarter !== periodNo) ||
          (method === "BIANNUAL" && entry.btHalf !== periodNo) ||
          entry.businessTaxAmount !== String(amount)
        ) {
          next[businessId] = {
            ...entry,
            btMethod: method,
            btQuarter: method === "QUARTERLY" ? periodNo : entry.btQuarter,
            btHalf: method === "BIANNUAL" ? periodNo : entry.btHalf,
            businessTaxAmount: String(amount),
          };
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [assessmentsByBusiness]);

  const updateEntry = (bizId, newEntry) => {
    setBizEntries((prev) => ({ ...prev, [bizId]: newEntry }));
  };

  const grandTotal = ownerBusinesses.reduce((total, biz) => {
    const entry = bizEntries[biz.id];
    if (!entry || !entry.selected) return total;

    const assessment = assessmentsByBusiness[biz.id];
    const lockedMethod = assessment?.paymentMethod;
    const lockedPeriodNo = assessment?.nextInstallment?.periodNo ?? 1;
    const btAmount = assessment?.nextInstallment?.amount ?? 0;

    const dueDate = entry.payBusinessTax && assessment
      ? getDueDate(
          lockedMethod,
          lockedMethod === "QUARTERLY" ? lockedPeriodNo : 1,
          lockedMethod === "BIANNUAL" ? lockedPeriodNo : 1,
          assessment.year
        )
      : null;
    const interest = entry.payBusinessTax && dueDate ? computeInterest(btAmount, dueDate, paymentDate) : 0;
    const bt = entry.payBusinessTax && assessment ? btAmount + interest : 0;
    const mp = entry.payMayorsPermit ? moneyNumber(entry.mpAmount) : 0;
    const reg = entry.payRegFees
      ? entry.selectedFees.reduce((sum, feeId) => sum + moneyNumber(entry.feeAmounts[feeId]), 0)
      : 0;

    return total + bt + mp + reg;
  }, 0);

  const selectedCount = ownerBusinesses.filter((business) => bizEntries[business.id]?.selected).length;

  const handleRecord = async (e) => {
    e.preventDefault();

    if (!selectedOwner) {
      toast.error("Select an owner first.");
      return;
    }

    if (selectedCount === 0) {
      toast.error("Select at least one business.");
      return;
    }

    if (paymentType !== "Cash" && !instrumentNumber.trim()) {
      toast.error(`${paymentType} payments require an instrument/check number.`);
      return;
    }

    const items = [];

    ownerBusinesses.forEach((biz) => {
      const entry = bizEntries[biz.id];
      if (!entry || !entry.selected) return;

      const assessment = assessmentsByBusiness[biz.id];

      if (entry.payBusinessTax && assessment && assessment.nextInstallment) {
        const lockedMethod = assessment.paymentMethod;
        const periodNo = assessment.nextInstallment.periodNo;
        const btAmount = moneyNumber(assessment.nextInstallment.amount);
        const dueDate = getDueDate(
          lockedMethod,
          lockedMethod === "QUARTERLY" ? periodNo : 1,
          lockedMethod === "BIANNUAL" ? periodNo : 1,
          assessment.year
        );
        const interest = computeInterest(btAmount, dueDate, paymentDate);
        const period = getPeriodLabel(lockedMethod, assessment.year, periodNo, periodNo);

        if (btAmount > 0) {
          items.push({
            businessId: biz.id,
            taxType: "Business Tax",
            paymentCategory: "Business Tax",
            periodCovered: period,
            // The year this Business Tax payment is actually FOR — not the
            // year it's being paid IN. For a delinquent/back-tax payment
            // (Delinquent Accounts' "Pay Now"), these are different: a
            // 2024 assessment can be paid today in 2026. The backend's
            // assessment lookup must use this, not new Date(datePaid)
            // .getFullYear(), or it will search for a 2026 assessment
            // that doesn't exist and 422 even though the real 2024
            // assessment is sitting right there, unpaid.
            assessmentYear: assessment.year,
            baseTax: btAmount,
            interest,
            penalty: 0,
            regulatoryFees: 0,
            totalPaid: btAmount + interest,
            paymentMethod: lockedMethod,
            quarter: lockedMethod === "QUARTERLY" ? periodNo : undefined,
            half: lockedMethod === "BIANNUAL" ? periodNo : undefined,
            orNumber: entry.btORNumber.trim(),
          });
        }
      }

      if (entry.payMayorsPermit && moneyNumber(entry.mpAmount) > 0) {
        const amount = moneyNumber(entry.mpAmount);
        items.push({
          businessId: biz.id,
          taxType: "Mayor's Permit",
          paymentCategory: "Business Tax",
          periodCovered: String(taxYearFromDate(paymentDate)),
          baseTax: amount,
          interest: 0,
          penalty: 0,
          regulatoryFees: 0,
          totalPaid: amount,
          paymentMethod: "FULL PAYMENT",
          orNumber: entry.mpORNumber.trim(),
        });
      }

      if (entry.payRegFees && entry.selectedFees.length > 0) {
        const regTotal = entry.selectedFees.reduce((sum, feeId) => sum + moneyNumber(entry.feeAmounts[feeId]), 0);

        if (regTotal > 0) {
          items.push({
            businessId: biz.id,
            taxType: "Regulatory Fees",
            paymentCategory: "Regulatory Fees",
            periodCovered: String(taxYearFromDate(paymentDate)),
            baseTax: 0,
            interest: 0,
            penalty: 0,
            regulatoryFees: regTotal,
            totalPaid: regTotal,
            paymentMethod: "FULL PAYMENT",
            orNumber: entry.regORNumber.trim(),
            feeDetails: entry.selectedFees
              .map((feeId) => {
                const fee = regulatoryFees.find((item) => sameId(item.id, feeId));
                return `${fee?.name || "Fee"} (${formatPeso(moneyNumber(entry.feeAmounts[feeId]))})`;
              })
              .join(", "),
          });
        }
      }
    });

    if (items.length === 0) {
      toast.error("No payment amounts entered.");
      return;
    }

    try {
      const processedBy = user?.name || user?.fullName || user?.username || user?.role || "Current User";
      const { data } = await api.post("/payments", {
        ownerId: selectedOwner.id,
        datePaid: paymentDate,
        processedBy,
        items,
        paymentType,
        draweeBank: paymentType === "Cash" ? null : draweeBank.trim(),
        instrumentNumber: paymentType === "Cash" ? null : instrumentNumber.trim(),
        instrumentDate: paymentType === "Cash" ? null : (instrumentDate || null),
      });

      const savedPayments = getPayloadArray(data, "payments").map(normalizePayment);
      setPayments((prev) => [...savedPayments, ...prev]);
      setShowModal(false);

      const generatedOr = firstValue(data?.orNumber, data?.or_number, savedPayments[0]?.orNumber, "Generated OR");
      toast.success(`OR# ${generatedOr} — ${savedPayments.length || items.length} payment(s) recorded for ${selectedOwner.name}!`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record payment.");
    }
  };

  const handleEditSave = async (updated) => {
    try {
      const { data } = await api.put(`/payments/${updated.id}`, updated);
      const saved = normalizePayment(firstValue(data?.payment, data?.updatedPayment, data?.data, updated));

      setPayments((prev) => prev.map((payment) => (sameId(payment.id, saved.id) ? saved : payment)));
      setEditingPayment(null);
      toast.success(`Payment ${saved.orNumber} updated.`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update payment.");
    }
  };

  const handleDelete = async () => {
    if (!deletingPayment) return;

    try {
      await api.delete(`/payments/${deletingPayment.id}`);
      setPayments((prev) => prev.filter((payment) => !sameId(payment.id, deletingPayment.id)));
      toast.success(`Payment ${deletingPayment.orNumber} deleted.`);
      setDeletingPayment(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete payment.");
    }
  };

  // Renders one printable receipt for every payment row that
  // shares the clicked row's OR number — not just the single row clicked.
  // A batch submission (Business Tax + Mayor's Permit + Regulatory Fees
  // recorded together) shares one OR number across multiple `payments`
  // rows by design (see payments.controller.js createPayments), so
  // printing only the clicked row would silently omit the other line
  // items from the receipt.
  // Renders one printable receipt for every payment row that shares the
  // clicked row's OR number — not just the single row clicked. A batch
  // submission (Business Tax + Mayor's Permit + Regulatory Fees recorded
  // together) shares one OR number across multiple `payments` rows by
  // design (see payments.controller.js createPayments), so printing only
  // the clicked row would silently omit the other line items from the
  // receipt.
  //
  // This overlays only the VARIABLE data onto the pre-printed Accountable
  // Form No. 51 pad (buildOverlayHtml, shared with ReceiptsPage.jsx) — it
  // does NOT draw its own borders/seal/header, and it does NOT print
  // directly. It hands the finished HTML to ReceiptPrintModal, which is
  // the one place in the app that detects printers and lets the operator
  // preview + choose one before anything is sent to a device.
  const handlePrint = async (payment) => {
    const sameOR = payments.filter((p) => p.orNumber === payment.orNumber);
    const unsortedRows = sameOR.length > 0 ? sameOR : [payment];

    // Receipt must always list Business Tax first, then Mayor's Permit,
    // then Regulatory Fees — regardless of the order these came back from
    // the API (insertion/created_at order, not tax-type order).
    const TAX_TYPE_ORDER = { "Business Tax": 0, "Mayor's Permit": 1, "Regulatory Fees": 2 };
    const rows = [...unsortedRows].sort(
      (a, b) => (TAX_TYPE_ORDER[a.taxType] ?? 99) - (TAX_TYPE_ORDER[b.taxType] ?? 99)
    );
    const first = rows[0];

    // DB-driven values — collecting officer, agency, account-code map.
    // Never hardcoded: the collecting officer changes over time and must
    // reflect municipality_settings, not whoever held the post when this
    // page was last edited.
    let collectingOfficer = "";
    let agency = "MTO";
    let codeMap = {};
    try {
      const [settingsRes, codesRes] = await Promise.all([
        api.get("/settings/municipality"),
        api.get("/settings/account-codes"),
      ]);
      const s = settingsRes.data?.settings || {};
      collectingOfficer = s.municipalTreasurer || "";
      agency = s.agency || "MTO";
      codeMap = codesRes.data?.map || {};
    } catch (err) {
      toast.error("Could not load receipt settings — printing amounts only.");
    }

    // feeDetails is a free-text string built in handleRecord, e.g.
    // "Sanitary Permit Fee (PHP 200.00), Health Certificate Fee (PHP 150.00)".
    // When a row is Regulatory Fees and has feeDetails, expand it into one
    // printed line per individual fee instead of one lump-sum "Regulatory
    // Fees" line — so the receipt shows exactly what staff recorded in the
    // payment modal, not just the total.
    function parseFeeDetails(feeDetailsStr) {
      if (!feeDetailsStr) return null;
      const matches = [...feeDetailsStr.matchAll(/([^,()]+?)\s*\(PHP\s*([\d,]+\.\d{2})\)/g)];
      if (matches.length === 0) return null;
      return matches.map((m) => ({ label: m[1].trim(), amount: Number(m[2].replace(/,/g, "")) }));
    }

    const lines = rows.flatMap((p) => {
      const amount = moneyNumber(p.totalPaid);
      if (amount <= 0) return [];
      if (p.taxType === "Regulatory Fees") {
        const breakdown = parseFeeDetails(p.feeDetails);
        if (breakdown && breakdown.length > 0) {
          return breakdown
            .filter((r) => r.amount > 0)
            .map((r) => ({ nature: r.label, code: codeMap[r.label] || "", amount: r.amount }));
        }
      }
      const nature = p.taxType || "—";
      return [{ nature, code: codeMap[nature] || "", amount }];
    });

    if (lines.length === 0) {
      toast.error("Nothing to print — no amounts on this receipt.");
      return;
    }

    const receipt = {
      orNumber: first.orNumber || "",
      payor: `${first.ownerName || "—"}${first.businessName ? ` — ${first.businessName}` : ""}`,
      date: first.datePaid || "",
      agency,
      fund: "",
      mode: first.paymentType || "Cash",
      draweeBank: first.draweeBank || "",
      instNum: first.instrumentNumber || "",
      instDate: first.instrumentDate ? dateOnly(first.instrumentDate) : "",
      collectingOfficer,
      lines,
      total: lines.reduce((s, l) => s + l.amount, 0),
    };

    const cfg = FORM51_CONFIG;
    const html = buildOverlayHtml(receipt, cfg);

    setPrintModal({ open: true, html, pageWidthMm: cfg.pageW, pageHeightMm: cfg.pageH });
  };

  const businessPayments = payments.filter((payment) => payment.paymentCategory !== "Regulatory Fees");
  const regulatoryPayments = payments.filter((payment) => payment.paymentCategory === "Regulatory Fees");

  const filterBySearch = (list) => {
    if (!tableSearch.trim()) return list;
    const q = safeLower(tableSearch.trim());

    return list.filter((payment) =>
      safeLower(payment.orNumber).includes(q) ||
      safeLower(payment.businessName).includes(q) ||
      safeLower(payment.ownerName).includes(q) ||
      safeLower(payment.taxType).includes(q)
    );
  };

  const displayPayments = filterBySearch(payments);

  return (
    <div>
      <PageHeader
        title="Payments & Collections"
        subtitle="Record, edit, and manage all business tax and regulatory fee collections"
      >
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#1E4E9D] text-white rounded-md text-[12px] font-semibold hover:bg-[#163d7a] transition-colors"
        >
          <Plus size={13} /> Record Payment
        </button>
      </PageHeader>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Transactions", value: payments.length, color: "text-[#1E4E9D]" },
          {
            label: "Total Collection",
            value: formatPeso(payments.reduce((sum, payment) => sum + moneyNumber(payment.totalPaid), 0)),
            color: "text-green-600",
            sm: true,
          },
          {
            label: "Business Tax",
            value: formatPeso(businessPayments.reduce((sum, payment) => sum + moneyNumber(payment.totalPaid), 0)),
            color: "text-[#1E4E9D]",
            sm: true,
          },
          {
            label: "Regulatory Fees",
            value: formatPeso(regulatoryPayments.reduce((sum, payment) => sum + moneyNumber(payment.totalPaid), 0)),
            color: "text-green-700",
            sm: true,
          },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{card.label}</p>
            <p className={`font-bold ${card.sm ? "text-[15px]" : "text-[22px]"} ${card.color} mt-0.5`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="ml-auto relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            placeholder="Search OR, business, owner..."
            className="pl-7 pr-3 py-2 text-[12px] border border-gray-200 rounded-md w-[220px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-[12px] font-semibold text-gray-700">All Payment Records</p>
          <p className="text-[11px] text-gray-400">{displayPayments.length} records</p>
        </div>

        <div className="overflow-x-auto">
          <table className="gov-table">
            <thead>
              <tr>
                <th>OR Number</th>
                <th>Date Paid</th>
                <th>Business Name</th>
                <th>Owner</th>
                <th>Category</th>
                <th>Method</th>
                <th>Period / Details</th>
                <th style={{ textAlign: "right" }}>Base Tax</th>
                <th style={{ textAlign: "right" }}>Interest</th>
                <th style={{ textAlign: "right" }}>Total Paid</th>
                <th>Processed By</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="text-center text-gray-400 py-10 text-[12px]">
                    Loading payments...
                  </td>
                </tr>
              ) : displayPayments.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center text-gray-400 py-10 text-[12px]">
                    {tableSearch ? "No results match your search." : "No records yet. Click 'Record Payment' to add."}
                  </td>
                </tr>
              ) : (
                displayPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td><span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{payment.orNumber}</span></td>
                    <td className="text-[11px]">{payment.datePaid}</td>
                    <td className="font-semibold text-[11px]">{payment.businessName}</td>
                    <td className="text-[11px]">{payment.ownerName}</td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        payment.paymentCategory === "Regulatory Fees"
                          ? "bg-green-100 text-green-800 border border-green-200"
                          : payment.taxType === "Mayor's Permit"
                          ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                          : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}
                      >
                        {payment.taxType}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        payment.paymentMethod === "QUARTERLY"
                          ? "bg-purple-100 text-purple-800 border border-purple-200"
                          : payment.paymentMethod === "BIANNUAL"
                          ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                          : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}
                      >
                        {payment.paymentMethod}
                      </span>
                    </td>
                    <td className="text-[11px] text-gray-500 max-w-[180px] truncate">
                      {payment.paymentCategory === "Regulatory Fees" ? (payment.feeDetails || "—") : payment.periodCovered}
                    </td>
                    <td className="text-right font-mono text-[11px]">{formatPeso(payment.baseTax)}</td>
                    <td className={`text-right font-mono text-[11px] ${payment.interest > 0 ? "text-red-600 font-bold" : ""}`}>
                      {formatPeso(payment.interest)}
                    </td>
                    <td className="text-right font-mono text-[12px] font-bold text-green-700">{formatPeso(payment.totalPaid)}</td>
                    <td className="text-[10px] text-gray-400">{payment.processedBy}</td>
                    <td style={{ textAlign: "center" }}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditingPayment(payment)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-yellow-50 text-yellow-600" title="Edit">
                          <Edit size={12} />
                        </button>
                        <button onClick={() => setDeletingPayment(payment)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-red-500" title="Delete">
                          <Trash2 size={12} />
                        </button>
                        <button onClick={() => handlePrint(payment)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-blue-50 text-blue-600" title="Print">
                          <Printer size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingPayment && (
        <EditModal
          payment={editingPayment}
          onSave={handleEditSave}
          onClose={() => setEditingPayment(null)}
        />
      )}

      {deletingPayment && (
        <ConfirmDialog
          title="Delete Payment Record"
          message={`Delete OR# ${deletingPayment.orNumber} — ${formatPeso(deletingPayment.totalPaid)}? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingPayment(null)}
        />
      )}

      <ReceiptPrintModal
        open={printModal.open}
        html={printModal.html}
        pageWidthMm={printModal.pageWidthMm}
        pageHeightMm={printModal.pageHeightMm}
        onClose={() => setPrintModal((prev) => ({ ...prev, open: false }))}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl max-h-[96vh] flex flex-col">
            <div className="bg-[#0F2D5A] text-white px-6 py-4 rounded-t-xl flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-[9px] text-white/50 uppercase tracking-widest mb-0.5">
                  Official Receipt · Municipal Treasurer's Office
                </p>
                <h2 className="font-bold text-[16px]">Record Payment</h2>
                <p className="text-[10px] text-[#D4AF37]">Municipality of Sta. Catalina, Negros Oriental</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  {[1, 2].map((s) => (
                    <div
                      key={s}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        step === s
                          ? "bg-[#D4AF37] text-[#0F2D5A]"
                          : step > s
                            ? "bg-green-500 text-white"
                            : "bg-white/20 text-white/50"
                      }`}
                    >
                      {step > s ? "✓" : s}
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white text-2xl leading-none">
                  ×
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {step === 1 && (
                <div className="max-w-lg mx-auto">
                  <h3 className="font-bold text-gray-800 text-[14px] mb-1">Step 1: Search Business Owner</h3>
                  <p className="text-[11px] text-gray-400 mb-3">
                    Select an owner to see all their businesses and pay everything at once.
                  </p>
                  <div className="relative mb-3">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      autoFocus
                      value={ownerSearch}
                      onChange={(e) => setOwnerSearch(e.target.value)}
                      placeholder="Type to search owner..."
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                    />
                  </div>

                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {filteredOwners.map((owner) => (
                      <button
                        key={owner.id}
                        onClick={() => handleSelectOwner(owner)}
                        className="w-full text-left p-3 border border-gray-200 rounded-md hover:border-[#1E4E9D] hover:bg-[#EBF0FA] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-[13px] text-gray-900">{owner.name}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {owner.address || "No address"} · {owner.contact || "No contact"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-[11px] font-bold text-[#1E4E9D]">{owner.id}</p>
                            <p className="text-[10px] text-gray-400">{owner.businessCount} business(es)</p>
                          </div>
                        </div>
                      </button>
                    ))}

                    {filteredOwners.length === 0 && (
                      <p className="text-center py-8 text-gray-400 text-[12px]">No owners found.</p>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && selectedOwner && (
                <form onSubmit={handleRecord}>
                  <div className="flex items-center justify-between bg-[#EBF0FA] border border-[#BFCFE8] rounded-lg px-4 py-3 mb-4">
                    <div>
                      <p className="text-[9px] text-[#1E4E9D] uppercase tracking-wider font-bold mb-0.5">Owner</p>
                      <p className="font-bold text-[#0F2D5A] text-[13px]">{selectedOwner.name}</p>
                      <p className="text-[11px] text-[#3B6CB7]">
                        {selectedOwner.address || "No address"} · {selectedOwner.contact || "No contact"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500">Payment Date</p>
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="mt-0.5 px-2 py-1.5 border border-gray-300 rounded text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                      />
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4">
                    <FieldLabel>Mode of Payment (applies to this whole receipt)</FieldLabel>
                    <div className="flex items-center gap-4 mb-2">
                      {["Cash", "Check", "Money Order"].map((mode) => (
                        <label key={mode} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="paymentType"
                            checked={paymentType === mode}
                            onChange={() => setPaymentType(mode)}
                            className="w-3.5 h-3.5 accent-[#1E4E9D]"
                          />
                          <span className="text-[12px] text-gray-700">{mode}</span>
                        </label>
                      ))}
                    </div>

                    {paymentType !== "Cash" && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                        <div>
                          <FieldLabel>Drawee Bank</FieldLabel>
                          <input
                            value={draweeBank}
                            onChange={(e) => setDraweeBank(e.target.value)}
                            placeholder="e.g. Land Bank"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                          />
                        </div>
                        <div>
                          <FieldLabel>{paymentType} Number *</FieldLabel>
                          <input
                            value={instrumentNumber}
                            onChange={(e) => setInstrumentNumber(e.target.value)}
                            placeholder="Required"
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                          />
                        </div>
                        <div>
                          <FieldLabel>{paymentType} Date</FieldLabel>
                          <input
                            type="date"
                            value={instrumentDate}
                            onChange={(e) => setInstrumentDate(e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[12px] font-semibold text-gray-700">Select businesses and choose what to pay:</p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <CheckSquare size={13} className="text-[#1E4E9D]" />
                      {selectedCount} of {ownerBusinesses.length} selected
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    {ownerBusinesses.length > 0 ? (
                      ownerBusinesses.map((biz) => (
                        <BizPaymentCard
                          key={biz.id}
                          biz={biz}
                          entry={bizEntries[biz.id] || defaultBizEntry()}
                          onChange={(newEntry) => updateEntry(biz.id, newEntry)}
                          regFees={regulatoryFees}
                          paymentDate={paymentDate}
                          assessment={assessmentsByBusiness[biz.id] || null}
                          assessmentsLoading={assessmentsLoading}
                        />
                      ))
                    ) : (
                      <div className="text-center py-10 text-gray-400 text-[12px]">
                        No businesses found for this owner.
                      </div>
                    )}
                  </div>

                  {grandTotal > 0 && (
                    <div className="bg-[#0F2D5A] text-white rounded-lg px-4 py-3 flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[9px] text-white/50 uppercase tracking-widest">Grand Total</p>
                        <p className="text-[10px] text-white/60 mt-0.5">{selectedCount} business(es) · {paymentDate}</p>
                      </div>
                      <span className="font-mono font-bold text-[#D4AF37] text-[22px]">{formatPeso(grandTotal)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <button type="button" onClick={() => setStep(1)} className="text-[12px] text-gray-500 hover:text-gray-700">
                      ← Back
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-[12px] hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={selectedCount === 0 || grandTotal === 0}
                        className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-md text-[12px] font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <CreditCard size={14} /> Record {selectedCount > 0 ? `${selectedCount} Business(es)` : "Payment"}
                      </button>
                    </div>
                  </div>
                </form> 
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

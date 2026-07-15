import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import PageHeader from "../../components/shared/PageHeader";
import { mockRegulatoryFees } from "../../data/mockData";
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

  const calculatedTotal =
    moneyNumber(form.baseTax) +
    moneyNumber(form.interest) +
    moneyNumber(form.penalty) +
    moneyNumber(form.regulatoryFees);

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
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="bg-[#0F2D5A] text-white px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/50">Payment Record</p>
            <h3 className="text-[15px] font-bold">Edit Payment</h3>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-3 max-h-[74vh] overflow-y-auto">
          <div>
            <FieldLabel>OR Number</FieldLabel>
            <input
              value={form.orNumber}
              onChange={(e) => setField("orNumber", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
            />
          </div>
          <div>
            <FieldLabel>Date Paid</FieldLabel>
            <input
              type="date"
              value={form.datePaid}
              onChange={(e) => setField("datePaid", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
            />
          </div>

          <div>
            <FieldLabel>Tax Type</FieldLabel>
            <input
              value={form.taxType}
              onChange={(e) => setField("taxType", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
            />
          </div>
          <div>
            <FieldLabel>Category</FieldLabel>
            <select
              value={form.paymentCategory}
              onChange={(e) => setField("paymentCategory", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
            />
          </div>
          <div>
            <FieldLabel>Payment Method</FieldLabel>
            <select
              value={form.paymentMethod}
              onChange={(e) => setField("paymentMethod", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
            >
              {PAY_METHODS.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
              <option value="FULL PAYMENT">FULL PAYMENT</option>
            </select>
          </div>

          <div>
            <FieldLabel>Base Tax / Permit Amount</FieldLabel>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.baseTax}
              onChange={(e) => setField("baseTax", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
            />
          </div>

          <div className="col-span-2">
            <FieldLabel>Fee Details</FieldLabel>
            <textarea
              rows={3}
              value={form.feeDetails}
              onChange={(e) => setField("feeDetails", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
            />
          </div>

          <div className="col-span-2 bg-[#EBF0FA] border border-[#BFCFE8] rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#0F2D5A]">Calculated Total</span>
            <span className="font-mono text-[18px] font-bold text-[#1E4E9D]">{formatPeso(calculatedTotal)}</span>
          </div>
        </div>

        <div className="px-5 py-3 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
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

function BizPaymentCard({ biz, entry, onChange, regFees, paymentDate }) {
  const taxYear = taxYearFromDate(paymentDate);
  const dueDate = getDueDate(entry.btMethod, entry.btQuarter, entry.btHalf, taxYear);
  const btAmount = moneyNumber(entry.businessTaxAmount);
  const interest = entry.payBusinessTax ? computeInterest(btAmount, dueDate, paymentDate) : 0;
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
                onChange={(e) => patch({ selected: true, payBusinessTax: e.target.checked })}
                className="w-4 h-4 accent-[#1E4E9D]"
              />
              <span className="text-[12px] font-bold text-gray-800">Business Tax</span>
              {interest > 0 && (
                <span className="ml-auto text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded">
                  +{formatPeso(interest)} interest
                </span>
              )}
            </label>

            {entry.payBusinessTax && (
              <div
                className={`mx-3 mb-2 px-2.5 py-1.5 rounded text-[10px] flex items-start gap-1.5 ${
                  interest > 0
                    ? "bg-red-50 border border-red-100 text-red-700"
                    : "bg-blue-50 border border-blue-100 text-blue-700"
                }`}
              >
                <span className="font-bold flex-shrink-0">ⓘ</span>
                {interest > 0 ? (
                  <span>
                    25% interest applied — due date was{" "}
                    <strong>{dueDate}</strong>, this payment is dated{" "}
                    <strong>{paymentDate}</strong>. Interest takes effect the
                    day after the due date.
                  </span>
                ) : (
                  <span>
                    No interest yet — due <strong>{dueDate}</strong>. A flat
                    25% interest applies automatically if paid after this
                    date.
                  </span>
                )}
              </div>
            )}

            {entry.payBusinessTax && (
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <FieldLabel>Base Tax</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entry.businessTaxAmount}
                    onChange={(e) => patch({ businessTaxAmount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                  />
                </div>
                <div>
                  <FieldLabel>Method</FieldLabel>
                  <select
                    value={entry.btMethod}
                    onChange={(e) => patch({ btMethod: e.target.value })}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                  >
                    {PAY_METHODS.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>
                {entry.btMethod === "QUARTERLY" && (
                  <div>
                    <FieldLabel>Quarter</FieldLabel>
                    <select
                      value={entry.btQuarter}
                      onChange={(e) => patch({ btQuarter: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                    >
                      {QUARTERS.map((q) => (
                        <option key={q} value={q}>Q{q}</option>
                      ))}
                    </select>
                  </div>
                )}
                {entry.btMethod === "BIANNUAL" && (
                  <div>
                    <FieldLabel>Half</FieldLabel>
                    <select
                      value={entry.btHalf}
                      onChange={(e) => patch({ btHalf: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-[12px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                    >
                      {HALVES.map((h) => (
                        <option key={h} value={h}>H{h}</option>
                      ))}
                    </select>
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
                  Period: {getPeriodLabel(entry.btMethod, taxYear, entry.btQuarter, entry.btHalf)} · Due: {safeText(dueDate)}
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

  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [bizEntries, setBizEntries] = useState({});

  // How the whole receipt/OR was physically paid — one choice covers every
  // line item in this submission (Business Tax + Mayor's Permit + Regulatory
  // Fees together), matching payments.controller.js's batch-level paymentType.
  const [paymentType, setPaymentType] = useState("Cash");
  const [draweeBank, setDraweeBank] = useState("");
  const [instrumentNumber, setInstrumentNumber] = useState("");
  const [instrumentDate, setInstrumentDate] = useState("");

  const [editingPayment, setEditingPayment] = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(null);
  const [tableSearch, setTableSearch] = useState("");

  // Print preview + printer picker — nothing is sent to a device until the
  // operator confirms inside ReceiptPrintModal. See handlePrint below.
  const [printModal, setPrintModal] = useState({
    open: false,
    html: "",
    pageWidthMm: FORM51_CONFIG.pageW,
    pageHeightMm: FORM51_CONFIG.pageH,
  });

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
  };

  // Applies the entry shape Delinquent Accounts' "Pay Now" needs on top of
  // a normal handleSelectOwner: pre-selects the specific delinquent business
  // and pre-checks/pre-fills the correct payment section (Business Tax,
  // Mayor's Permit, or Regulatory Fees) using the live, freshly-fetched
  // business list — not anything passed in from the Delinquent page itself.
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
        // Default / "Business Tax": pre-fill the base tax amount that was
        // shown as overdue on the Delinquent Accounts page. The interest
        // shown there (flat 25% delinquency interest) is NOT carried over
        // here — BizPaymentCard computes its own interest live from
        // due date vs. payment date via computeInterest(), so duplicating
        // the Delinquent page's 25% figure into this field would double
        // up or conflict with that calculation.
        entries[targetBizId] = {
          ...entries[targetBizId],
          selected: true,
          payBusinessTax: true,
          businessTaxAmount: amount > 0 ? String(amount) : "",
        };
      }
    }

    setBizEntries(entries);
    setStep(2);
    setOwnerSearch("");
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

  const updateEntry = (bizId, newEntry) => {
    setBizEntries((prev) => ({ ...prev, [bizId]: newEntry }));
  };

  const grandTotal = ownerBusinesses.reduce((total, biz) => {
    const entry = bizEntries[biz.id];
    if (!entry || !entry.selected) return total;

    const dueDate = getDueDate(entry.btMethod, entry.btQuarter, entry.btHalf, taxYearFromDate(paymentDate));
    const btAmount = moneyNumber(entry.businessTaxAmount);
    const interest = entry.payBusinessTax ? computeInterest(btAmount, dueDate, paymentDate) : 0;
    const bt = entry.payBusinessTax ? btAmount + interest : 0;
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

    const taxYear = taxYearFromDate(paymentDate);
    const items = [];

    ownerBusinesses.forEach((biz) => {
      const entry = bizEntries[biz.id];
      if (!entry || !entry.selected) return;

      const dueDate = getDueDate(entry.btMethod, entry.btQuarter, entry.btHalf, taxYear);
      const btAmount = moneyNumber(entry.businessTaxAmount);
      const interest = entry.payBusinessTax ? computeInterest(btAmount, dueDate, paymentDate) : 0;
      const period = getPeriodLabel(entry.btMethod, taxYear, entry.btQuarter, entry.btHalf);

      if (entry.payBusinessTax && btAmount > 0) {
        items.push({
          businessId: biz.id,
          taxType: "Business Tax",
          paymentCategory: "Business Tax",
          periodCovered: period,
          baseTax: btAmount,
          interest,
          penalty: 0,
          regulatoryFees: 0,
          totalPaid: btAmount + interest,
          paymentMethod: entry.btMethod,
          orNumber: entry.btORNumber.trim(),
        });
      }

      if (entry.payMayorsPermit && moneyNumber(entry.mpAmount) > 0) {
        const amount = moneyNumber(entry.mpAmount);
        items.push({
          businessId: biz.id,
          taxType: "Mayor's Permit",
          paymentCategory: "Business Tax",
          periodCovered: String(taxYear),
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
            periodCovered: String(taxYear),
            baseTax: 0,
            interest: 0,
            penalty: 0,
            regulatoryFees: regTotal,
            totalPaid: regTotal,
            paymentMethod: "FULL PAYMENT",
            orNumber: entry.regORNumber.trim(),
            feeDetails: entry.selectedFees
              .map((feeId) => {
                const fee = mockRegulatoryFees.find((item) => sameId(item.id, feeId));
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
  const handlePrint = async (payment) => {
    // Every row sharing this OR (a batch shares one OR number).
    const sameOR = payments.filter((p) => p.orNumber === payment.orNumber);
    const unsortedRows = sameOR.length > 0 ? sameOR : [payment];

    const TAX_TYPE_ORDER = { "Business Tax": 0, "Mayor's Permit": 1, "Regulatory Fees": 2 };
    const rows = [...unsortedRows].sort(
      (a, b) => (TAX_TYPE_ORDER[a.taxType] ?? 99) - (TAX_TYPE_ORDER[b.taxType] ?? 99)
    );
    const first = rows[0];

    // DB-driven values — collecting officer, agency, account-code map.
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

    // Hand off to the shared preview + printer-picker modal instead of
    // printing blind — this is also what actually lets the operator choose
    // a printer, since window.electronAPI.printReceipt has no picker of its
    // own (see ReceiptPrintModal for the printer-detection logic).
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
                <th>Period / Details</th>
                <th>Method</th>
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
                    <td className="text-[11px] text-gray-500 max-w-[180px] truncate">
                      {payment.paymentCategory === "Regulatory Fees" ? (payment.feeDetails || "—") : payment.periodCovered}
                    </td>
                    <td className="text-[10px] text-gray-500">{payment.paymentMethod}</td>
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
                          regFees={mockRegulatoryFees}
                          paymentDate={paymentDate}
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

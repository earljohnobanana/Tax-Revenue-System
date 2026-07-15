import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Plus, ArrowLeft, Phone, Mail, MapPin, Hash,
  Building2, CreditCard, Printer, AlertTriangle, ChevronRight,
  User, Edit, Trash2, X, Save, Eye, CheckCircle, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import StatusBadge from "../../components/shared/StatusBadge";

import {
  LINES_OF_BUSINESS, BUSINESS_TYPES, KIND_OF_MARKET, BUSINESS_NATURE,
} from "../../constants/businessOptions";
import useRegulatoryFees from "../../hooks/useRegulatoryFees";
import api from "../../services/api";
import usePolling from "../../hooks/usePolling";

import {
  formatPeso, computeInterest, getDueDate,
  getPeriodLabel,
} from "../../utils/taxUtils";
import { useAuth } from "../../context/AuthContext";
import sealImg from "../../assets/seal.jpg";

// ── Constants ─────────────────────────────────────────────
const PAY_METHODS = ["FULL PAYMENT", "QUARTERLY", "BIANNUAL"];
const QUARTERS    = [1, 2, 3, 4];
const HALVES      = [1, 2];

const defaultBizEntry = () => ({
  selected: false,
  payBusinessTax: false, businessTaxAmount: "",
  btMethod: "FULL PAYMENT", btQuarter: 1, btHalf: 1, btORNumber: "",
  payMayorsPermit: false, mpAmount: "", mpORNumber: "",
  payRegFees: false, selectedFees: [], feeAmounts: {}, regORNumber: "",
});

// ── Small helpers ─────────────────────────────────────────
function FL({ children }) {
  return <label className="block text-[9px] font-bold text-gray-400 mb-0.5 uppercase tracking-wider">{children}</label>;
}
function FIn({ className = "", ...p }) {
  return <input className={`w-full px-2 py-1.5 border border-gray-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-[#1E4E9D]/50 focus:border-[#1E4E9D] ${className}`} {...p}/>;
}

function Avatar({ name, size = "md" }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const COLORS = ["bg-blue-600","bg-indigo-600","bg-violet-600","bg-teal-600","bg-emerald-600","bg-amber-600","bg-rose-600","bg-cyan-600"];
  const color  = COLORS[name.charCodeAt(0) % COLORS.length];
  const sz = size==="lg"?"w-14 h-14 text-[18px]":size==="sm"?"w-8 h-8 text-[11px]":"w-10 h-10 text-[13px]";
  return <div className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>{initials}</div>;
}

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 size={16} className="text-red-600"/>
          </div>
          <div>
            <p className="font-bold text-gray-900 text-[13px]">{title}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-4 py-1.5 border border-gray-300 rounded-lg text-[11px] hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-[11px] font-bold hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Business Edit Modal ───────────────────────────────────
function BizEditModal({ biz, owners, onSave, onClose }) {
  const [f, setF] = useState({
    name: biz.name, ownerId: biz.ownerId, type: biz.type,
    lineOfBusiness: biz.lineOfBusiness, kindOfMarket: biz.kindOfMarket,
    address: biz.address, dateRegistered: biz.dateRegistered,
    capitalInvestment: biz.capitalInvestment, status: biz.status,
    taxDueStatus: biz.taxDueStatus,
    businessNature: biz.businessNature || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    const owner = owners.find(o => o.id === f.ownerId);
    setSaving(true);
    try {
      await onSave({ ...biz, ...f, ownerName: owner?.name || biz.ownerName, capitalInvestment: parseFloat(f.capitalInvestment)||0 });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-[#0F2D5A] text-white px-5 py-3.5 rounded-t-xl flex items-center justify-between">
          <div>
            <p className="text-[9px] text-white/50 uppercase tracking-widest">Edit Business</p>
            <h2 className="font-bold text-[14px]">{biz.name}</h2>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl">×</button>
        </div>
        <form onSubmit={handleSave} className="p-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <FL>Business Name *</FL>
            <FIn required value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="Business name in CAPS"/>
          </div>
          <div>
            <FL>Owner *</FL>
            <select required value={f.ownerId} onChange={e=>setF({...f,ownerId:e.target.value})}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1E4E9D]/50">
              {owners.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <FL>Business Type *</FL>
            <select required value={f.type} onChange={e=>setF({...f,type:e.target.value})}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1E4E9D]/50">
              {BUSINESS_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <FL>Line of Business *</FL>
            <select required value={f.lineOfBusiness} onChange={e=>setF({...f,lineOfBusiness:e.target.value})}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1E4E9D]/50">
              {LINES_OF_BUSINESS.map(l=><option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <FL>Kind of Market *</FL>
            <select required value={f.kindOfMarket} onChange={e=>setF({...f,kindOfMarket:e.target.value})}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1E4E9D]/50">
              {KIND_OF_MARKET.map(k=><option key={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <FL>Business Nature * <span className="normal-case text-gray-400 font-normal">(tax bracket)</span></FL>
          <select required value={f.businessNature} onChange={e=>setF({...f,businessNature:e.target.value})}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1E4E9D]/50">
            <option value="">Select nature...</option>
            {BUSINESS_NATURE.map(n=><option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
          </div>
          <div>
            <FL>Capital Investment (PHP) *</FL>
            <FIn required type="number" min="0" value={f.capitalInvestment} className="font-mono"
              onChange={e=>setF({...f,capitalInvestment:e.target.value})}/>
          </div>
          <div>
            <FL>Date Registered</FL>
            <FIn type="date" value={f.dateRegistered} onChange={e=>setF({...f,dateRegistered:e.target.value})}/>
          </div>
          <div>
            <FL>Status</FL>
            <select value={f.status} onChange={e=>setF({...f,status:e.target.value})}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1E4E9D]/50">
              <option>Active</option><option>Inactive</option>
            </select>
          </div>
          <div>
            <FL>Tax Due Status</FL>
            <select value={f.taxDueStatus} onChange={e=>setF({...f,taxDueStatus:e.target.value})}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1E4E9D]/50">
              <option>Paid</option><option>Unpaid</option><option>Partial</option><option>Overdue</option>
            </select>
          </div>
          <div className="col-span-2">
            <FL>Business Address</FL>
            <FIn value={f.address} placeholder="Brgy., Sta. Catalina" onChange={e=>setF({...f,address:e.target.value})}/>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-[12px] hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1E4E9D] text-white rounded-lg text-[12px] font-bold hover:bg-[#163d7a] disabled:opacity-50">
              <Save size={13}/> {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Payment Modal ─────────────────────────────────────────
function PaymentModal({ owner, businesses, onClose, onRecordPayment }) {
  // Regulatory fees now come from the real DB-backed catalog
  // (GET /api/regulatory-fees), not a hardcoded mock array — matches the
  // same hook already used by PaymentsPage.jsx, so both payment-recording
  // surfaces stay in sync with whatever fees are actually configured.
  const { fees: regulatoryFees, loading: feesLoading } = useRegulatoryFees();

  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState(() => {
    const e = {};
    businesses.forEach(b => { e[b.id] = defaultBizEntry(); });
    return e;
  });
  const upd = (id, val) => setEntries(p => ({...p,[id]:val}));

  const grandTotal = businesses.reduce((t, biz) => {
    const e = entries[biz.id];
    if (!e?.selected) return t;
    const dd = getDueDate(e.btMethod, e.btQuarter, e.btHalf, new Date(payDate).getFullYear());
    const bt = Number(e.businessTaxAmount)||0;
    const int = e.payBusinessTax ? computeInterest(bt, dd, payDate) : 0;
    return t + (e.payBusinessTax?bt+int:0)
             + (e.payMayorsPermit?Number(e.mpAmount)||0:0)
             + (e.payRegFees?e.selectedFees.reduce((s,id)=>s+Number(e.feeAmounts[id]||0),0):0);
  }, 0);

  const selCount = businesses.filter(b=>entries[b.id]?.selected).length;

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!selCount) { toast.error("Select at least one business."); return; }

    const items = [];
    const payYear = new Date(payDate).getFullYear();
    businesses.forEach(biz => {
      const en = entries[biz.id];
      if (!en?.selected) return;
      const dd = getDueDate(en.btMethod, en.btQuarter, en.btHalf, payYear);
      const btAmt = Number(en.businessTaxAmount)||0;
      const interest = computeInterest(btAmt, dd, payDate);
      const period = getPeriodLabel(en.btMethod, payYear, en.btQuarter, en.btHalf);

      if (en.payBusinessTax && btAmt>0) items.push({
        businessId: biz.id, taxType: "Business Tax", paymentCategory: "Business Tax",
        periodCovered: period, baseTax: btAmt, interest, penalty: 0, regulatoryFees: 0,
        totalPaid: btAmt + interest, paymentMethod: en.btMethod, orNumber: en.btORNumber,
      });

      const mpAmt = Number(en.mpAmount)||0;
      if (en.payMayorsPermit && mpAmt>0) items.push({
        businessId: biz.id, taxType: "Mayor's Permit", paymentCategory: "Business Tax",
        periodCovered: "2025", baseTax: mpAmt, interest: 0, penalty: 0, regulatoryFees: 0,
        totalPaid: mpAmt, paymentMethod: "Full Payment",
        orNumber: en.mpORNumber || en.btORNumber,
      });

      if (en.payRegFees && en.selectedFees.length>0) {
        const regT = en.selectedFees.reduce((s,id)=>s+Number(en.feeAmounts[id]||0),0);
        if (regT>0) items.push({
          businessId: biz.id, taxType: "Regulatory Fees", paymentCategory: "Regulatory Fees",
          periodCovered: "2025", baseTax: 0, interest: 0, penalty: 0, regulatoryFees: regT,
          totalPaid: regT, paymentMethod: "Full Payment", orNumber: en.regORNumber,
          feeDetails: en.selectedFees.map(id=>{
            const f=regulatoryFees.find(f=>f.id===id);
            return `${f?.name} (${formatPeso(Number(en.feeAmounts[id]||0))})`;
          }).join(", "),
        });
      }
    });

    if (!items.length) { toast.error("No payment amounts entered."); return; }

    setSubmitting(true);
    try {
      const data = await onRecordPayment(owner.id, payDate, items);
      toast.success(`OR# ${data.orNumber} — ${data.payments.length} payment(s) recorded!`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record payment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[96vh] flex flex-col overflow-hidden">
        <div className="bg-[#0F2D5A] px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Avatar name={owner.name} size="sm"/>
            <div>
              <p className="text-[9px] text-white/50 uppercase tracking-widest">Record Payment</p>
              <p className="font-bold text-white text-[14px]">{owner.name}</p>
              <p className="text-[10px] text-[#D4AF37]">Municipal Treasurer's Office</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[9px] text-white/50 mb-0.5">Payment Date</p>
              <input type="date" value={payDate} onChange={e=>setPayDate(e.target.value)}
                className="px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-[11px] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"/>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white text-2xl">×</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-2">
            {businesses.map(biz => {
              const e = entries[biz.id] || defaultBizEntry();
              const dd = getDueDate(e.btMethod, e.btQuarter, e.btHalf, new Date(payDate).getFullYear());
              const bt = Number(e.businessTaxAmount)||0;
              const int2 = e.payBusinessTax?computeInterest(bt,dd,payDate):0;
              const mp = e.payMayorsPermit?Number(e.mpAmount)||0:0;
              const reg = e.payRegFees?e.selectedFees.reduce((s,id)=>s+Number(e.feeAmounts[id]||0),0):0;
              const sub = (e.payBusinessTax?bt+int2:0)+mp+reg;
              return (
                <div key={biz.id} className={`rounded-xl border-2 overflow-hidden transition-all ${e.selected?"border-[#1E4E9D]":"border-gray-200"}`}>
                  <div onClick={()=>upd(biz.id,{...e,selected:!e.selected})}
                    className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer ${e.selected?"bg-[#0F2D5A]":"bg-gray-50 hover:bg-gray-100"}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${e.selected?"bg-[#D4AF37] border-[#D4AF37]":"border-gray-400 bg-white"}`}>
                      {e.selected&&<span className="text-[#0F2D5A] text-[8px] font-black">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-[12px] ${e.selected?"text-white":"text-gray-900"}`}>{biz.name}</p>
                      <p className={`text-[10px] ${e.selected?"text-white/50":"text-gray-400"}`}>{biz.lineOfBusiness} · {biz.kindOfMarket} · {formatPeso(biz.capitalInvestment)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={biz.taxDueStatus}/>
                      {e.selected&&sub>0&&<span className="px-2 py-0.5 bg-[#D4AF37] text-[#0F2D5A] rounded text-[10px] font-bold font-mono">{formatPeso(sub)}</span>}
                    </div>
                  </div>
                  {e.selected&&(
                    <div className="p-3 bg-white space-y-2">
                      {/* BT */}
                      <div className={`rounded-lg border overflow-hidden ${e.payBusinessTax?"border-blue-300":"border-gray-200"}`}>
                        <label className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${e.payBusinessTax?"bg-blue-50":""}`}>
                          <input type="checkbox" checked={e.payBusinessTax} onChange={ev=>upd(biz.id,{...e,payBusinessTax:ev.target.checked})} className="w-3.5 h-3.5 accent-[#1E4E9D]"/>
                          <span className="font-bold text-[11px] text-gray-800">Business Tax</span>
                          {e.payBusinessTax&&int2>0&&<span className="ml-auto text-[9px] text-red-600 font-semibold">+{formatPeso(int2)} late interest</span>}
                        </label>
                        {e.payBusinessTax&&(
                          <div className="px-3 pb-3 space-y-2">
                            <div>
                              <FL>Payment Method</FL>
                              <div className="flex gap-1">
                                {PAY_METHODS.map(m=>(
                                  <button type="button" key={m} onClick={()=>upd(biz.id,{...e,btMethod:m})}
                                    className={`flex-1 py-1 border rounded text-[10px] font-semibold ${e.btMethod===m?"border-[#1E4E9D] bg-[#1E4E9D] text-white":"border-gray-200 text-gray-500"}`}>
                                    {m==="FULL PAYMENT"?"Full":m==="QUARTERLY"?"Quarterly":"Biannual"}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {e.btMethod==="QUARTERLY"&&(
                              <div>
                                <FL>Quarter <span className="text-gray-300 normal-case">— Q1 Jan20 Q2 Apr20 Q3 Jul20 Q4 Oct20</span></FL>
                                <div className="flex gap-1">
                                  {QUARTERS.map(q=>(
                                    <button type="button" key={q} onClick={()=>upd(biz.id,{...e,btQuarter:q})}
                                      className={`flex-1 py-1 border rounded text-[10px] font-bold ${e.btQuarter===q?"border-[#1E4E9D] bg-[#1E4E9D] text-white":"border-gray-200 text-gray-500"}`}>Q{q}</button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {e.btMethod==="BIANNUAL"&&(
                              <div>
                                <FL>Semi-Annual</FL>
                                <div className="flex gap-1">
                                  {HALVES.map(h=>(
                                    <button type="button" key={h} onClick={()=>upd(biz.id,{...e,btHalf:h})}
                                      className={`flex-1 py-1 border rounded text-[10px] font-semibold ${e.btHalf===h?"border-[#1E4E9D] bg-[#1E4E9D] text-white":"border-gray-200 text-gray-500"}`}>
                                      {h===1?"1st Half":"2nd Half"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <div><FL>BT Amount (PHP) *</FL><FIn required type="number" min="0" step="0.01" value={e.businessTaxAmount} placeholder="0.00" className="font-mono" onChange={ev=>upd(biz.id,{...e,businessTaxAmount:ev.target.value})}/></div>
                              <div><FL>BT OR Number</FL><FIn value={e.btORNumber} placeholder="Auto if blank" className="font-mono" onChange={ev=>upd(biz.id,{...e,btORNumber:ev.target.value})}/></div>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* MP */}
                      <div className={`rounded-lg border overflow-hidden ${e.payMayorsPermit?"border-yellow-300":"border-gray-200"}`}>
                        <label className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${e.payMayorsPermit?"bg-yellow-50":""}`}>
                          <input type="checkbox" checked={e.payMayorsPermit} onChange={ev=>upd(biz.id,{...e,payMayorsPermit:ev.target.checked})} className="w-3.5 h-3.5 accent-[#D4AF37]"/>
                          <span className="font-bold text-[11px] text-gray-800">Mayor's Permit</span>
                          <span className="ml-auto text-[9px] text-gray-400">Manual amount · own OR</span>
                        </label>
                        {e.payMayorsPermit&&(
                          <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                            <div><FL>MP Amount (PHP) *</FL><FIn required type="number" min="0" step="0.01" value={e.mpAmount} placeholder="0.00" className="font-mono border-yellow-300" onChange={ev=>upd(biz.id,{...e,mpAmount:ev.target.value})}/></div>
                            <div><FL>MP OR Number</FL><FIn value={e.mpORNumber} placeholder="Same or diff OR" className="font-mono" onChange={ev=>upd(biz.id,{...e,mpORNumber:ev.target.value})}/></div>
                          </div>
                        )}
                      </div>
                      {/* Reg Fees */}
                      <div className={`rounded-lg border overflow-hidden ${e.payRegFees?"border-green-300":"border-gray-200"}`}>
                        <label className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${e.payRegFees?"bg-green-50":""}`}>
                          <input type="checkbox" checked={e.payRegFees} onChange={ev=>upd(biz.id,{...e,payRegFees:ev.target.checked})} className="w-3.5 h-3.5 accent-green-600"/>
                          <span className="font-bold text-[11px] text-gray-800">Regulatory Fees</span>
                          {e.payRegFees&&e.selectedFees.length>0&&<span className="ml-auto text-[9px] text-green-700 font-semibold">{e.selectedFees.length} fee(s) · {formatPeso(reg)}</span>}
                        </label>
                        {e.payRegFees&&(
                          <div className="px-3 pb-3">
                            <div className="mb-2"><FL>Reg. OR Number</FL><FIn value={e.regORNumber} placeholder="Auto if blank" className="font-mono w-40" onChange={ev=>upd(biz.id,{...e,regORNumber:ev.target.value})}/></div>
                            {feesLoading ? (
                              <p className="text-[10px] text-gray-400 py-2">Loading fees...</p>
                            ) : (
                              <div className="grid grid-cols-2 gap-1">
                                {regulatoryFees.map(fee=>{
                                  const chk=e.selectedFees.includes(fee.id);
                                  return (
                                    <div key={fee.id} className={`flex items-center gap-1.5 px-2 py-1.5 rounded border ${chk?"border-green-300 bg-green-50":"border-gray-200"}`}>
                                      <input type="checkbox" checked={chk} onChange={()=>{
                                        const nf=chk?e.selectedFees.filter(f=>f!==fee.id):[...e.selectedFees,fee.id];
                                        upd(biz.id,{...e,selectedFees:nf});
                                      }} className="w-3 h-3 accent-green-600 flex-shrink-0"/>
                                      <span className={`text-[10px] font-semibold flex-1 truncate ${chk?"text-green-800":"text-gray-700"}`}>{fee.name}</span>
                                      <input type="number" min="0" step="0.01" disabled={!chk}
                                        value={e.feeAmounts[fee.id]||""} placeholder={String(fee.amount)}
                                        onClick={ev=>ev.stopPropagation()}
                                        onChange={ev=>upd(biz.id,{...e,feeAmounts:{...e.feeAmounts,[fee.id]:ev.target.value}})}
                                        className="w-16 px-1.5 py-0.5 border border-gray-300 rounded text-[10px] font-mono text-right disabled:opacity-35 focus:outline-none"/>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {sub>0&&(
                        <div className="flex items-center justify-between px-3 py-1.5 bg-[#EBF0FA] rounded-lg border border-[#BFCFE8]">
                          <span className="text-[10px] font-bold text-[#1E4E9D]">Subtotal — {biz.name}</span>
                          <span className="font-mono font-bold text-[#1E4E9D] text-[12px]">{formatPeso(sub)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
            {grandTotal>0&&(
              <div className="flex items-center justify-between bg-[#0F2D5A] text-white rounded-xl px-4 py-2.5 mb-3">
                <div>
                  <p className="text-[9px] text-white/50 uppercase tracking-widest">Grand Total</p>
                  <p className="text-[10px] text-white/60">{selCount} business(es) · {payDate}</p>
                </div>
                <span className="font-mono font-bold text-[#D4AF37] text-[20px]">{formatPeso(grandTotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400">{selCount}/{businesses.length} businesses selected</span>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-3 py-1.5 border border-gray-300 rounded-lg text-[11px] hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={!selCount||!grandTotal||submitting}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white rounded-lg text-[11px] font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <CreditCard size={13}/>
                  {submitting ? "Recording..." : `Record ${selCount>0?`(${selCount} Biz)`:"Payment"}`}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Print helper — clean PHP peso signs, no ± ─────────────
function buildPrintHTML(owner, ownerBiz, ownerPays, totals) {
  const today = new Date().toLocaleDateString("en-PH",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  const peso = (n) => "PHP " + Number(n||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});

  const payRows = ownerPays.map(p=>`
    <tr>
      <td>${p.orNumber}</td>
      <td>${p.datePaid}</td>
      <td>${p.businessName}</td>
      <td>${p.taxType}</td>
      <td>${p.periodCovered}</td>
      <td>${p.paymentMethod}</td>
      <td class="num">${peso(p.baseTax)}</td>
      <td class="num ${p.interest>0?"red":""}">${peso(p.interest)}</td>
      <td class="num bold">${peso(p.totalPaid)}</td>
    </tr>`).join("");

  const bizRows = ownerBiz.map(b=>`
    <tr>
      <td>${b.id}</td>
      <td>${b.name}</td>
      <td>${b.lineOfBusiness}</td>
      <td>${b.kindOfMarket}</td>
      <td class="num">${peso(b.capitalInvestment)}</td>
      <td><span class="badge ${b.status.toLowerCase()}">${b.status}</span></td>
      <td><span class="badge ${b.taxDueStatus.toLowerCase()}">${b.taxDueStatus}</span></td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Owner Report — ${owner.name}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1f2937;padding:28px 32px;background:#fff}
  .header{border-bottom:3px solid #1E4E9D;padding-bottom:14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start}
  .header-left h1{font-size:17px;color:#0F2D5A;font-weight:900;margin:4px 0 2px}
  .header-left p{font-size:10px;color:#6b7280;margin:2px 0}
  .header-right{text-align:right;font-size:10px;color:#6b7280}
  .report-title{font-size:14px;font-weight:700;color:#0F2D5A;margin:8px 0 4px}
  .owner-badge{display:inline-block;background:#EBF0FA;border:1px solid #BFCFE8;color:#1E4E9D;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;margin-top:4px}
  .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:14px 0}
  .stat{border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;background:#f9fafb}
  .sl{font-size:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em}
  .sv{font-size:15px;font-weight:700;color:#1E4E9D;margin-top:2px}
  .sv.green{color:#16a34a}.sv.gold{color:#92400e}.sv.gray{color:#374151}
  h2{font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.08em;border-bottom:1.5px solid #e5e7eb;padding-bottom:4px;margin:18px 0 8px}
  table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:10.5px}
  th{background:#1E4E9D;color:#fff;padding:7px 10px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
  td{border:1px solid #e5e7eb;padding:5px 10px;vertical-align:middle}
  tr:nth-child(even) td{background:#f8faff}
  .num{text-align:right;font-family:monospace;font-weight:600}
  .bold{font-weight:700}
  .red{color:#dc2626;font-weight:700}
  .total-row td{background:#EBF0FA!important;font-weight:700;color:#1E4E9D}
  .total-row .num{font-size:12px}
  .badge{display:inline-block;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700}
  .badge.active,.badge.paid{background:#dcfce7;color:#15803d;border:1px solid #bbf7d0}
  .badge.inactive,.badge.unpaid{background:#fee2e2;color:#b91c1c;border:1px solid #fecaca}
  .badge.partial{background:#fef3c7;color:#92400e;border:1px solid #fde68a}
  .badge.overdue{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5}
  .footer{margin-top:24px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af}
  @media print{body{padding:16px 20px}@page{size:landscape;margin:1.5cm}}
</style>
</head>
<body>
  <div class="header">
    <div class="header-left" style="display:flex;align-items:center;gap:14px">
      <img src="${sealImg}" alt="Seal" style="width:60px;height:60px;border-radius:50%;object-fit:cover"/>
      <div>
        <p>Republic of the Philippines &nbsp;|&nbsp; Municipality of Sta. Catalina, Negros Oriental</p>
        <h1>${owner.name}</h1>
        <p>${owner.address} &nbsp;|&nbsp; ${owner.contact} &nbsp;|&nbsp; ${owner.email||""}</p>
        <p>TIN: ${owner.tin} &nbsp;|&nbsp; Owner ID: ${owner.id} &nbsp;|&nbsp; Registered: ${owner.createdDate}</p>
      </div>
    </div>
</div>

<div class="report-title">Owner Payment Report — ${owner.name}</div>
<span class="owner-badge">Business Owner · ${owner.status}</span>

<div class="stats">
  <div class="stat"><div class="sl">Total Paid</div><div class="sv green">${peso(totals.total)}</div></div>
  <div class="stat"><div class="sl">Business Tax</div><div class="sv">${peso(totals.bt)}</div></div>
  <div class="stat"><div class="sl">Mayor's Permit</div><div class="sv gold">${peso(totals.mp)}</div></div>
  <div class="stat"><div class="sl">Reg. Fees</div><div class="sv" style="color:#16a34a">${peso(totals.reg)}</div></div>
  <div class="stat"><div class="sl">Transactions</div><div class="sv gray">${ownerPays.length}</div></div>
</div>

<h2>Payment Records</h2>
<table>
  <thead>
    <tr>
      <th>OR Number</th><th>Date Paid</th><th>Business Name</th>
      <th>Tax Type</th><th>Period</th><th>Method</th>
      <th>Base Tax</th><th>Interest</th><th>Total Paid</th>
    </tr>
  </thead>
  <tbody>
    ${payRows}
    <tr class="total-row">
      <td colspan="8" style="text-align:right">GRAND TOTAL PAID</td>
      <td class="num">${peso(totals.total)}</td>
    </tr>
  </tbody>
</table>

<h2>Registered Businesses (${ownerBiz.length})</h2>
<table>
  <thead>
    <tr><th>ID</th><th>Business Name</th><th>Line of Business</th><th>Kind of Market</th><th>Capital Investment</th><th>Status</th><th>Tax Due</th></tr>
  </thead>
  <tbody>${bizRows}</tbody>
</table>

<div class="footer">
  <span>Municipality of Sta. Catalina &mdash; Business Tax &amp; Regulatory Fees Management System</span>
  <span>Printed: ${today}</span>
</div>
</body>
</html>`;
}

// ── Owner Profile Page ────────────────────────────────────
function OwnerProfile({ owner, allPayments, allBusinesses, allOwners, onBack, onRecordPayment, onBizAdd, onBizUpdate, onBizDelete, onPaymentDelete, onModalStateChange }) {
  const [showPayModal, setShowPayModal] = useState(false);
  const [showAddBiz, setShowAddBiz]   = useState(false);
  const [editingBiz, setEditingBiz]   = useState(null);
  const [deletingBiz, setDeletingBiz] = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(null);
  const [activeTab, setActiveTab]     = useState("all");
  const [bizTab, setBizTab]           = useState("list");
  const [deleting, setDeleting]       = useState(false);
  const [deletingPay, setDeletingPay] = useState(false);
  const [addingBiz, setAddingBiz]     = useState(false);

  useEffect(() => {
    const anyOpen = showPayModal || showAddBiz || !!editingBiz || !!deletingBiz || !!deletingPayment;
    onModalStateChange?.(anyOpen);
  }, [showPayModal, showAddBiz, editingBiz, deletingBiz, deletingPayment, onModalStateChange]);

  const ownerBiz   = allBusinesses.filter(b=>b.ownerId===owner.id);
  const ownerPays  = allPayments.filter(p=>p.ownerId===owner.id);
  const btPays     = ownerPays.filter(p=>p.taxType==="Business Tax");
  const mpPays     = ownerPays.filter(p=>p.taxType==="Mayor's Permit");
  const regPays    = ownerPays.filter(p=>p.taxType==="Regulatory Fees");
  const totalPaid  = ownerPays.reduce((s,p)=>s+p.totalPaid,0);
  const btTotal    = btPays.reduce((s,p)=>s+p.totalPaid,0);
  const mpTotal    = mpPays.reduce((s,p)=>s+p.totalPaid,0);
  const regTotal   = regPays.reduce((s,p)=>s+p.totalPaid,0);
  const tabPays    = activeTab==="all"?ownerPays:activeTab==="bt"?btPays:activeTab==="mp"?mpPays:regPays;

  const handlePrint = () => {
    const html = buildPrintHTML(owner, ownerBiz, ownerPays, {total:totalPaid,bt:btTotal,mp:mpTotal,reg:regTotal});
    const w = window.open("","_blank");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(()=>w.print(),500);
  };

  const handleBizSave = async (updated) => {
    try {
      await onBizUpdate(updated.id, updated);
      setEditingBiz(null);
      toast.success("Business updated.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update business.");
    }
  };

  const handleBizDelete = async () => {
    setDeleting(true);
    try {
      await onBizDelete(deletingBiz.id);
      setDeletingBiz(null);
      toast.success("Business deleted.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete business.");
    } finally {
      setDeleting(false);
    }
  };

  const handlePaymentDelete = async () => {
    setDeletingPay(true);
    try {
      await onPaymentDelete(deletingPayment.id);
      setDeletingPayment(null);
      toast.success(`Payment ${deletingPayment.orNumber} deleted.`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete payment.");
    } finally {
      setDeletingPay(false);
    }
  };

  const EMPTY_BIZ = {name:"",type:"Sole Proprietorship",businessNature:"",lineOfBusiness:"",kindOfMarket:"",address:"",dateRegistered:"",capitalInvestment:""};
  const [newBizForm, setNewBizForm] = useState(EMPTY_BIZ);

  const submitNewBiz = async (e) => {
    e.preventDefault();
    setAddingBiz(true);
    try {
      await onBizAdd({
        ...newBizForm,
        ownerId: owner.id,
        capitalInvestment: parseFloat(newBizForm.capitalInvestment) || 0,
      });
      setShowAddBiz(false);
      setNewBizForm(EMPTY_BIZ);
      toast.success("Business registered.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to register business.");
    } finally {
      setAddingBiz(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-[#1E4E9D] mb-4 transition-colors">
        <ArrowLeft size={14}/> Back to Owners
      </button>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
        <div className="h-14 bg-gradient-to-r from-[#0F2D5A] via-[#1E4E9D] to-[#2563EB]"/>
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-6 mb-4">
            <div className="flex items-end gap-3">
              <div className="ring-4 ring-white rounded-2xl shadow-lg overflow-hidden">
                <Avatar name={owner.name} size="lg"/>
              </div>
              <div className="mb-0.5">
                <h1 className="text-[18px] font-black text-gray-900">{owner.name}</h1>
                <p className="text-[11px] text-gray-500">{owner.id} · Registered {owner.createdDate}</p>
              </div>
            </div>
            <div className="flex gap-2 mb-0.5">
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                <Printer size={13}/> Print Report
              </button>
              <button onClick={()=>setShowPayModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1E4E9D] text-white rounded-lg text-[12px] font-bold hover:bg-[#163d7a] transition-colors shadow-sm">
                <Plus size={13}/> Record Payment
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              {icon:Phone,  val:owner.contact, label:"Contact"},
              {icon:Mail,   val:owner.email||"—",   label:"Email"},
              {icon:MapPin, val:owner.address, label:"Address"},
              {icon:Hash,   val:owner.tin,     label:"TIN Number"},
            ].map(({icon:Icon,val,label})=>(
              <div key={label} className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#EBF0FA] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={12} className="text-[#1E4E9D]"/>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider">{label}</p>
                  <p className="text-[11px] font-semibold text-gray-800 mt-0.5 break-all">{val}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-2">
            {[
              {label:"Total Paid",     val:formatPeso(totalPaid), color:"text-green-600",  bg:"bg-green-50  border-green-200"},
              {label:"Business Tax",   val:formatPeso(btTotal),   color:"text-[#1E4E9D]",  bg:"bg-blue-50   border-blue-200"},
              {label:"Mayor's Permit", val:formatPeso(mpTotal),   color:"text-amber-700",  bg:"bg-yellow-50 border-yellow-200"},
              {label:"Reg. Fees",      val:formatPeso(regTotal),  color:"text-green-700",  bg:"bg-emerald-50 border-emerald-200"},
              {label:"Businesses",     val:ownerBiz.length,       color:"text-gray-800",   bg:"bg-gray-50   border-gray-200"},
            ].map(c=>(
              <div key={c.label} className={`rounded-xl border px-3 py-2.5 ${c.bg}`}>
                <p className="text-[9px] text-gray-400 uppercase tracking-wider">{c.label}</p>
                <p className={`text-[15px] font-bold ${c.color} mt-0.5`}>{c.val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-[13px]">Registered Businesses ({ownerBiz.length})</h3>
          <div className="flex gap-2">
            <div className="flex gap-1">
              {[{id:"list",label:"List"},{id:"cards",label:"Cards"}].map(t=>(
                <button key={t.id} onClick={()=>setBizTab(t.id)}
                  className={`px-2.5 py-1 rounded text-[10px] font-semibold ${bizTab===t.id?"bg-[#1E4E9D] text-white":"bg-gray-100 text-gray-600"}`}>{t.label}</button>
              ))}
            </div>
            <button onClick={()=>setShowAddBiz(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#1E4E9D] text-white rounded-lg text-[11px] font-semibold hover:bg-[#163d7a]">
              <Plus size={11}/> Add Business
            </button>
          </div>
        </div>

        {bizTab==="list" ? (
          <div className="overflow-x-auto">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>Business ID</th><th>Business Name</th><th>Line of Business</th>
                  <th>Kind of Market</th><th>Type</th>
                  <th style={{textAlign:"right"}}>Capital (PHP)</th>
                  <th>Registered</th>
                  <th style={{textAlign:"right"}}>Total Paid</th>
                  <th style={{textAlign:"center"}}>Status</th>
                  <th style={{textAlign:"center"}}>Tax Due</th>
                  <th style={{textAlign:"center"}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ownerBiz.length===0 ? (
                  <tr><td colSpan={11} className="text-center py-6 text-gray-400 text-[12px]">No businesses registered. Click "Add Business" above.</td></tr>
                ) : ownerBiz.map(b=>{
                  const bizTotal = allPayments.filter(p=>p.businessId===b.id).reduce((s,p)=>s+p.totalPaid,0);
                  return (
                    <tr key={b.id}>
                      <td><span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{b.id}</span></td>
                      <td className="font-semibold text-[12px]">{b.name}</td>
                      <td className="text-[11px]">{b.lineOfBusiness}</td>
                      <td className="text-[11px] text-gray-500">{b.kindOfMarket}</td>
                      <td className="text-[10px] text-gray-500">{b.type}</td>
                      <td className="text-right font-mono text-[11px] font-semibold">{Number(b.capitalInvestment).toLocaleString("en-PH",{minimumFractionDigits:2})}</td>
                      <td className="text-[11px] text-gray-400 whitespace-nowrap">{b.dateRegistered}</td>
                      <td className="text-right font-mono text-[11px] font-bold text-green-700">{bizTotal>0?formatPeso(bizTotal):"—"}</td>
                      <td style={{textAlign:"center"}}><StatusBadge status={b.status}/></td>
                      <td style={{textAlign:"center"}}><StatusBadge status={b.taxDueStatus}/></td>
                      <td style={{textAlign:"center"}}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={()=>setEditingBiz(b)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-yellow-50 text-yellow-600" title="Edit"><Edit size={11}/></button>
                          <button onClick={()=>setDeletingBiz(b)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-red-500" title="Delete"><Trash2 size={11}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {ownerBiz.length>0&&(
                  <tr className="bg-[#EBF0FA]">
                    <td colSpan={7} className="text-right font-bold text-[11px] px-3 py-2 text-[#1E4E9D]">TOTAL PAID (all businesses)</td>
                    <td className="text-right font-mono font-bold text-[#1E4E9D] text-[12px] px-3 py-2">{formatPeso(totalPaid)}</td>
                    <td colSpan={3}/>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-3 gap-3">
            {ownerBiz.map(b=>{
              const bizTotal = allPayments.filter(p=>p.businessId===b.id).reduce((s,p)=>s+p.totalPaid,0);
              return (
                <div key={b.id} className="border border-gray-200 rounded-xl p-3 hover:border-[#1E4E9D]/40 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-7 h-7 rounded-lg bg-[#EBF0FA] flex items-center justify-center">
                      <Building2 size={12} className="text-[#1E4E9D]"/>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={()=>setEditingBiz(b)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-yellow-50 text-yellow-600"><Edit size={11}/></button>
                      <button onClick={()=>setDeletingBiz(b)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-red-500"><Trash2 size={11}/></button>
                    </div>
                  </div>
                  <p className="font-bold text-[12px] text-gray-900 leading-tight mb-1">{b.name}</p>
                  <p className="text-[10px] text-gray-400">{b.lineOfBusiness} · {b.kindOfMarket}</p>
                  <p className="text-[11px] font-semibold text-[#1E4E9D] mt-1.5">{formatPeso(b.capitalInvestment)}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <StatusBadge status={b.status}/><StatusBadge status={b.taxDueStatus}/>
                  </div>
                  {bizTotal>0&&<p className="text-[10px] text-green-700 font-bold mt-1.5">Paid: {formatPeso(bizTotal)}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-[13px]">Payment History ({ownerPays.length})</h3>
          <div className="flex gap-1">
            {[
              {id:"all",label:`All (${ownerPays.length})`},
              {id:"bt", label:`Business Tax (${btPays.length})`},
              {id:"mp", label:`Mayor's Permit (${mpPays.length})`},
              {id:"reg",label:`Reg. Fees (${regPays.length})`},
            ].map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                  activeTab===t.id?"bg-[#1E4E9D] text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>{t.label}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="gov-table">
            <thead>
              <tr>
                <th>OR Number</th><th>Date Paid</th><th>Business Name</th>
                <th>Tax Type</th><th>Period</th><th>Method</th>
                <th style={{textAlign:"right"}}>Base Tax</th>
                <th style={{textAlign:"right"}}>Interest</th>
                <th style={{textAlign:"right"}}>Total Paid</th>
                <th>Processed By</th>
                <th style={{textAlign:"center"}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tabPays.length===0 ? (
                <tr><td colSpan={11} className="text-center py-8 text-gray-400 text-[12px]">No payment records.</td></tr>
              ) : tabPays.map(p=>(
                <tr key={p.id}>
                  <td><span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{p.orNumber}</span></td>
                  <td className="text-[11px] whitespace-nowrap">{p.datePaid}</td>
                  <td className="font-semibold text-[11px]">{p.businessName}</td>
                  <td>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      p.taxType==="Mayor's Permit"?"bg-yellow-100 text-yellow-800 border border-yellow-200":
                      p.taxType==="Regulatory Fees"?"bg-green-100 text-green-800 border border-green-200":
                      "bg-blue-100 text-blue-800 border border-blue-200"
                    }`}>{p.taxType}</span>
                  </td>
                  <td className="text-[11px]">{p.periodCovered}</td>
                  <td className="text-[10px] text-gray-500">{p.paymentMethod}</td>
                  <td className="text-right font-mono text-[11px]">{formatPeso(p.baseTax)}</td>
                  <td className={`text-right font-mono text-[11px] ${p.interest>0?"text-red-600 font-bold":""}`}>{formatPeso(p.interest)}</td>
                  <td className="text-right font-mono text-[12px] font-bold text-green-700">{formatPeso(p.totalPaid)}</td>
                  <td className="text-[10px] text-gray-400 max-w-[80px] truncate">{p.processedBy}</td>
                  <td style={{textAlign:"center"}}>
                    <div className="flex items-center justify-center gap-1">
                      <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-blue-50 text-blue-600" title="Print receipt"><Printer size={11}/></button>
                      <button onClick={()=>setDeletingPayment(p)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-red-500" title="Delete payment"><Trash2 size={11}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {tabPays.length>0&&(
                <tr className="bg-[#EBF0FA]">
                  <td colSpan={8} className="font-bold text-[11px] text-right px-3 py-2 text-[#1E4E9D]">TOTAL</td>
                  <td className="text-right font-mono font-bold text-[#1E4E9D] text-[13px] px-3 py-2">{formatPeso(tabPays.reduce((s,p)=>s+p.totalPaid,0))}</td>
                  <td colSpan={2}/>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPayModal&&<PaymentModal owner={owner} businesses={ownerBiz} onClose={()=>setShowPayModal(false)} onRecordPayment={onRecordPayment}/>}
      {editingBiz&&<BizEditModal biz={editingBiz} owners={allOwners} onSave={handleBizSave} onClose={()=>setEditingBiz(null)}/>}
      {deletingBiz&&(
        <ConfirmDialog
          title="Delete Business"
          message={`Delete "${deletingBiz.name}"? This cannot be undone.`}
          onConfirm={handleBizDelete}
          onCancel={()=>!deleting && setDeletingBiz(null)}
        />
      )}
      {deletingPayment&&(
        <ConfirmDialog
          title="Delete Payment Record"
          message={`Delete OR# ${deletingPayment.orNumber} — ${formatPeso(deletingPayment.totalPaid)} for ${deletingPayment.businessName}? This cannot be undone.`}
          onConfirm={handlePaymentDelete}
          onCancel={()=>!deletingPay && setDeletingPayment(null)}
        />
      )}

      {showAddBiz&&(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-[#0F2D5A] text-white px-5 py-3.5 rounded-t-xl flex items-center justify-between">
              <div>
                <p className="text-[9px] text-white/50 uppercase tracking-widest">Add Business</p>
                <h2 className="font-bold text-[14px]">{owner.name}</h2>
              </div>
              <button onClick={()=>setShowAddBiz(false)} className="text-white/60 hover:text-white text-xl">×</button>
            </div>
            <form onSubmit={submitNewBiz} className="p-4 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <FL>Business Name *</FL>
                <FIn required value={newBizForm.name} onChange={e=>setNewBizForm({...newBizForm,name:e.target.value})} placeholder="Business name in CAPS"/>
              </div>
              <div>
                <FL>Business Type *</FL>
                <select required value={newBizForm.type} onChange={e=>setNewBizForm({...newBizForm,type:e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1E4E9D]/50">
                  {BUSINESS_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <FL>Line of Business *</FL>
                <select required value={newBizForm.lineOfBusiness} onChange={e=>setNewBizForm({...newBizForm,lineOfBusiness:e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1E4E9D]/50">
                  <option value="">Select...</option>
                  {LINES_OF_BUSINESS.map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <FL>Kind of Market *</FL>
                <select required value={newBizForm.kindOfMarket} onChange={e=>setNewBizForm({...newBizForm,kindOfMarket:e.target.value})}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1E4E9D]/50">
                  <option value="">Select...</option>
                  {KIND_OF_MARKET.map(k=><option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <FL>Business Nature * <span className="normal-case text-gray-400 font-normal">(tax bracket)</span></FL>
              <select required value={newBizForm.businessNature} onChange={e=>setNewBizForm({...newBizForm,businessNature:e.target.value})}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1E4E9D]/50">
                <option value="">Select nature...</option>
                {BUSINESS_NATURE.map(n=><option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
              </div>
              <div>
                <FL>Capital Investment (PHP) *</FL>
                <FIn required type="number" min="0" value={newBizForm.capitalInvestment} className="font-mono"
                  onChange={e=>setNewBizForm({...newBizForm,capitalInvestment:e.target.value})}/>
              </div>
              <div>
                <FL>Date Registered</FL>
                <FIn type="date" value={newBizForm.dateRegistered} onChange={e=>setNewBizForm({...newBizForm,dateRegistered:e.target.value})}/>
              </div>
              <div className="col-span-2">
                <FL>Business Address</FL>
                <FIn value={newBizForm.address} placeholder="Brgy., Sta. Catalina" onChange={e=>setNewBizForm({...newBizForm,address:e.target.value})}/>
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button type="button" onClick={()=>setShowAddBiz(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-[12px] hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={addingBiz} className="px-4 py-2 bg-[#1E4E9D] text-white rounded-lg text-[12px] font-bold hover:bg-[#163d7a] disabled:opacity-50">
                  {addingBiz ? "Registering..." : "Register Business"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Owners List ──────────────────────────────────────
const EMPTY_OWNER = {name:"",address:"",contact:"",email:"",tin:"",remarks:""};

export default function OwnersPage() {
  const [owners, setOwners]         = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [payments, setPayments]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState("All");
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [ownerForm, setOwnerForm]   = useState(EMPTY_OWNER);
  const [selectedOwner, setSelectedOwner] = useState(null);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const handleProfileModalStateChange = useCallback((isOpen) => {
    setIsProfileModalOpen(isOpen);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ownersRes, bizRes, payRes] = await Promise.all([
        api.get("/owners"),
        api.get("/businesses"),
        api.get("/payments"),
      ]);
      setOwners(ownersRes.data.owners);
      setBusinesses(bizRes.data.businesses);
      setPayments(payRes.data.payments);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load owners data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const isPausedRef = useRef(false);
  useEffect(() => {
    isPausedRef.current = showAddOwner || isProfileModalOpen;
  }, [showAddOwner, isProfileModalOpen]);

  usePolling(fetchAll, { intervalMs: 15000, isPausedRef });

  const filtered = owners.filter(o=>{
    const q=search.toLowerCase();
    return (o.name.toLowerCase().includes(q)||o.id.toLowerCase().includes(q)||o.contact.includes(q))
      &&(filter==="All"||o.status===filter);
  });

  const handleAddOwner = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/owners", ownerForm);
      setOwners(p => [data, ...p]);
      setShowAddOwner(false);
      setOwnerForm(EMPTY_OWNER);
      toast.success("Owner added.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add owner.");
    }
  };

  const handleBizAdd = async (formData) => {
    const { data } = await api.post("/businesses", formData);
    setBusinesses(p => [data, ...p]);
    return data;
  };

  const handleBizUpdate = async (id, formData) => {
    await api.put(`/businesses/${id}`, formData);
    setBusinesses(p => p.map(b => b.id === id ? { ...b, ...formData } : b));
  };

  const handleBizDelete = async (id) => {
    await api.delete(`/businesses/${id}`);
    setBusinesses(p => p.filter(b => b.id !== id));
  };

  const handleRecordPayment = async (ownerId, datePaid, items) => {
    const { data } = await api.post("/payments", { ownerId, datePaid, items });
    setPayments(p => [...data.payments, ...p]);
    return data;
  };

  const handlePaymentDelete = async (id) => {
    await api.delete(`/payments/${id}`);
    setPayments(p => p.filter(pay => pay.id !== id));
  };

  if (selectedOwner) {
    return (
      <OwnerProfile
        owner={selectedOwner}
        allPayments={payments}
        allBusinesses={businesses}
        allOwners={owners}
        onBack={()=>setSelectedOwner(null)}
        onRecordPayment={handleRecordPayment}
        onBizAdd={handleBizAdd}
        onBizUpdate={handleBizUpdate}
        onBizDelete={handleBizDelete}
        onPaymentDelete={handlePaymentDelete}
        onModalStateChange={handleProfileModalStateChange}
      />
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[18px] font-bold text-gray-900">Business Owners</h1>
          <p className="text-[12px] text-gray-500 mt-0.5">Click an owner card to view profile, businesses, payments and records</p>
        </div>
        <button onClick={()=>setShowAddOwner(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#1E4E9D] text-white rounded-lg text-[12px] font-semibold hover:bg-[#163d7a] transition-colors shadow-sm">
          <Plus size={13}/> Add Owner
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          {label:"Total Owners",    val:owners.length,                                   color:"text-[#1E4E9D]"},
          {label:"Active",          val:owners.filter(o=>o.status==="Active").length,    color:"text-green-600"},
          {label:"Inactive",        val:owners.filter(o=>o.status==="Inactive").length,  color:"text-gray-500"},
          {label:"Total Businesses",val:businesses.length,                               color:"text-[#D4AF37]"},
        ].map(c=>(
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{c.label}</p>
            <p className={`text-[22px] font-bold ${c.color}`}>{c.val}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2.5 mb-4 shadow-sm">
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, ID, contact..."
            className="pl-7 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"/>
        </div>
        <div className="flex gap-1.5">
          {["All","Active","Inactive"].map(s=>(
            <button key={s} onClick={()=>setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${filter===s?"bg-[#1E4E9D] text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{s}</button>
          ))}
        </div>
        <p className="ml-auto text-[11px] text-gray-400">{filtered.length} owners</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {loading ? (
          <p className="col-span-3 text-center py-16 text-gray-400 text-[12px]">Loading owners...</p>
        ) : filtered.map(owner=>{
          const ownerBiz  = businesses.filter(b=>b.ownerId===owner.id);
          const ownerPays = payments.filter(p=>p.ownerId===owner.id);
          const total     = ownerPays.reduce((s,p)=>s+p.totalPaid,0);
          const hasOv     = ownerBiz.some(b=>b.taxDueStatus==="Overdue");
          return (
            <div key={owner.id} onClick={()=>setSelectedOwner(owner)}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-[#1E4E9D]/40 transition-all cursor-pointer group overflow-hidden">
              <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                <Avatar name={owner.name}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="font-bold text-[13px] text-gray-900 truncate group-hover:text-[#1E4E9D] transition-colors">{owner.name}</p>
                    {hasOv&&<AlertTriangle size={11} className="text-red-500 flex-shrink-0"/>}
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono">{owner.id}</p>
                  <div className="mt-1"><StatusBadge status={owner.status}/></div>
                </div>
              </div>
              <div className="px-4 pb-3 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500"><Phone size={10} className="text-gray-400"/>{owner.contact}</div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 truncate"><MapPin size={10} className="text-gray-400"/>{owner.address}</div>
                {owner.tin&&<div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono"><Hash size={10} className="text-gray-400"/>TIN: {owner.tin}</div>}
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
                <div className="px-3 py-2.5 text-center">
                  <p className="text-[9px] text-gray-400">Businesses</p>
                  <p className="font-bold text-[14px] text-[#1E4E9D]">{ownerBiz.length}</p>
                </div>
                <div className="px-3 py-2.5 text-center">
                  <p className="text-[9px] text-gray-400">Payments</p>
                  <p className="font-bold text-[14px] text-gray-800">{ownerPays.length}</p>
                </div>
                <div className="px-3 py-2.5 text-center">
                  <p className="text-[9px] text-gray-400">Total Paid</p>
                  <p className="font-bold text-[11px] text-green-600">{total>0?formatPeso(total):"—"}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-100 group-hover:bg-[#EBF0FA] transition-colors">
                <span className="text-[10px] text-gray-400 group-hover:text-[#1E4E9D] transition-colors">View profile & payments</span>
                <ChevronRight size={13} className="text-gray-300 group-hover:text-[#1E4E9D] transition-colors"/>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && filtered.length===0&&(
        <div className="text-center py-16 text-gray-400">
          <User size={36} className="mx-auto mb-3 text-gray-300"/>
          <p className="text-[13px] font-semibold">No owners found</p>
          <p className="text-[11px] mt-1">Try a different search or add a new owner.</p>
        </div>
      )}

      {showAddOwner&&(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-[#0F2D5A] text-white px-5 py-4 flex items-center justify-between">
              <h2 className="font-bold text-[15px]">Add Business Owner</h2>
              <button onClick={()=>setShowAddOwner(false)} className="text-white/60 hover:text-white text-xl">×</button>
            </div>
            <form onSubmit={handleAddOwner} className="p-5 space-y-3">
              {[
                {label:"Owner Name *",   key:"name",    ph:"Full name in CAPS"},
                {label:"Address",        key:"address", ph:"Brgy., Sta. Catalina"},
                {label:"Contact Number", key:"contact", ph:"09XX-XXX-XXXX"},
                {label:"Email Address",  key:"email",   ph:"email@example.com"},
                {label:"TIN Number",     key:"tin",     ph:"XXX-XXX-XXX-000"},
                {label:"Remarks",        key:"remarks", ph:"Optional"},
              ].map(f=>(
                <div key={f.key}>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{f.label}</label>
                  <input value={ownerForm[f.key]} onChange={e=>setOwnerForm({...ownerForm,[f.key]:e.target.value})}
                    required={f.label.includes("*")} placeholder={f.ph}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"/>
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={()=>setShowAddOwner(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-[12px] hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[#1E4E9D] text-white rounded-lg text-[12px] font-semibold hover:bg-[#163d7a]">Save Owner</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
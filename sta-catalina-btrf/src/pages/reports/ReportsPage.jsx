import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  BarChart3, FileText,
  AlertTriangle, TrendingUp, ChevronLeft, X,
  Printer, Download, Search, User, Building2,
  FileSpreadsheet, FileDown, CheckCircle2, Loader2,
} from "lucide-react";
import PageHeader from "../../components/shared/PageHeader";
import StatusBadge from "../../components/shared/StatusBadge";
import { formatPeso } from "../../utils/taxUtils";
import { buildMonthlyRevenueData, filterPaymentsByYear } from "../../utils/reportUtils";
import usePayments from "../../hooks/usePayments";
import useBusinesses from "../../hooks/useBusinesses";
import useOwners from "../../hooks/useOwners";
import useDelinquentAccounts from "../../hooks/useDelinquentAccounts";
import useRegulatoryFees from "../../hooks/useRegulatoryFees";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import * as XLSX from "xlsx-js-style";
import sealImgSrc from "../../assets/seal.jpg";

const YEARS = [2026, 2025, 2024, 2023, 2022];

const REPORTS = [
  { id: "quarterly",  label: "Quarterly Collection Report", icon: BarChart3,     color: "#16A34A", desc: "Q1–Q4 breakdown",    ownerFilter: false },
  { id: "yearly",     label: "Yearly Collection Report",    icon: TrendingUp,    color: "#7C3AED", desc: "Full fiscal year",    ownerFilter: true  },
  { id: "business",   label: "Business Tax Report",         icon: FileText,      color: "#1E4E9D", desc: "All businesses",      ownerFilter: true  },
  { id: "mayors",     label: "Mayor's Permit Report",       icon: FileText,      color: "#D4AF37", desc: "All permits",         ownerFilter: true  },
  { id: "regulatory", label: "Regulatory Fees Report",      icon: FileText,      color: "#16A34A", desc: "All regulatory fees", ownerFilter: true  },
  { id: "delinquent", label: "Delinquent Accounts Report",  icon: AlertTriangle, color: "#EF4444", desc: "Overdue accounts",    ownerFilter: false },
];

// ─── Print CSS ────────────────────────────────────────────
const PRINT_STYLES = `
@media print {
  body > * { display: none !important; }
  #rpt-print-portal { display: block !important; position: fixed; top:0; left:0; width:100%; padding:28px 32px; background:#fff; z-index:99999; font-family:Arial,sans-serif; }
  .no-print { display:none !important; }
  table { border-collapse:collapse; width:100%; margin-bottom:12px; }
  th { background:#1E4E9D !important; color:#fff !important; font-size:10px; padding:6px 10px; text-align:left; border:1px solid #1a4590; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  td { border:1px solid #e2e8f0; padding:5px 10px; font-size:10.5px; }
  tr:nth-child(even) td { background:#f8faff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .ptr { background:#EBF0FA !important; font-weight:700; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .ptr td { font-weight:700; }
  .stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:8px; margin-bottom:14px; }
  .stat-box { border:1px solid #e2e8f0; border-radius:5px; padding:7px 10px; background:#f9fafb; }
  .sbl { font-size:8px; color:#9ca3af; text-transform:uppercase; letter-spacing:.05em; }
  .sbv { font-size:14px; font-weight:700; margin-top:2px; }
  .sec { font-size:10px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.08em; border-bottom:1px solid #f0f0f0; padding-bottom:3px; margin:12px 0 7px; }
  .rh { border-bottom:2px solid #1E4E9D; padding-bottom:12px; margin-bottom:14px; }
  .rh-wrap { display:flex; justify-content:space-between; align-items:flex-start; }
  .rh-sub { margin-top:10px; padding-top:8px; border-top:1px solid #e5e7eb; }
}
`;

// ─── Helpers ──────────────────────────────────────────────
function StatBox({ label, value, color = "text-[#1E4E9D]", sm }) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-3 stat-box">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider sbl">{label}</p>
      <p className={`font-bold ${sm ? "text-[15px]" : "text-[20px]"} ${color} mt-0.5 sbv`}>{value}</p>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3 mt-5 first:mt-0 pb-1 border-b border-gray-100 sec">
      {children}
    </p>
  );
}

// ─── Owner Filter ─────────────────────────────────────────
function OwnerFilter({ owners, selectedOwner, onSelect, onClear }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = owners.filter((o) => {
    const q = search.toLowerCase();
    return o.name.toLowerCase().includes(q) || o.id.toLowerCase().includes(q);
  });

  return (
    <div className="relative" ref={ref}>
      <div className={`flex items-center gap-2 px-3 py-2 border-2 rounded-lg transition-all ${
        selectedOwner ? "border-[#D4AF37] bg-[#FDF8E7]" : "border-white/30 bg-white/10"
      }`}>
        <User size={13} className={selectedOwner ? "text-[#9A7A1A]" : "text-white/60"} />
        {selectedOwner ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[12px] font-bold text-[#7A5F10] truncate">{selectedOwner.name}</span>
            <span className="text-[10px] text-[#9A7A1A] font-mono">{selectedOwner.id}</span>
          </div>
        ) : (
          <input value={search} onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)} placeholder="Filter by owner…"
            className="flex-1 text-[12px] bg-transparent outline-none text-white placeholder-white/40" />
        )}
        {selectedOwner
          ? <button onClick={onClear} className="text-[#9A7A1A] hover:text-red-500 ml-1"><X size={13}/></button>
          : <Search size={12} className="text-white/30"/>
        }
      </div>
      {open && !selectedOwner && search && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-30 max-h-52 overflow-y-auto">
          {filtered.length === 0
            ? <p className="text-[12px] text-gray-400 text-center py-4">No owners found.</p>
            : filtered.map((o) => (
              <button key={o.id} onClick={() => { onSelect(o); setSearch(""); setOpen(false); }}
                className="w-full text-left px-3 py-2.5 hover:bg-[#EBF0FA] border-b border-gray-50 last:border-0 transition-colors">
                <p className="font-semibold text-[12px] text-gray-900">{o.name}</p>
                <p className="text-[10px] text-gray-400">{o.address} · {o.businessCount} business(es)</p>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── LGU Report Header ────────────────────────────────────
function ReportHeader({ title, year, owner }) {
  const today = new Date().toLocaleDateString("en-PH", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  return (
    <div className="border-b-2 border-[#1E4E9D] pb-4 mb-5 rh">
      <div className="flex items-start justify-between rh-wrap">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Republic of the Philippines</p>
          <h2 className="text-[17px] font-black text-[#0F2D5A]">MUNICIPALITY OF STA. CATALINA</h2>
          <p className="text-[11px] text-gray-500">Negros Oriental · Municipal Treasurer's Office</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400">Report Generated</p>
          <p className="text-[11px] font-semibold text-gray-700">{today}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Fiscal Year: <span className="font-bold text-[#1E4E9D]">{year}</span></p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 rh-sub">
        <h3 className="text-[15px] font-bold text-gray-800">{title} — {year}</h3>
        {owner && (
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EBF0FA] border border-[#BFCFE8] rounded text-[11px] font-semibold text-[#1E4E9D]">
              <User size={10}/> {owner.name}
            </span>
            <span className="text-[10px] text-gray-400">{owner.address}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Report Content ───────────────────────────────────────
// `dataset` carries all the live backend data the modal needs:
// { yearPayments, businesses, delinquentAccounts, delinquentSummary,
//   regulatoryFees, monthlyRevenueData }
function ReportContent({ report, year, owner, dataset }) {
  const {
    yearPayments, businesses, delinquentAccounts, delinquentSummary,
    regulatoryFees, monthlyRevenueData,
  } = dataset;

  const allPayments   = yearPayments;
  const ownerPayments = owner ? allPayments.filter(p => p.ownerId === owner.id) : allPayments;
  const btPayments    = ownerPayments.filter(p => p.taxType === "Business Tax");
  const mpPayments    = ownerPayments.filter(p => p.taxType === "Mayor's Permit");
  const regPayments   = ownerPayments.filter(p => p.taxType === "Regulatory Fees");
  const totalCol      = ownerPayments.reduce((s,p) => s + p.totalPaid, 0);
  const btTotal       = btPayments.reduce((s,p) => s + p.totalPaid, 0);
  const mpTotal       = mpPayments.reduce((s,p) => s + p.totalPaid, 0);
  const regTotal      = regPayments.reduce((s,p) => s + p.totalPaid, 0);
  const ownerBiz      = owner ? businesses.filter(b => b.ownerId === owner.id) : businesses;
  const delinTotal    = delinquentSummary.totalWithInterest;

  // // DAILY
  // if (report.id === "daily") {
  //   const today = todayDateOnly();
  //   const todayP = allPayments.filter(p => p.datePaid === today);
  //   const todayT = todayP.reduce((s,p) => s + p.totalPaid, 0);
  //   return (
  //     <div>
  //       <ReportHeader title={report.label} year={year} owner={owner}/>
  //       <div className="grid grid-cols-3 gap-3 mb-5 stat-grid">
  //         <StatBox label="Transactions Today" value={todayP.length}/>
  //         <StatBox label="Today's Collection" value={formatPeso(todayT)} color="text-green-600" sm/>
  //         <StatBox label="Date" value={new Date().toLocaleDateString("en-PH")} color="text-gray-700" sm/>
  //       </div>
  //       <SectionTitle>Today's Transactions</SectionTitle>
  //       <table className="gov-table">
  //         <thead><tr><th>OR Number</th><th>Business Name</th><th>Owner</th><th>Tax Type</th><th style={{textAlign:"right"}}>Amount</th><th>Processed By</th></tr></thead>
  //         <tbody>
  //           {todayP.length === 0
  //             ? <tr><td colSpan={6} className="text-center text-gray-400 py-6 text-[12px]">No transactions recorded today.</td></tr>
  //             : todayP.map(p => (
  //               <tr key={p.id}>
  //                 <td><span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{p.orNumber}</span></td>
  //                 <td className="font-semibold text-[11px]">{p.businessName}</td>
  //                 <td className="text-[11px]">{p.ownerName}</td>
  //                 <td className="text-[11px]">{p.taxType}</td>
  //                 <td className="text-right font-mono font-bold text-green-700 text-[11px]">{formatPeso(p.totalPaid)}</td>
  //                 <td className="text-[10px] text-gray-400">{p.processedBy}</td>
  //               </tr>
  //             ))
  //           }
  //           {todayP.length > 0 && (
  //             <tr className="bg-[#EBF0FA] ptr">
  //               <td colSpan={4} className="font-bold text-[12px] text-right px-3 py-2">TOTAL:</td>
  //               <td className="text-right font-mono font-bold text-[#1E4E9D] text-[13px] px-3 py-2">{formatPeso(todayT)}</td>
  //               <td/>
  //             </tr>
  //           )}
  //         </tbody>
  //       </table>
  //     </div>
  //   );
  // }

  // // MONTHLY
  // if (report.id === "monthly") {
  //   return (
  //     <div>
  //       <ReportHeader title={report.label} year={year} owner={owner}/>
  //       {owner && (
  //         <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
  //           <Building2 size={15} className="text-blue-600 flex-shrink-0"/>
  //           <div>
  //             <p className="text-[11px] font-bold text-blue-800">{owner.name}</p>
  //             <p className="text-[10px] text-blue-600">{owner.businessCount} registered business(es) · {owner.address}</p>
  //           </div>
  //         </div>
  //       )}
  //       <div className="grid grid-cols-4 gap-3 mb-5 stat-grid">
  //         <StatBox label="Total Collection" value={formatPeso(totalCol)} color="text-green-600" sm/>
  //         <StatBox label="Business Tax"     value={formatPeso(btTotal)}  color="text-[#1E4E9D]" sm/>
  //         <StatBox label="Mayor's Permit"   value={formatPeso(mpTotal)}  color="text-[#D4AF37]" sm/>
  //         <StatBox label="Reg. Fees"        value={formatPeso(regTotal)} color="text-green-700" sm/>
  //       </div>
  //       {!owner && (
  //         <>
  //           <SectionTitle>Monthly Revenue Chart — {year}</SectionTitle>
  //           <div className="no-print mb-2">
  //             <ResponsiveContainer width="100%" height={200}>
  //               <BarChart data={monthlyRevenueData} barSize={11}>
  //                 <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
  //                 <XAxis dataKey="month" tick={{fontSize:10}}/>
  //                 <YAxis tick={{fontSize:10}} tickFormatter={v=>`PHP ${(v/1000).toFixed(0)}K`}/>
  //                 <Tooltip formatter={v=>formatPeso(v)}/>
  //                 <Legend iconSize={9} wrapperStyle={{fontSize:10}}/>
  //                 <Bar dataKey="businessTax"    name="Business Tax"   fill="#1E4E9D" radius={[2,2,0,0]}/>
  //                 <Bar dataKey="mayorPermit"    name="Mayor's Permit" fill="#D4AF37" radius={[2,2,0,0]}/>
  //                 <Bar dataKey="regulatoryFees" name="Reg. Fees"      fill="#22C55E" radius={[2,2,0,0]}/>
  //               </BarChart>
  //             </ResponsiveContainer>
  //           </div>
  //           <SectionTitle>Monthly Summary — {year}</SectionTitle>
  //           <table className="gov-table mb-5">
  //             <thead><tr>
  //               <th>Month</th>
  //               <th style={{textAlign:"right"}}>Business Tax</th>
  //               <th style={{textAlign:"right"}}>Mayor's Permit</th>
  //               <th style={{textAlign:"right"}}>Reg. Fees</th>
  //               <th style={{textAlign:"right"}}>Monthly Total</th>
  //             </tr></thead>
  //             <tbody>
  //               {monthlyRevenueData.map(m => {
  //                 const t = m.businessTax + m.mayorPermit + m.regulatoryFees;
  //                 return (
  //                   <tr key={m.month}>
  //                     <td className="font-semibold text-[11px]">{m.month} {year}</td>
  //                     <td className="text-right font-mono text-[11px]">{formatPeso(m.businessTax)}</td>
  //                     <td className="text-right font-mono text-[11px]">{formatPeso(m.mayorPermit)}</td>
  //                     <td className="text-right font-mono text-[11px]">{formatPeso(m.regulatoryFees)}</td>
  //                     <td className="text-right font-mono font-bold text-[#1E4E9D] text-[11px]">{formatPeso(t)}</td>
  //                   </tr>
  //                 );
  //               })}
  //               <tr className="bg-[#EBF0FA] ptr">
  //                 <td className="font-bold px-3 py-2 text-[12px]">GRAND TOTAL</td>
  //                 <td className="text-right font-mono font-bold px-3 py-2">{formatPeso(monthlyRevenueData.reduce((s,m)=>s+m.businessTax,0))}</td>
  //                 <td className="text-right font-mono font-bold px-3 py-2">{formatPeso(monthlyRevenueData.reduce((s,m)=>s+m.mayorPermit,0))}</td>
  //                 <td className="text-right font-mono font-bold px-3 py-2">{formatPeso(monthlyRevenueData.reduce((s,m)=>s+m.regulatoryFees,0))}</td>
  //                 <td className="text-right font-mono font-bold text-[#1E4E9D] text-[13px] px-3 py-2">{formatPeso(totalCol)}</td>
  //               </tr>
  //             </tbody>
  //           </table>
  //         </>
  //       )}
  //       <SectionTitle>{owner ? `Payment Records — ${owner.name}` : "All Payment Records"}</SectionTitle>
  //       <table className="gov-table">
  //         <thead><tr>
  //           <th>OR Number</th><th>Date Paid</th><th>Business Name</th>
  //           <th>Tax Type</th><th>Period</th><th>Method</th>
  //           <th style={{textAlign:"right"}}>Total Paid</th>
  //         </tr></thead>
  //         <tbody>
  //           {ownerPayments.length === 0
  //             ? <tr><td colSpan={7} className="text-center text-gray-400 py-6 text-[12px]">No payment records found{owner?` for ${owner.name}`:""}</td></tr>
  //             : ownerPayments.map(p => (
  //               <tr key={p.id}>
  //                 <td><span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{p.orNumber}</span></td>
  //                 <td className="text-[11px]">{p.datePaid}</td>
  //                 <td className="font-semibold text-[11px]">{p.businessName}</td>
  //                 <td className="text-[11px]">{p.taxType}</td>
  //                 <td className="text-[11px]">{p.periodCovered}</td>
  //                 <td className="text-[10px] text-gray-500">{p.paymentMethod}</td>
  //                 <td className="text-right font-mono font-bold text-green-700 text-[11px]">{formatPeso(p.totalPaid)}</td>
  //               </tr>
  //             ))
  //           }
  //           {ownerPayments.length > 0 && (
  //             <tr className="bg-[#EBF0FA] ptr">
  //               <td colSpan={6} className="font-bold text-[12px] text-right px-3 py-2">TOTAL:</td>
  //               <td className="text-right font-mono font-bold text-[#1E4E9D] text-[13px] px-3 py-2">{formatPeso(totalCol)}</td>
  //             </tr>
  //           )}
  //         </tbody>
  //       </table>
  //     </div>
  //   );
  // }

  // QUARTERLY
  if (report.id === "quarterly") {
    const quarters = [
      {label:"Q1 (Jan–Mar)",months:["Jan","Feb","Mar"]},
      {label:"Q2 (Apr–Jun)",months:["Apr","May","Jun"]},
      {label:"Q3 (Jul–Sep)",months:["Jul","Aug","Sep"]},
      {label:"Q4 (Oct–Dec)",months:["Oct","Nov","Dec"]},
    ].map(q => {
      const d = monthlyRevenueData.filter(m => q.months.includes(m.month));
      return {...q,
        bt:d.reduce((s,m)=>s+m.businessTax,0), mp:d.reduce((s,m)=>s+m.mayorPermit,0),
        reg:d.reduce((s,m)=>s+m.regulatoryFees,0),
        total:d.reduce((s,m)=>s+m.businessTax+m.mayorPermit+m.regulatoryFees,0),
      };
    });
    return (
      <div>
        <ReportHeader title={report.label} year={year} owner={owner}/>
        <div className="grid grid-cols-4 gap-3 mb-5 stat-grid">
          {quarters.map(q => <StatBox key={q.label} label={q.label} value={formatPeso(q.total)} color="text-[#1E4E9D]" sm/>)}
        </div>
        <SectionTitle>Quarterly Collection Summary — {year}</SectionTitle>
        <table className="gov-table">
          <thead><tr>
            <th>Quarter</th><th style={{textAlign:"right"}}>Business Tax</th>
            <th style={{textAlign:"right"}}>Mayor's Permit</th><th style={{textAlign:"right"}}>Reg. Fees</th>
            <th style={{textAlign:"right"}}>Quarter Total</th>
          </tr></thead>
          <tbody>
            {quarters.map(q => (
              <tr key={q.label}>
                <td className="font-semibold text-[11px]">{q.label}</td>
                <td className="text-right font-mono text-[11px]">{formatPeso(q.bt)}</td>
                <td className="text-right font-mono text-[11px]">{formatPeso(q.mp)}</td>
                <td className="text-right font-mono text-[11px]">{formatPeso(q.reg)}</td>
                <td className="text-right font-mono font-bold text-[#1E4E9D] text-[12px]">{formatPeso(q.total)}</td>
              </tr>
            ))}
            <tr className="bg-[#EBF0FA] ptr">
              <td className="font-bold text-[12px] px-3 py-2">ANNUAL TOTAL</td>
              <td className="text-right font-mono font-bold px-3 py-2">{formatPeso(quarters.reduce((s,q)=>s+q.bt,0))}</td>
              <td className="text-right font-mono font-bold px-3 py-2">{formatPeso(quarters.reduce((s,q)=>s+q.mp,0))}</td>
              <td className="text-right font-mono font-bold px-3 py-2">{formatPeso(quarters.reduce((s,q)=>s+q.reg,0))}</td>
              <td className="text-right font-mono font-bold text-[#1E4E9D] text-[13px] px-3 py-2">{formatPeso(quarters.reduce((s,q)=>s+q.total,0))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // YEARLY
  if (report.id === "yearly") {
    const yearTotal = monthlyRevenueData.reduce((s,m)=>s+m.businessTax+m.mayorPermit+m.regulatoryFees,0);
    return (
      <div>
        <ReportHeader title={report.label} year={year} owner={owner}/>
        {owner && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
            <Building2 size={15} className="text-blue-600 flex-shrink-0"/>
            <div>
              <p className="text-[11px] font-bold text-blue-800">{owner.name}</p>
              <p className="text-[10px] text-blue-600">TIN: {owner.tin} · {owner.contact}</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-4 gap-3 mb-5 stat-grid">
          <StatBox label={owner?"Owner Total":"Total Collection"} value={formatPeso(owner?totalCol:yearTotal)} color="text-green-600" sm/>
          <StatBox label="Business Tax"   value={formatPeso(btTotal)}  color="text-[#1E4E9D]" sm/>
          <StatBox label="Mayor's Permit" value={formatPeso(mpTotal)}  color="text-[#D4AF37]" sm/>
          <StatBox label="Reg. Fees"      value={formatPeso(regTotal)} color="text-green-700" sm/>
        </div>
        {!owner && (
          <>
            <SectionTitle>Revenue Trend — {year}</SectionTitle>
            <div className="no-print mb-4">
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={monthlyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                  <XAxis dataKey="month" tick={{fontSize:10}}/>
                  <YAxis tick={{fontSize:10}} tickFormatter={v=>`₱${(v/1000).toFixed(0)}K`}/>
                  <Tooltip formatter={v=>formatPeso(v)}/>
                  <Legend iconSize={9} wrapperStyle={{fontSize:10}}/>
                  <Line type="monotone" dataKey="businessTax"    name="Business Tax"   stroke="#1E4E9D" strokeWidth={2} dot={{r:2}}/>
                  <Line type="monotone" dataKey="mayorPermit"    name="Mayor's Permit" stroke="#D4AF37" strokeWidth={2} dot={{r:2}}/>
                  <Line type="monotone" dataKey="regulatoryFees" name="Reg. Fees"      stroke="#22C55E" strokeWidth={2} dot={{r:2}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
        {owner && ownerBiz.length > 0 && (
          <>
            <SectionTitle>Registered Businesses</SectionTitle>
            <table className="gov-table mb-4">
              <thead><tr>
                <th>Business ID</th><th>Business Name</th><th>Line of Business</th>
                <th>Kind of Market</th><th style={{textAlign:"right"}}>Capital</th><th style={{textAlign:"center"}}>Tax Due</th>
              </tr></thead>
              <tbody>
                {ownerBiz.map(b => (
                  <tr key={b.id}>
                    <td><span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{b.id}</span></td>
                    <td className="font-semibold text-[11px]">{b.name}</td>
                    <td className="text-[11px]">{b.lineOfBusiness}</td>
                    <td className="text-[11px] text-gray-500">{b.kindOfMarket}</td>
                    <td className="text-right font-mono text-[11px]">{formatPeso(b.capitalInvestment)}</td>
                    <td style={{textAlign:"center"}}><StatusBadge status={b.taxDueStatus}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <SectionTitle>{owner ? `All Payments — ${owner.name}` : `All Payments — ${year}`}</SectionTitle>
        <table className="gov-table">
          <thead><tr>
            <th>OR Number</th><th>Date Paid</th><th>Business Name</th>
            <th>Tax Type</th><th>Period</th><th>Method</th>
            <th style={{textAlign:"right"}}>Total</th><th>Processed By</th>
          </tr></thead>
          <tbody>
            {ownerPayments.length === 0
              ? <tr><td colSpan={8} className="text-center text-gray-400 py-6 text-[12px]">No records found{owner?` for ${owner.name}`:""}</td></tr>
              : ownerPayments.map(p => (
                <tr key={p.id}>
                  <td><span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{p.orNumber}</span></td>
                  <td className="text-[11px]">{p.datePaid}</td>
                  <td className="font-semibold text-[11px]">{p.businessName}</td>
                  <td className="text-[11px]">{p.taxType}</td>
                  <td className="text-[11px]">{p.periodCovered}</td>
                  <td className="text-[10px] text-gray-500">{p.paymentMethod}</td>
                  <td className="text-right font-mono font-bold text-green-700 text-[11px]">{formatPeso(p.totalPaid)}</td>
                  <td className="text-[10px] text-gray-400">{p.processedBy}</td>
                </tr>
              ))
            }
            {ownerPayments.length > 0 && (
              <tr className="bg-[#EBF0FA] ptr">
                <td colSpan={6} className="font-bold text-[12px] text-right px-3 py-2">GRAND TOTAL:</td>
                <td className="text-right font-mono font-bold text-[#1E4E9D] text-[13px] px-3 py-2">{formatPeso(totalCol)}</td>
                <td/>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // BUSINESS TAX
  if (report.id === "business") {
    return (
      <div>
        <ReportHeader title={report.label} year={year} owner={owner}/>
        <div className="grid grid-cols-4 gap-3 mb-5 stat-grid">
          <StatBox label="Businesses"      value={ownerBiz.length}/>
          <StatBox label="BT Transactions" value={btPayments.length}/>
          <StatBox label="BT Collection"   value={formatPeso(btTotal)} color="text-green-600" sm/>
          <StatBox label="Overdue"         value={delinquentAccounts.filter(d=>!owner||d.ownerName===owner.name).length} color="text-red-600"/>
        </div>
        <SectionTitle>Business Tax Payments{owner?` — ${owner.name}`:""}</SectionTitle>
        <table className="gov-table mb-4">
          <thead><tr>
            <th>OR Number</th><th>Date Paid</th><th>Business Name</th>
            <th>Period</th><th>Method</th>
            <th style={{textAlign:"right"}}>Base Tax</th>
            <th style={{textAlign:"right"}}>Interest</th>
            <th style={{textAlign:"right"}}>Total</th>
          </tr></thead>
          <tbody>
            {btPayments.length === 0
              ? <tr><td colSpan={8} className="text-center text-gray-400 py-6 text-[12px]">No business tax payments{owner?` for ${owner.name}`:""}</td></tr>
              : btPayments.map(p => (
                <tr key={p.id}>
                  <td><span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{p.orNumber}</span></td>
                  <td className="text-[11px]">{p.datePaid}</td>
                  <td className="font-semibold text-[11px]">{p.businessName}</td>
                  <td className="text-[11px]">{p.periodCovered}</td>
                  <td className="text-[10px] text-gray-500">{p.paymentMethod}</td>
                  <td className="text-right font-mono text-[11px]">{formatPeso(p.baseTax)}</td>
                  <td className={`text-right font-mono text-[11px] ${p.interest>0?"text-red-600 font-bold":""}`}>{formatPeso(p.interest)}</td>
                  <td className="text-right font-mono font-bold text-green-700 text-[11px]">{formatPeso(p.totalPaid)}</td>
                </tr>
              ))
            }
            {btPayments.length > 0 && (
              <tr className="bg-[#EBF0FA] ptr">
                <td colSpan={7} className="font-bold text-[12px] text-right px-3 py-2">TOTAL:</td>
                <td className="text-right font-mono font-bold text-[#1E4E9D] text-[13px] px-3 py-2">{formatPeso(btTotal)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <SectionTitle>Business Registry{owner?` — ${owner.name}`:""}</SectionTitle>
        <table className="gov-table">
          <thead><tr>
            <th>Business ID</th><th>Business Name</th>{!owner&&<th>Owner</th>}
            <th>Line of Business</th><th>Kind of Market</th>
            <th style={{textAlign:"right"}}>Capital</th><th style={{textAlign:"center"}}>Tax Due</th>
          </tr></thead>
          <tbody>
            {ownerBiz.map(b => (
              <tr key={b.id}>
                <td><span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{b.id}</span></td>
                <td className="font-semibold text-[11px]">{b.name}</td>
                {!owner&&<td className="text-[11px]">{b.ownerName}</td>}
                <td className="text-[11px]">{b.lineOfBusiness}</td>
                <td className="text-[11px] text-gray-500">{b.kindOfMarket}</td>
                <td className="text-right font-mono text-[11px]">{formatPeso(b.capitalInvestment)}</td>
                <td style={{textAlign:"center"}}><StatusBadge status={b.taxDueStatus}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // MAYOR'S PERMIT
  if (report.id === "mayors") {
    return (
      <div>
        <ReportHeader title={report.label} year={year} owner={owner}/>
        <div className="grid grid-cols-3 gap-3 mb-5 stat-grid">
          <StatBox label="MP Transactions" value={mpPayments.length}/>
          <StatBox label="MP Collection"   value={formatPeso(mpTotal)} color="text-green-600" sm/>
          <StatBox label="Fiscal Year"     value={year} color="text-[#D4AF37]"/>
        </div>
        <SectionTitle>Mayor's Permit Payments{owner?` — ${owner.name}`:""}</SectionTitle>
        {mpPayments.length > 0 ? (
          <table className="gov-table">
            <thead><tr>
              <th>OR Number</th><th>Date Paid</th><th>Business Name</th>
              {!owner&&<th>Owner</th>}<th>Period</th>
              <th style={{textAlign:"right"}}>Amount</th><th>Processed By</th>
            </tr></thead>
            <tbody>
              {mpPayments.map(p => (
                <tr key={p.id}>
                  <td><span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{p.orNumber}</span></td>
                  <td className="text-[11px]">{p.datePaid}</td>
                  <td className="font-semibold text-[11px]">{p.businessName}</td>
                  {!owner&&<td className="text-[11px]">{p.ownerName}</td>}
                  <td className="text-[11px]">{p.periodCovered}</td>
                  <td className="text-right font-mono font-bold text-green-700 text-[11px]">{formatPeso(p.totalPaid)}</td>
                  <td className="text-[10px] text-gray-400">{p.processedBy}</td>
                </tr>
              ))}
              <tr className="bg-[#EBF0FA] ptr">
                <td colSpan={owner?4:5} className="font-bold text-[12px] text-right px-3 py-2">TOTAL:</td>
                <td className="text-right font-mono font-bold text-[#1E4E9D] text-[13px] px-3 py-2">{formatPeso(mpTotal)}</td>
                <td/>
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-[12px] text-yellow-700">No Mayor's Permit payments{owner?` for ${owner.name}`:""} in {year}.</p>
          </div>
        )}
      </div>
    );
  }

  // REGULATORY FEES
  if (report.id === "regulatory") {
    return (
      <div>
        <ReportHeader title={report.label} year={year} owner={owner}/>
        <div className="grid grid-cols-3 gap-3 mb-5 stat-grid">
          <StatBox label="Transactions"    value={regPayments.length}/>
          <StatBox label="Total Collected" value={formatPeso(regTotal)} color="text-green-600" sm/>
          <StatBox label="Fee Types"       value={regulatoryFees.length}/>
        </div>
        {!owner && (
          <>
            <SectionTitle>Fee Type Schedule</SectionTitle>
            <table className="gov-table mb-4">
              <thead><tr><th>Fee ID</th><th>Fee Name</th><th style={{textAlign:"right"}}>Amount</th><th>Description</th></tr></thead>
              <tbody>
                {regulatoryFees.map(f => (
                  <tr key={f.id}>
                    <td><span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{f.id}</span></td>
                    <td className="font-semibold text-[11px]">{f.name}</td>
                    <td className="text-right font-mono font-bold text-green-700 text-[11px]">{formatPeso(f.amount)}</td>
                    <td className="text-[11px] text-gray-500">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <SectionTitle>Payment Records{owner?` — ${owner.name}`:""}</SectionTitle>
        {regPayments.length > 0 ? (
          <table className="gov-table">
            <thead><tr>
              <th>OR Number</th><th>Date Paid</th>
              {!owner&&<th>Owner</th>}<th>Business</th>
              <th>Fees Paid</th><th style={{textAlign:"right"}}>Total</th><th>Processed By</th>
            </tr></thead>
            <tbody>
              {regPayments.map(p => (
                <tr key={p.id}>
                  <td><span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{p.orNumber}</span></td>
                  <td className="text-[11px]">{p.datePaid}</td>
                  {!owner&&<td className="font-semibold text-[11px]">{p.ownerName}</td>}
                  <td className="text-[11px] text-gray-500">{p.businessName}</td>
                  <td className="text-[11px] text-gray-500 max-w-[140px] truncate">{p.feeDetails||"—"}</td>
                  <td className="text-right font-mono font-bold text-green-700 text-[11px]">{formatPeso(p.totalPaid)}</td>
                  <td className="text-[10px] text-gray-400">{p.processedBy}</td>
                </tr>
              ))}
              <tr className="bg-[#EBF0FA] ptr">
                <td colSpan={owner?4:5} className="font-bold text-[12px] text-right px-3 py-2">TOTAL:</td>
                <td className="text-right font-mono font-bold text-[#1E4E9D] text-[13px] px-3 py-2">{formatPeso(regTotal)}</td>
                <td/>
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <p className="text-[12px] text-gray-500">No regulatory fee payments{owner?` for ${owner.name}`:""} in {year}.</p>
          </div>
        )}
      </div>
    );
  }

  // DELINQUENT
  if (report.id === "delinquent") {
    return (
      <div>
        <ReportHeader title={report.label} year={year} owner={owner}/>
        <div className="grid grid-cols-4 gap-3 mb-5 stat-grid">
          <StatBox label="Overdue Accounts" value={delinquentSummary.count} color="text-red-600"/>
          <StatBox label="Total Base Due"   value={formatPeso(delinquentSummary.totalBaseTaxDue)} color="text-gray-800" sm/>
          <StatBox label="Total Interest"   value={formatPeso(delinquentSummary.totalWithInterest - delinquentSummary.totalBaseTaxDue)} color="text-red-600" sm/>
          <StatBox label="Grand Total Due"  value={formatPeso(delinTotal)} color="text-red-700" sm/>
        </div>
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <AlertTriangle size={14} className="text-red-600 flex-shrink-0 mt-0.5"/>
          <p className="text-[11px] text-red-700">{Math.round(delinquentSummary.interestRate * 100)}% interest applied on all overdue accounts automatically.</p>
        </div>
        <SectionTitle>Delinquent Accounts — {year}</SectionTitle>
        <table className="gov-table">
          <thead><tr>
            <th>Business Name</th><th>Owner Name</th><th>Contact</th>
            <th>Tax Type</th><th>Due Date</th>
            <th style={{textAlign:"right"}}>Days Overdue</th>
            <th style={{textAlign:"right"}}>Base Tax</th>
            <th style={{textAlign:"right"}}>Interest</th>
            <th style={{textAlign:"right"}}>Total Due</th>
          </tr></thead>
          <tbody>
            {delinquentAccounts.length === 0
              ? <tr><td colSpan={9} className="text-center text-gray-400 py-6 text-[12px]">No delinquent accounts found.</td></tr>
              : delinquentAccounts.map(d => (
                <tr key={d.assessmentId}>
                  <td className="font-semibold text-[11px]">{d.businessName}</td>
                  <td className="text-[11px]">{d.ownerName}</td>
                  <td className="font-mono text-[11px]">{d.contact}</td>
                  <td className="text-[11px]">{d.taxType}</td>
                  <td className="text-[11px] text-red-600 font-semibold">{d.dueDate}</td>
                  <td className="text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">{d.daysOverdue}d</span>
                  </td>
                  <td className="text-right font-mono text-[11px]">{formatPeso(d.amountDue)}</td>
                  <td className="text-right font-mono text-[11px] text-red-600 font-bold">{formatPeso(d.interest)}</td>
                  <td className="text-right font-mono font-bold text-red-700 text-[12px]">{formatPeso(d.totalDue)}</td>
                </tr>
              ))
            }
            {delinquentAccounts.length > 0 && (
              <tr className="bg-red-50 ptr" style={{background:"#fef2f2"}}>
                <td colSpan={8} className="font-bold text-[12px] text-right px-3 py-2 text-red-700">TOTAL OUTSTANDING:</td>
                <td className="text-right font-mono font-bold text-red-700 text-[13px] px-3 py-2">{formatPeso(delinTotal)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

// ─── Export Helpers ───────────────────────────────────────
// Build a dataset object for the current report + owner, from live data.
function buildExportData(reportId, year, owner, dataset) {
  const { yearPayments, businesses, delinquentAccounts, regulatoryFees, monthlyRevenueData } = dataset;
  const allP = yearPayments;
  const ownerP = owner ? allP.filter(p => p.ownerId === owner.id) : allP;
  const META = [
    ["Republic of the Philippines"],
    ["Municipality of Sta. Catalina, Negros Oriental"],
    ["Municipal Treasurer's Office"],
    [],
    [`Report: ${REPORTS.find(r=>r.id===reportId)?.label || reportId}`],
    [`Fiscal Year: ${year}`],
    [`Generated: ${new Date().toLocaleDateString("en-PH")}`],
    owner ? [`Owner Filter: ${owner.name} (${owner.id})`] : [],
    [],
  ];

  if (reportId === "daily") {
    const today = todayDateOnly();
    const rows = allP.filter(p => p.datePaid === today);
    return {
      meta: META,
      sheets: [{
        name: "Daily Collection",
        headers: ["OR Number","Business Name","Owner","Tax Type","Amount Paid","Processed By"],
        rows: rows.map(p => [p.orNumber, p.businessName, p.ownerName, p.taxType, p.totalPaid, p.processedBy]),
        totals: ["","","","TOTAL", rows.reduce((s,p)=>s+p.totalPaid,0), ""],
      }],
    };
  }

  if (reportId === "monthly") {
    const sheets = [{
      name: "Monthly Summary",
      headers: ["Month","Business Tax","Mayor's Permit","Reg. Fees","Monthly Total"],
      rows: monthlyRevenueData.map(m => [
        `${m.month} ${year}`, m.businessTax, m.mayorPermit, m.regulatoryFees,
        m.businessTax+m.mayorPermit+m.regulatoryFees,
      ]),
      totals: ["GRAND TOTAL",
        monthlyRevenueData.reduce((s,m)=>s+m.businessTax,0),
        monthlyRevenueData.reduce((s,m)=>s+m.mayorPermit,0),
        monthlyRevenueData.reduce((s,m)=>s+m.regulatoryFees,0),
        monthlyRevenueData.reduce((s,m)=>s+m.businessTax+m.mayorPermit+m.regulatoryFees,0),
      ],
    },{
      name: "Payment Records",
      headers: ["OR Number","Date Paid","Business Name","Owner","Tax Type","Period","Method","Total Paid"],
      rows: ownerP.map(p => [p.orNumber, p.datePaid, p.businessName, p.ownerName, p.taxType, p.periodCovered, p.paymentMethod, p.totalPaid]),
      totals: ["","","","","","","TOTAL", ownerP.reduce((s,p)=>s+p.totalPaid,0)],
    }];
    return { meta: META, sheets };
  }

  if (reportId === "quarterly") {
    const quarters = [
      {label:"Q1 (Jan–Mar)",months:["Jan","Feb","Mar"]},
      {label:"Q2 (Apr–Jun)",months:["Apr","May","Jun"]},
      {label:"Q3 (Jul–Sep)",months:["Jul","Aug","Sep"]},
      {label:"Q4 (Oct–Dec)",months:["Oct","Nov","Dec"]},
    ].map(q => {
      const d = monthlyRevenueData.filter(m => q.months.includes(m.month));
      return [q.label,
        d.reduce((s,m)=>s+m.businessTax,0),
        d.reduce((s,m)=>s+m.mayorPermit,0),
        d.reduce((s,m)=>s+m.regulatoryFees,0),
        d.reduce((s,m)=>s+m.businessTax+m.mayorPermit+m.regulatoryFees,0),
      ];
    });
    return { meta: META, sheets: [{
      name: "Quarterly Summary",
      headers: ["Quarter","Business Tax","Mayor's Permit","Reg. Fees","Quarter Total"],
      rows: quarters,
      totals: ["ANNUAL TOTAL", ...quarters.reduce((acc,q)=>[acc[0]+q[1],acc[1]+q[2],acc[2]+q[3],acc[3]+q[4]],[0,0,0,0])],
    }]};
  }

  if (reportId === "yearly") {
    const ownerBiz = owner ? businesses.filter(b=>b.ownerId===owner.id) : businesses;
    return { meta: META, sheets: [{
      name: "Yearly Payments",
      headers: ["OR Number","Date Paid","Business Name","Owner","Tax Type","Period","Method","Total","Processed By"],
      rows: ownerP.map(p=>[p.orNumber,p.datePaid,p.businessName,p.ownerName,p.taxType,p.periodCovered,p.paymentMethod,p.totalPaid,p.processedBy]),
      totals: ["","","","","","","GRAND TOTAL",ownerP.reduce((s,p)=>s+p.totalPaid,0),""],
    },{
      name: "Businesses",
      headers: ["Business ID","Business Name","Owner","Line of Business","Kind of Market","Capital","Tax Due Status"],
      rows: ownerBiz.map(b=>[b.id,b.name,b.ownerName,b.lineOfBusiness,b.kindOfMarket,b.capitalInvestment,b.taxDueStatus]),
      totals: null,
    }]};
  }

  if (reportId === "business") {
    const ownerBiz = owner ? businesses.filter(b=>b.ownerId===owner.id) : businesses;
    const btP = ownerP.filter(p=>p.taxType==="Business Tax");
    return { meta: META, sheets: [{
      name: "BT Payments",
      headers: ["OR Number","Date Paid","Business Name","Period","Method","Base Tax","Interest","Total"],
      rows: btP.map(p=>[p.orNumber,p.datePaid,p.businessName,p.periodCovered,p.paymentMethod,p.baseTax,p.interest,p.totalPaid]),
      totals: ["","","","","","","TOTAL",btP.reduce((s,p)=>s+p.totalPaid,0)],
    },{
      name: "Business Registry",
      headers: ["Business ID","Business Name","Owner","Line of Business","Kind of Market","Capital","Tax Due Status"],
      rows: ownerBiz.map(b=>[b.id,b.name,b.ownerName,b.lineOfBusiness,b.kindOfMarket,b.capitalInvestment,b.taxDueStatus]),
      totals: null,
    }]};
  }

  if (reportId === "mayors") {
    const mpP = ownerP.filter(p=>p.taxType==="Mayor's Permit");
    return { meta: META, sheets: [{
      name: "Mayor's Permit",
      headers: ["OR Number","Date Paid","Business Name","Owner","Period","Amount","Processed By"],
      rows: mpP.map(p=>[p.orNumber,p.datePaid,p.businessName,p.ownerName,p.periodCovered,p.totalPaid,p.processedBy]),
      totals: ["","","","","TOTAL",mpP.reduce((s,p)=>s+p.totalPaid,0),""],
    }]};
  }

  if (reportId === "regulatory") {
    const regP = ownerP.filter(p=>p.taxType==="Regulatory Fees");
    return { meta: META, sheets: [{
      name: "Fee Schedule",
      headers: ["Fee ID","Fee Name","Amount","Description"],
      rows: regulatoryFees.map(f=>[f.id,f.name,f.amount,f.description]),
      totals: null,
    },{
      name: "Reg Fee Payments",
      headers: ["OR Number","Date Paid","Owner","Business","Fees Paid","Total","Processed By"],
      rows: regP.map(p=>[p.orNumber,p.datePaid,p.ownerName,p.businessName,p.feeDetails||"",p.totalPaid,p.processedBy]),
      totals: ["","","","","TOTAL",regP.reduce((s,p)=>s+p.totalPaid,0),""],
    }]};
  }

  if (reportId === "delinquent") {
    return { meta: META, sheets: [{
      name: "Delinquent Accounts",
      headers: ["Business Name","Owner Name","Contact","Tax Type","Due Date","Days Overdue","Base Tax","Interest","Total Due"],
      rows: delinquentAccounts.map(d=>[d.businessName,d.ownerName,d.contact,d.taxType,d.dueDate,d.daysOverdue,d.amountDue,d.interest,d.totalDue]),
      totals: ["","","","","","","","TOTAL OUTSTANDING",delinquentAccounts.reduce((s,d)=>s+d.totalDue,0)],
    }]};
  }

  return { meta: META, sheets: [] };
}

// ─── PDF Export (jsPDF + jspdf-autotable, bundled — works fully offline) ──
// Brand colors match the rest of this app (#1E4E9D / #D4AF37).
const PH_BLUE = [30, 78, 157];
const GOLD = [212, 175, 55];
const HEADER_BAND_HEIGHT = 28; // mm — the navy header band's fixed height
const HEADER_TO_TITLE_GAP = 8; // mm of breathing room after the band before any text starts

// Waits for the seal image to actually finish loading before calling
// doc.addImage with it. The previous CDN-based version created an
// Image(), set its src, and called doc.addImage on the SAME tick —
// before the browser had loaded any image data at all, so the seal
// never actually rendered; addImage was being handed an empty/
// not-yet-decoded image every time. This returns a promise that only
// resolves once the image is genuinely ready (or fails fast if the
// file is missing, rather than hanging the whole export).
function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });
}

async function exportPDF(reportId, reportLabel, year, owner, dataset) {
  const data = buildExportData(reportId, year, owner, dataset);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Seal loaded and awaited BEFORE any drawing happens, so either it's
  // genuinely available for every page header, or we cleanly skip it —
  // never a half-drawn/broken image.
  let sealImg = null;
  try {
    sealImg = await loadImageElement(sealImgSrc);
  } catch {
    sealImg = null; // missing/failed to load — header still renders correctly without it
  }

  // Draws the full navy header band + gold rule on whichever page is
  // CURRENTLY active. Called once up front for the first page, and
  // again from didDrawPage for every subsequent page, so a multi-page
  // report has a consistent, properly-spaced header on every page
  // instead of only the first — this is also what fixes the spacing
  // issue: every page's content now starts from the SAME measured
  // offset (HEADER_BAND_HEIGHT + HEADER_TO_TITLE_GAP), not a guessed
  // constant that drifted depending on whether an owner filter line
  // was present.
  function drawPageHeader() {
    doc.setFillColor(...PH_BLUE);
    doc.rect(0, 0, W, HEADER_BAND_HEIGHT, "F");

    if (sealImg) {
      // Square aspect, vertically centered in the band, fixed margin
      // from the right edge — same treatment on every page.
      const sealSize = HEADER_BAND_HEIGHT - 6;
      doc.addImage(sealImg, "JPEG", W - sealSize - 6, 3, sealSize, sealSize);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Republic of the Philippines", 14, 8);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("MUNICIPALITY OF STA. CATALINA", 14, 15);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Negros Oriental · Municipal Treasurer's Office", 14, 21);

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`Fiscal Year: ${year}`, W - 14, 12, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-PH")}`, W - 14, 17, { align: "right" });

    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(0, HEADER_BAND_HEIGHT, W, HEADER_BAND_HEIGHT);
  }

  drawPageHeader();

  // Title block — measured from the band's bottom edge, not a fixed
  // guess, so it never visually collides with the band above it
  // regardless of whether the owner-filter line is present.
  let cursorY = HEADER_BAND_HEIGHT + HEADER_TO_TITLE_GAP;

  doc.setTextColor(15, 45, 90);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`${reportLabel} — Fiscal Year ${year}`, 14, cursorY);
  cursorY += 5;

  if (owner) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 78, 157);
    doc.text(`Owner: ${owner.name}  (${owner.id})  ·  ${owner.address || ""}`, 14, cursorY);
    cursorY += 5;
  }

  // One consistent gap before the first table starts, on every report
  // — this is the actual fix for "make sure the spacing is correct":
  // the old code's startY was a hand-picked number (47 or 41) that had
  // no defined relationship to the content above it; this is now
  // always "wherever the title block actually ended, plus a fixed
  // breathing-room gap."
  cursorY += 3;

  data.sheets.forEach((sheet, i) => {
    if (i > 0) {
      doc.addPage();
      drawPageHeader();
      cursorY = HEADER_BAND_HEIGHT + HEADER_TO_TITLE_GAP;
    }

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(sheet.name.toUpperCase(), 14, cursorY);
    cursorY += 4; // fixed, consistent gap between the section label and its table — was previously just "startY - 2" with no real spacing logic

    const bodyRows = sheet.rows.map((row) =>
      row.map((v) =>
        typeof v === "number"
          ? `PHP ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : String(v ?? "")
      )
    );

    const footRows = sheet.totals
      ? [
          sheet.totals.map((v) =>
            typeof v === "number"
              ? `PHP ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : String(v ?? "")
          ),
        ]
      : [];

    autoTable(doc, {
      startY: cursorY,
      head: [sheet.headers],
      body: bodyRows,
      foot: footRows,
      theme: "grid",
      styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [30, 30, 30], lineColor: [210, 210, 210], lineWidth: 0.2 },
      headStyles: { fillColor: PH_BLUE, textColor: 255, fontStyle: "bold", fontSize: 8 },
      footStyles: { fillColor: [235, 240, 250], textColor: PH_BLUE, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 255] },
      margin: { left: 14, right: 14, top: HEADER_BAND_HEIGHT + HEADER_TO_TITLE_GAP },
      didDrawPage: () => {
        // Re-draws the header band on every page autoTable itself
        // creates mid-table (a long table that spans multiple pages),
        // not just the pages we explicitly added above — without this,
        // a table that overflows onto page 3 would show a BLANK page 3
        // with no header at all.
        drawPageHeader();
        doc.setFontSize(7);
        doc.setTextColor(150);
        const pg = doc.internal.getCurrentPageInfo().pageNumber;
        doc.text(
          `Municipality of Sta. Catalina — ${reportLabel}, FY ${year} | Page ${pg}`,
          W / 2,
          doc.internal.pageSize.getHeight() - 6,
          { align: "center" }
        );
      },
    });

    // doc.lastAutoTable.finalY is the real measured bottom of the table
    // just drawn — used (not guessed) for the next sheet's starting
    // position, with a fixed gap, so a 2-sheet report (e.g. Business
    // Tax Report's payments + registry) never has its second table's
    // section label crammed directly against the first table's last row.
    cursorY = doc.lastAutoTable.finalY + 10;
  });

  const ownerSlug = owner ? `_${owner.name.replace(/\s+/g, "_")}` : "";
  doc.save(`StaCatalina_${reportLabel.replace(/\s+/g, "_")}_FY${year}${ownerSlug}.pdf`);
}

// ─── Excel Export (xlsx-js-style, bundled — works fully offline) ─────
// xlsx-js-style is a community fork of SheetJS with the SAME API as
// the free "xlsx" package, plus real cell styling support (the plain
// "xlsx" package has styling disabled entirely — it's a paid SheetJS
// Pro feature). Needed specifically for "make it into a professional
// ... Excel file": bold navy headers, real currency number formatting,
// and borders, instead of an unstyled raw grid of values.

const EXCEL_NAVY = "1E4E9D";
const EXCEL_GOLD = "D4AF37";
const EXCEL_HEADER_FILL = "EBF0FA";
const THIN_BORDER = { style: "thin", color: { rgb: "D9D9D9" } };
const CELL_BORDER = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
// Excel currency format: PHP with thousands separator, 2 decimals,
// negatives in red parens — this is what makes amount columns actually
// READ as currency in Excel (sortable/summable as real numbers) rather
// than as plain numbers a viewer has to mentally interpret.
const PESO_NUMFMT = '"PHP "#,##0.00;[RED]-"PHP "#,##0.00';

function styledCell(value, { header = false, total = false, currency = false } = {}) {
  const isNumber = typeof value === "number";
  const cell = { v: value, t: isNumber ? "n" : "s" };

  if (isNumber && currency) cell.z = PESO_NUMFMT;

  cell.s = {
    font: {
      bold: header || total,
      color: header ? { rgb: "FFFFFF" } : total ? { rgb: EXCEL_NAVY } : { rgb: "1F2937" },
      sz: header ? 10 : 9,
    },
    fill: header
      ? { fgColor: { rgb: EXCEL_NAVY } }
      : total
      ? { fgColor: { rgb: EXCEL_HEADER_FILL } }
      : undefined,
    alignment: {
      horizontal: isNumber ? "right" : "left",
      vertical: "center",
    },
    border: CELL_BORDER,
  };

  return cell;
}

function buildStyledSheet(sheet, currencyColumnIndexes) {
  const aoa = [];

  // Header row
  aoa.push(sheet.headers.map((h) => styledCell(h, { header: true })));

  // Data rows — currency columns get real number formatting, everything
  // else stays plain text/number per its actual JS type.
  sheet.rows.forEach((row) => {
    aoa.push(
      row.map((v, colIdx) =>
        styledCell(v, { currency: currencyColumnIndexes.includes(colIdx) })
      )
    );
  });

  // Totals row, if present — bold, light-blue fill, matching the
  // app's own .ptr total-row treatment in the on-screen tables.
  if (sheet.totals) {
    aoa.push(
      sheet.totals.map((v, colIdx) =>
        styledCell(v, { total: true, currency: currencyColumnIndexes.includes(colIdx) })
      )
    );
  }

  const ws = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.sheet_add_aoa(ws, aoa.map((row) => row.map((c) => c.v)), { origin: "A1" });

  // sheet_add_aoa only writes raw values — apply the per-cell style/
  // format objects built above directly onto the resulting cell refs.
  aoa.forEach((row, r) => {
    row.forEach((cellDef, c) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (!ws[ref]) return;
      ws[ref].s = cellDef.s;
      if (cellDef.z) ws[ref].z = cellDef.z;
      ws[ref].t = cellDef.t;
    });
  });

  // Freeze the header row so it stays visible while scrolling a long
  // report — a real "professional spreadsheet" touch the original
  // never had.
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  const cols = sheet.headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...sheet.rows.map((r) => String(r[i] ?? "").length)
    );
    return { wch: Math.min(Math.max(maxLen + 3, 12), 42) };
  });
  ws["!cols"] = cols;

  return ws;
}

// Identifies which column indexes in each report's sheets hold peso
// amounts, so buildStyledSheet can apply real currency formatting only
// to those — everything else (IDs, names, dates, counts) stays plain.
// Mirrors exactly which columns buildExportData pushes numbers into for
// each report id.
const CURRENCY_COLUMNS = {
  daily: [4],
  monthly: { "Monthly Summary": [1, 2, 3, 4], "Payment Records": [7] },
  quarterly: [1, 2, 3, 4],
  yearly: { "Yearly Payments": [7], Businesses: [5] },
  business: { "BT Payments": [5, 6, 7], "Business Registry": [5] },
  mayors: [5],
  regulatory: { "Fee Schedule": [2], "Reg Fee Payments": [5] },
  delinquent: [6, 7, 8],
};

function currencyColumnsFor(reportId, sheetName) {
  const config = CURRENCY_COLUMNS[reportId];
  if (!config) return [];
  if (Array.isArray(config)) return config;
  return config[sheetName] || [];
}

async function exportExcel(reportId, reportLabel, year, owner, dataset) {
  const data = buildExportData(reportId, year, owner, dataset);
  const wb = XLSX.utils.book_new();

  data.sheets.forEach((sheet) => {
    const currencyCols = currencyColumnsFor(reportId, sheet.name);
    const ws = buildStyledSheet(sheet, currencyCols);
    const safeName = sheet.name.substring(0, 31); // Excel's hard sheet-name length limit
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });

  // A short cover/info sheet with the same LGU letterhead-style meta
  // block every report already shows on screen and in the PDF — placed
  // FIRST in the workbook so opening the file lands on real context
  // (which report, which fiscal year, which owner filter, when it was
  // generated) instead of dropping straight into a bare data grid.
  const infoRows = data.meta
    .filter((row) => row.length > 0)
    .map((row) => [
      styledCell(row[0], {
        header: row[0]?.startsWith?.("Republic") || row[0]?.startsWith?.("Municipality"),
      }),
    ]);
  const infoWs = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.sheet_add_aoa(infoWs, infoRows.map((r) => r.map((c) => c.v)), { origin: "A1" });
  infoRows.forEach((row, r) => {
    row.forEach((cellDef, c) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      applyCellStyle(infoWs, ref, cellDef);
    });
  });
  infoWs["!cols"] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, infoWs, "Report Info");

  // Re-order so "Report Info" is first — book_append_sheet always adds
  // to the end, and SheetJS has no direct "insert at index" API, so the
  // workbook's own SheetNames array is reordered directly instead.
  const infoIdx = wb.SheetNames.indexOf("Report Info");
  wb.SheetNames.splice(infoIdx, 1);
  wb.SheetNames.unshift("Report Info");

  const ownerSlug = owner ? `_${owner.name.replace(/\s+/g, "_")}` : "";
  XLSX.writeFile(wb, `StaCatalina_${reportLabel.replace(/\s+/g, "_")}_FY${year}${ownerSlug}.xlsx`);
}

// Small helper used only by the Report Info sheet above — applies a
// cell's style object onto an already-written worksheet cell, mirroring
// the inline pattern used in buildStyledSheet without duplicating it.
function applyCellStyle(ws, ref, cellDef) {
  if (!ws[ref]) return;
  ws[ref].s = cellDef.s;
  if (cellDef.z) ws[ref].z = cellDef.z;
}

// ─── Export Button with dropdown ─────────────────────────
function ExportMenu({ reportId, reportLabel, year, owner, dataset }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(null);
  const [done, setDone] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const run = async (type) => {
    setOpen(false); setLoading(type); setDone(null);
    try {
      if (type === "pdf")   await exportPDF(reportId, reportLabel, year, owner, dataset);
      if (type === "excel") await exportExcel(reportId, reportLabel, year, owner, dataset);
      setDone(type);
      setTimeout(() => setDone(null), 2500);
    } catch(e) {
      console.error("Export failed", e);
      alert(`Export failed: ${e.message}`);
    } finally { setLoading(null); }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        disabled={!!loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D4AF37] hover:bg-[#b8952e] disabled:opacity-60 text-[#0F2D5A] rounded-md text-[11px] font-bold transition-colors">
        {done
          ? <><CheckCircle2 size={13} className="text-green-800"/> Done!</>
          : loading
          ? <><span className="w-3 h-3 border-2 border-[#0F2D5A]/40 border-t-[#0F2D5A] rounded-full animate-spin"/>{loading === "pdf" ? "PDF…" : "Excel…"}</>
          : <><Download size={13}/> Export</>
        }
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-30 w-44 overflow-hidden">
          <button onClick={() => run("pdf")}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors border-b border-gray-100">
            <FileDown size={14} className="text-red-500"/> Export as PDF
          </button>
          <button onClick={() => run("excel")}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors">
            <FileSpreadsheet size={14} className="text-green-600"/> Export as Excel
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function ReportsPage() {
  const [selectedYear, setSelectedYear]   = useState(new Date().getFullYear());
  const [activeReport, setActiveReport]   = useState(null);
  const [filterOwner,  setFilterOwner]    = useState(null);
  const printContentRef = useRef(null);

  // Live data
  const { payments,            loading: loadingPayments,    error: errorPayments }    = usePayments();
  const { businesses,          loading: loadingBusinesses,  error: errorBusinesses }  = useBusinesses();
  const { owners,               loading: loadingOwners,      error: errorOwners }      = useOwners();
  const { delinquentAccounts, summary: delinquentSummary, loading: loadingDelinquent, error: errorDelinquent } = useDelinquentAccounts();
  const { fees: regulatoryFees, loading: loadingFees,        error: errorFees }        = useRegulatoryFees();

  const loading = loadingPayments || loadingBusinesses || loadingOwners || loadingDelinquent || loadingFees;
  const loadError = errorPayments || errorBusinesses || errorOwners || errorDelinquent || errorFees;

  // Derived, fiscal-year-scoped data, recomputed only when inputs change
  const yearPayments = useMemo(
    () => filterPaymentsByYear(payments, selectedYear),
    [payments, selectedYear]
  );
  const monthlyRevenueData = useMemo(
    () => buildMonthlyRevenueData(payments, selectedYear),
    [payments, selectedYear]
  );

  const dataset = useMemo(() => ({
    yearPayments, businesses, delinquentAccounts, delinquentSummary,
    regulatoryFees, monthlyRevenueData,
  }), [yearPayments, businesses, delinquentAccounts, delinquentSummary, regulatoryFees, monthlyRevenueData]);

  const totalCollection = yearPayments.reduce((s,p) => s+p.totalPaid, 0);
  const currentReport   = activeReport ? REPORTS.find(r => r.id === activeReport) : null;

  useEffect(() => {
    if (!document.getElementById("rpt-print-style")) {
      const s = document.createElement("style");
      s.id = "rpt-print-style"; s.innerHTML = PRINT_STYLES;
      document.head.appendChild(s);
    }
    if (!document.getElementById("rpt-print-portal")) {
      const d = document.createElement("div");
      d.id = "rpt-print-portal"; d.style.display = "none";
      document.body.appendChild(d);
    }
    return () => {
      document.getElementById("rpt-print-style")?.remove();
      document.getElementById("rpt-print-portal")?.remove();
    };
  }, []);

  // Cleans up the print portal once the browser/Electron actually
  // reports the print dialog has closed, via the standard 'afterprint'
  // window event — NOT a fixed setTimeout guess. The previous version
  // used setTimeout(..., 1200), which assumed window.print() blocks
  // until the dialog closes; that assumption does not hold reliably
  // across Chromium/Electron versions (onafterprint can fire before
  // the dialog actually closes on some versions), so a slow render or
  // a print dialog left open longer than 1.2s risked the portal being
  // cleared while still mid-print, producing a blank or truncated
  // printed page. 'afterprint' fires exactly once when print()
  // actually finishes/the dialog closes, regardless of how long that
  // takes — eliminating the guess entirely. This is what fixes "make
  // sure that it prints records" properly rather than racing a timer.
  const handlePrint = useCallback(() => {
    const portal = document.getElementById("rpt-print-portal");
    if (!portal || !printContentRef.current) { window.print(); return; }

    portal.innerHTML = "";
    const clone = printContentRef.current.cloneNode(true);
    clone.querySelectorAll(".no-print").forEach(el => el.remove());
    portal.appendChild(clone);
    portal.style.display = "block";

    const cleanup = () => {
      portal.style.display = "none";
      portal.innerHTML = "";
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);

    // Fallback safety net only — if 'afterprint' never fires for some
    // reason (a platform quirk), the portal still gets cleared
    // eventually rather than permanently blocking the rest of the page
    // from being visible/usable. Deliberately generous (8s, not 1.2s)
    // since this is a last resort, not the primary cleanup mechanism.
    const fallbackTimer = setTimeout(cleanup, 8000);
    window.addEventListener("afterprint", () => clearTimeout(fallbackTimer), { once: true });

    window.print();
  }, []);

  const closeModal = useCallback(() => { setActiveReport(null); setFilterOwner(null); }, []);

  return (
    <div>
      {/* ══ MODAL ══════════════════════════════════════════ */}
      {activeReport && currentReport && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl shadow-2xl max-h-[94vh] flex flex-col">

            {/* Top bar */}
            <div className="bg-[#0F2D5A] text-white px-5 py-3.5 rounded-t-xl flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={closeModal} className="text-white/60 hover:text-white p-1 rounded transition-colors">
                  <ChevronLeft size={18}/>
                </button>
                <div>
                  <p className="text-[9px] text-white/50 uppercase tracking-widest">Report Viewer</p>
                  <h2 className="font-bold text-[14px]">{currentReport.label}</h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {currentReport.ownerFilter && (
                  <div className="w-60">
                    <OwnerFilter owners={owners} selectedOwner={filterOwner} onSelect={setFilterOwner} onClear={() => setFilterOwner(null)}/>
                  </div>
                )}
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                  className="px-2 py-1.5 bg-white/10 border border-white/20 rounded-md text-white text-[12px] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]">
                  {YEARS.map(y => <option key={y} value={y} className="text-gray-800">{y}</option>)}
                </select>
                <button onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-md text-[11px] font-semibold transition-colors">
                  <Printer size={13}/> Print{filterOwner ? " (Owner)" : ""}
                </button>
                <ExportMenu
                  reportId={activeReport}
                  reportLabel={currentReport.label}
                  year={selectedYear}
                  owner={filterOwner}
                  dataset={dataset}
                />
                <button onClick={closeModal}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors">
                  <X size={15}/>
                </button>
              </div>
            </div>

            {/* Owner active banner */}
            {filterOwner && (
              <div className="bg-[#FDF8E7] border-b border-[#D4AF37]/40 px-5 py-2 flex items-center gap-2 flex-shrink-0">
                <User size={12} className="text-[#9A7A1A]"/>
                <span className="text-[11px] font-bold text-[#7A5F10]">Showing records for: {filterOwner.name}</span>
                <span className="text-[10px] text-[#9A7A1A] font-mono">· {filterOwner.id}</span>
                <span className="ml-1 text-[10px] text-[#9A7A1A]">· {filterOwner.businessCount} business(es)</span>
                <button onClick={() => setFilterOwner(null)}
                  className="ml-auto text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                  <X size={11}/> Clear filter
                </button>
              </div>
            )}

            {/* Scrollable content */}
            <div ref={printContentRef} className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-[12px]">
                  <Loader2 size={18} className="animate-spin"/> Loading report data...
                </div>
              ) : loadError ? (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-[12px]">{loadError}</div>
              ) : (
                <ReportContent report={currentReport} year={selectedYear} owner={filterOwner} dataset={dataset}/>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ PAGE ═══════════════════════════════════════════ */}
      <PageHeader title="Reports" subtitle="Generate, filter by owner, print, and export LGU collection reports">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fiscal Year:</label>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30 font-semibold text-[#1E4E9D]">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </PageHeader>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-[12px] mb-4">{loadError}</div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total Collection ({selectedYear})</p>
          <p className="text-[20px] font-bold text-green-600 mt-0.5">
            {loading ? "—" : formatPeso(totalCollection)}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total Transactions</p>
          <p className="text-[20px] font-bold text-[#1E4E9D] mt-0.5">{loading ? "—" : yearPayments.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Report Period</p>
          <p className="text-[16px] font-bold text-gray-700 mt-0.5">Fiscal Year {selectedYear}</p>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-2 gap-3">
        {REPORTS.map(r => (
          <div key={r.id}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:border-[#1E4E9D]/40 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
                  style={{backgroundColor: r.color+"18"}}>
                  <r.icon size={18} style={{color: r.color}}/>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[13px] text-gray-900">{r.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {r.desc} · {selectedYear}
                    {r.ownerFilter && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-[#1E4E9D]">
                        <User size={9}/> owner filter
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => { setActiveReport(r.id); setFilterOwner(null); }}
                  disabled={loading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                  style={{backgroundColor: r.color}}>
                  View
                </button>
                <button onClick={() => exportPDF(r.id, r.label, selectedYear, null, dataset)}
                  disabled={loading}
                  className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-md text-[10px] text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors font-medium disabled:opacity-50">
                  <FileDown size={11}/> PDF
                </button>
                <button onClick={() => exportExcel(r.id, r.label, selectedYear, null, dataset)}
                  disabled={loading}
                  className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-md text-[10px] text-gray-600 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors font-medium disabled:opacity-50">
                  <FileSpreadsheet size={11}/> Excel
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
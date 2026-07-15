import { useState, useEffect, useCallback } from "react";
import {
  Users, Building2, CreditCard,
  AlertTriangle, Clock, FileText, DollarSign,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import KpiCard from "../../components/shared/KpiCard";
import { formatPeso } from "../../utils/taxUtils";
import api from "../../services/api";
import sealImg from "../../assets/seal.jpg";

const COLORS = ["#1E4E9D", "#D4AF37", "#22C55E"];

const EMPTY_DASHBOARD = {
  year: new Date().getFullYear(),
  availableYears: [new Date().getFullYear()],
  kpis: {
    ownerCount: 0,
    businessCount: 0,
    pendingAssessments: 0,
    delinquentCount: 0,
    yearTotal: 0,
    monthTotal: 0,
    regulatoryFeesTotal: 0,
  },
  monthly: [],
  quarterly: [],
  pie: [
    { name: "Business Tax", value: 0 },
    { name: "Mayor's Permit", value: 0 },
    { name: "Reg. Fees", value: 0 },
  ],
  recentPayments: [],
};

export default function DashboardPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async (year) => {
    setLoading(true);
    try {
      const { data } = await api.get("/dashboard", { params: { year } });
      setDashboard(data);
      // If the backend's available-years list differs from what we're
      // showing (e.g. a brand-new year appeared), keep the dropdown in sync.
      if (Array.isArray(data.availableYears) && !data.availableYears.includes(year)) {
        setSelectedYear(data.availableYears[0]);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(selectedYear);
  }, [selectedYear, fetchDashboard]);

  const { kpis, monthly, quarterly, pie, recentPayments, availableYears } = dashboard;

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between mb-5">
        {/* Left Side */}
        <div className="flex items-center gap-3">
          {/* Seal */}
          <img
            src={sealImg}
            alt="Sta. Catalina Seal"
            className="w-10 h-10 rounded-full object-cover border-2 border-[#D4AF37]/30 shadow-sm"
          />

          {/* Title */}
          <div>
            <h1 className="text-[18px] font-bold text-gray-900">
              Revenue Dashboard
            </h1>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Sta. Catalina Revenue Monitoring System
            </p>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0F2D5A] text-white rounded-lg text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
            <FileText size={13} className="text-[#1E4E9D]" />

            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Fiscal Year
            </label>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-[13px] font-bold text-[#1E4E9D] bg-transparent border-none outline-none cursor-pointer"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── KPI Row 1 ── */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <KpiCard
          title="Business Owners"
          value={loading ? "—" : kpis.ownerCount}
          icon={Users}
          color="#1E4E9D"
          sub="Registered owners"
        />
        <KpiCard
          title="Businesses"
          value={loading ? "—" : kpis.businessCount}
          icon={Building2}
          color="#D4AF37"
          sub="Active & inactive"
        />
        <KpiCard
          title="Collections"
          value={loading ? "—" : formatPeso(kpis.yearTotal)}
          icon={CreditCard}
          color="#22C55E"
          sub={`Fiscal Year ${selectedYear}`}
        />
        <KpiCard
          title="Delinquent"
          value={loading ? "—" : kpis.delinquentCount}
          icon={AlertTriangle}
          color="#EF4444"
          sub="Overdue accounts"
        />
      </div>

      {/* ── KPI Row 2 ── */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <KpiCard
          title="Yearly Collection"
          value={loading ? "—" : formatPeso(kpis.yearTotal)}
          icon={DollarSign}
          color="#16A34A"
          sub={`Year ${selectedYear} to date`}
        />
        <KpiCard
          title="Reg. Fees Collected"
          value={loading ? "—" : formatPeso(kpis.regulatoryFeesTotal)}
          icon={FileText}
          color="#7C3AED"
        />
        <KpiCard
          title="Pending Assessments"
          value={loading ? "—" : kpis.pendingAssessments}
          icon={Clock}
          color="#F59E0B"
          sub="Awaiting payment"
        />
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {/* Bar Chart */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[12px] font-semibold text-gray-700">Revenue Report</p>
              <p className="text-[10px] text-gray-400">Monthly collections — {selectedYear}</p>
            </div>
            <span className="text-[10px] font-semibold text-[#1E4E9D] bg-[#EBF0FA] px-2 py-0.5 rounded-full">
              FY {selectedYear}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
              <XAxis dataKey="month" tick={{ fontSize:10 }}/>
              <YAxis tick={{ fontSize:10 }} tickFormatter={v=>`${(v/1000).toFixed(0)}K`}/>
              <Tooltip formatter={v=>formatPeso(v)}/>
              <Legend iconSize={9} wrapperStyle={{ fontSize:10 }}/>
              <Bar dataKey="businessTax"    name="Business Tax"   fill="#1E4E9D" radius={[2,2,0,0]}/>
              <Bar dataKey="mayorPermit"    name="Mayor's Permit" fill="#D4AF37" radius={[2,2,0,0]}/>
              <Bar dataKey="regulatoryFees" name="Reg. Fees"      fill="#22C55E" radius={[2,2,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-[12px] font-semibold text-gray-700 mb-1">Revenue Breakdown</p>
          <p className="text-[10px] text-gray-400 mb-3">FY {selectedYear}</p>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={pie} cx="50%" cy="50%" innerRadius={48} outerRadius={68} dataKey="value">
                {pie.map((_, i) => <Cell key={i} fill={COLORS[i]}/>)}
              </Pie>
              <Tooltip formatter={v=>formatPeso(v)}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-1">
            {pie.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i] }}/>
                  <span className="text-gray-500">{d.name}</span>
                </div>
                <span className="font-semibold text-gray-800">{formatPeso(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-semibold text-gray-700">Tax Collection Trend</p>
            <span className="text-[10px] text-gray-400">FY {selectedYear}</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
              <XAxis dataKey="month" tick={{ fontSize:10 }}/>
              <YAxis tick={{ fontSize:10 }} tickFormatter={v=>`${(v/1000).toFixed(0)}K`}/>
              <Tooltip formatter={v=>formatPeso(v)}/>
              <Legend iconSize={9} wrapperStyle={{ fontSize:10 }}/>
              <Line type="monotone" dataKey="businessTax"  name="Business Tax"   stroke="#1E4E9D" strokeWidth={2} dot={{ r:2 }}/>
              <Line type="monotone" dataKey="mayorPermit"  name="Mayor's Permit" stroke="#D4AF37" strokeWidth={2} dot={{ r:2 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-semibold text-gray-700">Quarterly Collection</p>
            <span className="text-[10px] text-gray-400">FY {selectedYear}</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={quarterly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
              <XAxis dataKey="quarter" tick={{ fontSize:10 }}/>
              <YAxis tick={{ fontSize:10 }} tickFormatter={v=>`${(v/1000).toFixed(0)}K`}/>
              <Tooltip formatter={v=>formatPeso(v)}/>
              <Area type="monotone" dataKey="amount" name="Collection" stroke="#1E4E9D" fill="#EBF0FA" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent Payments Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <p className="text-[12px] font-semibold text-gray-700">Recent Payments</p>
            <p className="text-[10px] text-gray-400">Latest transactions recorded</p>
          </div>
          <a href="/payments" className="text-[11px] text-[#1E4E9D] font-medium hover:underline">
            View all →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="gov-table">
            <thead>
              <tr>
                <th>OR Number</th>
                <th>Date Paid</th>
                <th>Business Name</th>
                <th>Owner</th>
                <th>Tax Type</th>
                <th>Period</th>
                <th>Method</th>
                <th style={{ textAlign:"right" }}>Total Paid</th>
                <th>Processed By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center text-gray-400 py-8 text-[12px]">
                    Loading recent payments...
                  </td>
                </tr>
              ) : recentPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center text-gray-400 py-8 text-[12px]">
                    No payments recorded yet.
                  </td>
                </tr>
              ) : (
                recentPayments.map(p => (
                  <tr key={p.id}>
                    <td>
                      <span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{p.orNumber}</span>
                    </td>
                    <td className="text-[11px] whitespace-nowrap">{p.datePaid}</td>
                    <td className="font-semibold text-[11px]">{p.businessName}</td>
                    <td className="text-[11px]">{p.ownerName}</td>
                    <td>
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        p.taxType==="Mayor's Permit"
                          ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                          : p.taxType==="Regulatory Fees"
                          ? "bg-green-100 text-green-800 border border-green-200"
                          : "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}>{p.taxType}</span>
                    </td>
                    <td className="text-[11px]">{p.periodCovered}</td>
                    <td className="text-[10px] text-gray-500">{p.paymentMethod}</td>
                    <td className="text-right font-mono text-[12px] font-bold text-green-700">
                      {formatPeso(p.totalPaid)}
                    </td>
                    <td className="text-[10px] text-gray-400 max-w-[90px] truncate">{p.processedBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
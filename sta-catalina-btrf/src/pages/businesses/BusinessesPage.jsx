import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Search, Eye, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "../../components/shared/PageHeader";
import StatusBadge from "../../components/shared/StatusBadge";
import { LINES_OF_BUSINESS, BUSINESS_TYPES, KIND_OF_MARKET, BUSINESS_NATURE } from "../../data/mockData";
import api from "../../services/api";
import usePolling from "../../hooks/usePolling";

const EMPTY = {
  name: "", ownerId: "", type: "", lineOfBusiness: "",
  kindOfMarket: "", address: "", dateRegistered: "",
  capitalInvestment: "", status: "Active", businessNature: "",
};
export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState([]);
  const [owners, setOwners]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState("All");
  const [showModal, setShowModal]   = useState(false);
  const [editingBiz, setEditingBiz] = useState(null);
  const [form, setForm]             = useState(EMPTY);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bizRes, ownerRes] = await Promise.all([
        api.get("/businesses"),
        api.get("/owners"),
      ]);
      setBusinesses(bizRes.data.businesses);
      setOwners(ownerRes.data.owners);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load businesses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Pauses background polling while the Add/Edit Business modal is
  // open — a ref (not state) so usePolling's interval always reads the
  // CURRENT value when it fires, without needing to tear down and
  // restart the interval every time the modal opens or closes. Mirrors
  // the same pattern already used in PaymentsPage.jsx/AssessmentPage.jsx.
  const isModalOpenRef = useRef(false);
  useEffect(() => {
    isModalOpenRef.current = showModal;
  }, [showModal]);

  usePolling(fetchData, { intervalMs: 15000, isPausedRef: isModalOpenRef });

  const filtered = businesses.filter((b) => {
    const q = search.toLowerCase();
    const matchQ =
      b.name.toLowerCase().includes(q) ||
      b.ownerName.toLowerCase().includes(q) ||
      b.id.toLowerCase().includes(q) ||
      (b.lineOfBusiness || "").toLowerCase().includes(q);
    const matchF = filter === "All" || b.status === filter;
    return matchQ && matchF;
  });

  const openAddModal = () => {
    setEditingBiz(null);
    setForm(EMPTY);
    setShowModal(true);
  };

  const openEditModal = (b) => {
    setEditingBiz(b);
    setForm({
      name: b.name, ownerId: b.ownerId, type: b.type,
      lineOfBusiness: b.lineOfBusiness, kindOfMarket: b.kindOfMarket,
      address: b.address, dateRegistered: b.dateRegistered,
      capitalInvestment: b.capitalInvestment, status: b.status,
      businessNature: b.businessNature || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBiz) {
        await api.put(`/businesses/${editingBiz.id}`, form);
        toast.success("Business updated.");
      } else {
        await api.post("/businesses", form);
        toast.success("Business registered successfully.");
      }
      setShowModal(false);
      setForm(EMPTY);
      setEditingBiz(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save business.");
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Delete "${b.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/businesses/${b.id}`);
      toast.success("Business deleted.");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete business.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Registered Businesses"
        subtitle="Manage business registrations, kind of market, and tax due status"
      >
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#1E4E9D] text-white rounded-md text-[12px] font-semibold hover:bg-[#163d7a] transition-colors"
        >
          <Plus size={13} /> Register Business
        </button>
      </PageHeader>

      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2.5 mb-3 shadow-sm">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business, owner, ID..."
            className="pl-7 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-md w-[240px]
              focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
          />
        </div>
        <div className="flex gap-1.5">
          {["All", "Active", "Inactive"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                filter === s ? "bg-[#1E4E9D] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="ml-auto text-[11px] text-gray-400">{filtered.length} businesses</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gov-table">
            <thead>
              <tr>
                <th>Business ID</th>
                <th>Business Name</th>
                <th>Owner Name</th>
                <th>Line of Business</th>
                <th>Kind of Market</th>
                <th>Business Nature</th>
                <th>Business Type</th>
                <th style={{ textAlign: "right" }}>Capital (₱)</th>
                <th>Date Registered</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th style={{ textAlign: "center" }}>Tax Due</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="text-center py-8 text-gray-400 text-[12px]">Loading businesses...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-8 text-gray-400 text-[12px]">No businesses found.</td></tr>
              ) : filtered.map((b) => (
                <tr key={b.id}>
                  <td><span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{b.id}</span></td>
                  <td className="font-semibold text-[12px]">{b.name}</td>
                  <td className="text-[11px]">{b.ownerName}</td>
                  <td className="text-[11px]">{b.lineOfBusiness}</td>
                  <td className="text-[11px] text-gray-500">{b.kindOfMarket}</td>
                  <td>
                    {b.businessNature ? (
                      <span
                        title={BUSINESS_NATURE.find((n) => n.value === b.businessNature)?.label || b.businessNature}
                        className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 cursor-help"
                      >
                        {b.businessNature}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-600 font-semibold">⚠ Not set</span>
                    )}
                  </td>
                  <td className="text-[11px] text-gray-500">{b.type}</td>
                  <td className="text-right font-mono text-[11px]">{Number(b.capitalInvestment).toLocaleString()}</td>
                  <td className="text-[11px] text-gray-400">{b.dateRegistered}</td>
                  <td style={{ textAlign: "center" }}><StatusBadge status={b.status} /></td>
                  <td style={{ textAlign: "center" }}><StatusBadge status={b.taxDueStatus} /></td>
                  <td style={{ textAlign: "center" }}>
                    <div className="flex items-center justify-center gap-1">
                      <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-blue-50 text-blue-600" title="View">
                        <Eye size={12} />
                      </button>
                      <button onClick={() => openEditModal(b)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-yellow-50 text-yellow-600" title="Edit">
                        <Edit size={12} />
                      </button>
                      <button onClick={() => handleDelete(b)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-red-500" title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-[15px]">
                {editingBiz ? "Edit Business" : "Register New Business"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Business Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Business name in CAPS"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Business Owner *</label>
                <select
                  required
                  value={form.ownerId}
                  onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                >
                  <option value="">Select owner...</option>
                  {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Business Type *</label>
                <select
                  required
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                >
                  <option value="">Select type...</option>
                  {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Line of Business *</label>
                <select
                  required
                  value={form.lineOfBusiness}
                  onChange={(e) => setForm({ ...form, lineOfBusiness: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                >
                  <option value="">Select line...</option>
                  {LINES_OF_BUSINESS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Kind of Market *</label>
                <select
                  required
                  value={form.kindOfMarket}
                  onChange={(e) => setForm({ ...form, kindOfMarket: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                >
                  <option value="">Select market...</option>
                  {KIND_OF_MARKET.map((k) => <option key={k}>{k}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                  Business Nature *
                  <span className="ml-1 normal-case text-gray-400 font-normal">(determines tax bracket)</span>
                </label>
                <select
                  required
                  value={form.businessNature}
                  onChange={(e) => setForm({ ...form, businessNature: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                >
                  <option value="">Select nature...</option>
                  {BUSINESS_NATURE.map((n) => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  Determines the Local Revenue Code section and tax bracket used at assessment time.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Capital Investment (₱) *</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={form.capitalInvestment}
                  onChange={(e) => setForm({ ...form, capitalInvestment: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Date Registered</label>
                <input
                  type="date"
                  value={form.dateRegistered}
                  onChange={(e) => setForm({ ...form, dateRegistered: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                />
              </div>

              {editingBiz && (
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              )}

              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Business Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Brgy., Sta. Catalina, Negros Oriental"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                />
              </div>

              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-[12px] hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-[#1E4E9D] text-white rounded-md text-[12px] font-semibold hover:bg-[#163d7a]">
                  {editingBiz ? "Save Changes" : "Register Business"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
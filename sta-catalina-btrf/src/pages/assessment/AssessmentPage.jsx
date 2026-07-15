import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, RefreshCw, Trash2, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";

import PageHeader from "../../components/shared/PageHeader";
import StatusBadge from "../../components/shared/StatusBadge";
import { formatPeso, getDueDate } from "../../utils/taxUtils";
import { BUSINESS_NATURE } from "../../data/mockData";
import api from "../../services/api";
import usePolling from "../../hooks/usePolling";

const currentYear = new Date().getFullYear();

// Wide back-window for the table's year filter — see the comment at its
// usage site below. Computed once at module load, not per-render.
const tableYearOptions = (() => {
  const years = [];
  for (let y = currentYear + 1; y >= currentYear - 14; y--) {
    years.push(y);
  }
  return years;
})();

const DEFAULT_FORM = {
  businessId: "",
  year: String(currentYear),
  taxType: "Business Tax",
  paymentFrequency: "Annual",
  grossSales: "",
  dueDate: getDueDate("FULL PAYMENT", null, null, currentYear),
  remarks: "",
};

function natureLabel(value) {
  return BUSINESS_NATURE.find((b) => b.value === value)?.label || value;
}

export default function AssessmentPage() {
  const navigate = useNavigate();

  const [assessments, setAssessments] = useState([]);
  const [businesses, setBusinesses] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [search, setSearch] = useState("");

  // Live tax preview state
  const [preview, setPreview] = useState({
    tax: null,
    section: null,
    loading: false,
    error: null,
  });

  const fetchData = async (yearOverride) => {
    setLoading(true);

    try {
      const year = yearOverride !== undefined ? yearOverride : yearFilter;
      const [bizRes, assRes] = await Promise.all([
        api.get("/businesses"),
        api.get("/assessments", {
          params: year === "ALL" ? {} : { year },
        }),
      ]);

      setBusinesses(bizRes.data.businesses || []);
      setAssessments(assRes.data.assessments || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load assessment data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearFilter]);

  // Pauses background polling while the Generate Assessment modal is
  // open, for the same reason as PaymentsPage.jsx's equivalent guard —
  // a refetch mid-edit would flash the table to its loading state and
  // is pointless while staff are filling out the form rather than
  // looking at the table itself.
  const isGenerateModalOpenRef = useRef(false);
  useEffect(() => {
    isGenerateModalOpenRef.current = showModal;
  }, [showModal]);

  usePolling(fetchData, { intervalMs: 15000, isPausedRef: isGenerateModalOpenRef });

  const selectedBusiness = useMemo(() => {
    return businesses.find((b) => b.id === form.businessId) || null;
  }, [businesses, form.businessId]);

  // Debounced live tax preview — calls GET /assessments/preview-tax as staff types
  useEffect(() => {
    const grossSalesAmount = Number(form.grossSales);

    if (!form.businessId || !form.grossSales || grossSalesAmount <= 0) {
      setPreview({ tax: null, section: null, loading: false, error: null });
      return;
    }

    if (!selectedBusiness?.businessNature) {
      setPreview({ tax: null, section: null, loading: false, error: null });
      return;
    }

    setPreview((prev) => ({ ...prev, loading: true, error: null }));

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/assessments/preview-tax", {
          params: { businessId: form.businessId, grossSales: grossSalesAmount },
        });
        setPreview({ tax: data.tax, section: data.section, loading: false, error: null });
      } catch (err) {
        setPreview({
          tax: null,
          section: null,
          loading: false,
          error: err.response?.data?.message || "Failed to compute tax.",
        });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [form.businessId, form.grossSales, selectedBusiness]);

  const filteredAssessments = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return assessments;

    return assessments.filter((a) => {
      return (
        String(a.id || "").toLowerCase().includes(q) ||
        String(a.businessName || "").toLowerCase().includes(q) ||
        String(a.ownerName || "").toLowerCase().includes(q) ||
        String(a.taxType || "").toLowerCase().includes(q) ||
        String(a.paymentFrequency || "").toLowerCase().includes(q) ||
        String(a.status || "").toLowerCase().includes(q)
      );
    });
  }, [assessments, search]);

  const totalAssessed = assessments.reduce(
    (sum, a) => sum + Number(a.assessmentAmount || 0),
    0
  );

  const totalCollected = assessments.reduce(
    (sum, a) => sum + Number(a.paidAmount || 0),
    0
  );

  const overdueCount = assessments.filter((a) => a.status === "Overdue").length;

  const resetForm = () => {
    setForm({
      ...DEFAULT_FORM,
      year: yearFilter,
      dueDate: getDueDate("FULL PAYMENT", null, null, Number(yearFilter)),
    });
    setPreview({ tax: null, section: null, loading: false, error: null });
  };

  const openModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleBusinessChange = (businessId) => {
    setForm((prev) => ({ ...prev, businessId }));
  };

  // Maps the form's paymentFrequency value to the PAY_METHODS string
  // getDueDate() expects — same mapping assessments.controller.js's
  // FREQUENCY_TO_METHOD uses, duplicated here only because this file has
  // no reason to import a backend controller's internal constant.
  const FREQUENCY_TO_DUE_DATE_METHOD = {
    Annual: "FULL PAYMENT",
    Quarterly: "QUARTERLY",
    "Semi-Annual": "BIANNUAL",
  };

  // The stored assessments.due_date must reflect the FIRST installment's
  // real due date for whichever frequency is selected — Mar 20 for
  // Quarterly (Q1), Jun 20 for Semi-Annual (H1), Jan 20 for Annual. This
  // is what feeds computeDisplayStatus()'s top-level Overdue check;
  // leaving it hardcoded at Jan 20 for a Quarterly assessment would mark
  // it Overdue before Q1 (Mar 20) was even due. Recomputed any time
  // EITHER year or paymentFrequency changes, since both inputs matter.
  const recomputeDueDate = (year, frequency) => {
    const method = FREQUENCY_TO_DUE_DATE_METHOD[frequency] || "FULL PAYMENT";
    return getDueDate(method, 1, 1, Number(year));
  };

  const handleYearChange = (year) => {
    setForm((prev) => ({
      ...prev,
      year,
      dueDate: recomputeDueDate(year, prev.paymentFrequency),
    }));
  };

  const handlePaymentFrequencyChange = (paymentFrequency) => {
    setForm((prev) => ({
      ...prev,
      paymentFrequency,
      dueDate: recomputeDueDate(prev.year, paymentFrequency),
    }));
  };

  // A business owes no Business Tax for the calendar year it registered
  // in, regardless of month — mirrors the same rule enforced server-side
  // in createAssessment(). Checked against form.year (the year staff are
  // actually trying to generate for in this modal), not the current
  // real-world year, so switching the Year dropdown re-evaluates this
  // live as staff change it.
  const registrationYear = selectedBusiness?.dateRegistered
    ? new Date(selectedBusiness.dateRegistered).getUTCFullYear()
    : null;
  const registrationYearBlocked =
    registrationYear !== null && Number(form.year) <= registrationYear;

  // The Year dropdown's floor must reach back far enough to cover a
  // business registered years ago (e.g. 2022) that still has unassessed
  // back years — a fixed 4-year window silently made those years
  // impossible to select at all, which is the actual bug being fixed
  // here. Once a business is selected, the floor becomes
  // registrationYear + 1 (the earliest year it can legally be assessed
  // for, per the exemption above) whenever that's further back than the
  // default window; the ceiling stays a modest currentYear + 1 since
  // there's no legitimate reason to assess further into the future than
  // next year. With no business selected yet, falls back to the
  // original default window (currentYear+1 down to currentYear-2) so the
  // dropdown isn't empty or absurdly long before staff have picked one.
  const yearFloor = registrationYear !== null
    ? Math.min(registrationYear + 1, currentYear - 2)
    : currentYear - 2;
  const yearOptions = [];
  for (let y = currentYear + 1; y >= yearFloor; y--) {
    yearOptions.push(y);
  }

  const canGenerate =
    !!selectedBusiness &&
    !!selectedBusiness.businessNature &&
    !registrationYearBlocked &&
    preview.tax !== null &&
    !preview.loading &&
    !preview.error;

  const handleGenerate = async (e) => {
    e.preventDefault();

    if (!selectedBusiness) {
      toast.error("Please select a business.");
      return;
    }

    if (!selectedBusiness.businessNature) {
      toast.error("This business has no Business Nature set. Set it on the business profile first.");
      return;
    }

    if (registrationYearBlocked) {
      toast.error(
        `${selectedBusiness.name} registered in ${registrationYear} and owes no Business Tax for that year. ` +
        `Choose ${registrationYear + 1} or later.`
      );
      return;
    }

    if (preview.tax === null || preview.error) {
      toast.error("Enter a valid gross sales amount to compute the tax first.");
      return;
    }

    setSaving(true);

    try {
      const { data } = await api.post("/assessments", {
        businessId: selectedBusiness.id,
        year: Number(form.year),
        taxType: form.taxType,
        paymentFrequency: form.paymentFrequency,
        grossSales: Number(form.grossSales),
        dueDate: form.dueDate || null,
        remarks: form.remarks || null,
      });

      setShowModal(false);

      // IMPORTANT: do NOT optimistically prepend data.assessment into local
      // state here. The list is filtered server-side by yearFilter — if the
      // assessment was generated for a year different from yearFilter (the
      // Generate form has its own independent Year dropdown), prepending it
      // would make it appear in the table for this render only, then vanish
      // the next time fetchData() runs (e.g. after navigating away and back,
      // or even just changing the year filter) because the server-side
      // WHERE a.assessment_year = ? correctly excludes it. That mismatch is
      // exactly the "shows once then disappears" bug — re-fetching from the
      // server here is what keeps the visible list always equal to what the
      // database actually has for the year currently being viewed.
      const generatedYear = String(data.assessment.year);
      const matchedCurrentFilter = generatedYear === yearFilter;

      if (matchedCurrentFilter) {
        await fetchData();
      } else {
        // Switch the filter to the year that was actually generated, so the
        // new record is immediately visible instead of silently filtered out.
        setYearFilter(generatedYear);
      }

      toast.success(
        `Assessment generated for ${selectedBusiness.name} — ${formatPeso(preview.tax)}` +
          (matchedCurrentFilter
            ? ""
            : ` (year ${generatedYear} — switched view to that year)`)
      );

      // Hand off straight to Payments using the SAME prefill shape Delinquent
      // Accounts' "Pay Now" already uses (PaymentsPage.jsx's prefill effect
      // reads location.state.prefillOwnerId / prefillBusinessId /
      // prefillTaxType). ownerId comes from data.assessment (mapAssessment()
      // in assessments.controller.js always sets it from the row's own
      // owner_id — read back fresh from the INSERT, not from the businesses
      // dropdown's payload), so this does not depend on whether GET
      // /businesses happens to expose an ownerId field.
      //
      // On the Payments side, this triggers loadPayableAssessments(ownerId),
      // which immediately fetches GET /assessments/payable and locks the
      // Business Tax section to the assessment that was JUST created here —
      // correct amount, correct method (Annual/Quarterly/Semi-Annual,
      // whichever this assessment's payment_frequency turned out to be),
      // and the correct due date, with zero manual re-entry. This applies
      // identically whether the assessment's payment_frequency is Annual
      // (Full Payment), Quarterly, or Semi-Annual — PaymentsPage.jsx's
      // BizPaymentCard has no method-specific branching in how it consumes
      // the locked assessment, so Full Payment gets the exact same
      // direct-to-payment handoff as the installment methods.
      navigate("/payments", {
        state: {
          prefillOwnerId: data.assessment.ownerId,
          prefillBusinessId: data.assessment.businessId,
          prefillTaxType: "Business Tax",
        },
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate assessment.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assessment) => {
    const ok = window.confirm(
      `Delete ${assessment.id} for ${assessment.businessName}? This cannot be undone.`
    );

    if (!ok) return;

    try {
      await api.delete(`/assessments/${assessment.id}`);
      setAssessments((prev) => prev.filter((a) => a.id !== assessment.id));
      toast.success("Assessment deleted.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete assessment.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Tax Assessment"
        subtitle="Generate and manage annual business tax assessments using actual business and payment data"
      >
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#1E4E9D] text-white rounded-md text-[12px] font-semibold hover:bg-[#163d7a]"
        >
          <Plus size={13} /> Generate Assessment
        </button>
      </PageHeader>

      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          {
            label: "Total Assessments",
            value: assessments.length,
            color: "text-[#1E4E9D]",
          },
          {
            label: "Total Assessed",
            value: formatPeso(totalAssessed),
            color: "text-gray-800",
            sm: true,
          },
          {
            label: "Total Collected",
            value: formatPeso(totalCollected),
            color: "text-green-600",
            sm: true,
          },
          {
            label: "Overdue",
            value: overdueCount,
            color: "text-red-600",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm"
          >
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">
              {c.label}
            </p>
            <p
              className={`font-bold ${
                c.sm ? "text-[16px]" : "text-[22px]"
              } ${c.color}`}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          <div>
            <p className="text-[12px] font-semibold text-gray-700">
              Assessment Records — {yearFilter === "ALL" ? "All Years" : yearFilter}
            </p>
            <p className="text-[10px] text-gray-400">
              Status is checked against actual payment records.
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assessment..."
                className="pl-7 pr-3 py-2 text-[12px] border border-gray-200 rounded-md w-[220px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
              />
            </div>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3 py-2 text-[12px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
            >
              {/* Wide back-window (currentYear+1 down to currentYear-14) so
                  older assessments — e.g. back taxes for a business
                  registered well over a decade ago — remain viewable here,
                  not just creatable in the Generate modal above. The old
                  fixed 4-year window made any assessment older than 2
                  years invisible in this filter even after being created. */}
              <option value="ALL">All Years</option>
              {tableYearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>

            <button
              onClick={fetchData}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="gov-table">
            <thead>
              <tr>
                <th>Assessment ID</th>
                <th>Business Name</th>
                <th>Owner Name</th>
                <th style={{ textAlign: "center" }}>Year</th>
                <th>Tax Type</th>
                <th style={{ textAlign: "center" }}>Frequency</th>
                <th style={{ textAlign: "right" }}>Gross Sales</th>
                <th style={{ textAlign: "right" }}>Assessment Amount</th>
                <th style={{ textAlign: "right" }}>Paid</th>
                <th style={{ textAlign: "right" }}>Balance</th>
                <th style={{ textAlign: "center" }}>Due Date</th>
                <th style={{ textAlign: "center" }}>Status</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={13}
                    className="text-center text-gray-400 py-10 text-[12px]"
                  >
                    Loading assessments...
                  </td>
                </tr>
              ) : filteredAssessments.length === 0 ? (
                <tr>
                  <td
                    colSpan={13}
                    className="text-center text-gray-400 py-10 text-[12px]"
                  >
                    {search
                      ? "No assessments match your search."
                      : "No assessments yet. Click Generate Assessment to add one."}
                  </td>
                </tr>
              ) : (
                filteredAssessments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="font-mono text-[11px] font-bold text-[#1E4E9D]">
                        {a.id}
                      </span>
                    </td>
                    <td className="font-semibold text-[12px]">
                      {a.businessName}
                    </td>
                    <td className="text-[11px]">{a.ownerName}</td>
                    <td className="text-center font-bold text-[11px]">
                      {a.year}
                    </td>
                    <td className="text-[11px]">{a.taxType}</td>
                    <td style={{ textAlign: "center" }}>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                        {a.paymentFrequency || "Annual"}
                      </span>
                    </td>
                    <td className="text-right font-mono text-[11px]">
                      {formatPeso(a.grossSales)}
                    </td>
                    <td className="text-right font-mono font-bold text-[#1E4E9D] text-[12px]">
                      {formatPeso(a.assessmentAmount)}
                    </td>
                    <td className="text-right font-mono text-[11px] text-green-700">
                      {formatPeso(a.paidAmount)}
                    </td>
                    <td
                      className={`text-right font-mono text-[11px] ${
                        Number(a.balanceAmount || 0) > 0
                          ? "text-red-600 font-bold"
                          : "text-gray-500"
                      }`}
                    >
                      {formatPeso(a.balanceAmount)}
                    </td>
                    <td className="text-center text-[11px]">
                      {a.dueDate || "—"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <StatusBadge status={a.status} />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        onClick={() => handleDelete(a)}
                        className="w-7 h-7 inline-flex items-center justify-center rounded hover:bg-red-50 text-red-500"
                        title="Delete assessment"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
              <div>
                <h2 className="font-bold text-[15px]">Generate Tax Assessment</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Tax is computed automatically from Gross Sales and Business Nature.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleGenerate} className="flex flex-col flex-1 min-h-0">
              <div className="p-5 space-y-3 overflow-y-auto flex-1 min-h-0">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                    Business *
                  </label>
                  <select
                    required
                    value={form.businessId}
                  onChange={(e) => handleBusinessChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                >
                  <option value="">Select business...</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.ownerName})
                    </option>
                  ))}
                </select>
              </div>

              {selectedBusiness && (
                <div className="bg-[#EBF0FA] border border-[#BFCFE8] rounded-md px-3 py-2">
                  <p className="text-[10px] text-[#1E4E9D] font-bold uppercase tracking-wider">
                    Selected Business
                  </p>
                  <p className="text-[12px] font-semibold text-[#0F2D5A] mt-0.5">
                    {selectedBusiness.name}
                  </p>
                  <p className="text-[11px] text-[#3B6CB7]">
                    Owner: {selectedBusiness.ownerName}
                  </p>
                  <p className="text-[11px] text-[#3B6CB7]">
                    Business Nature:{" "}
                    {selectedBusiness.businessNature
                      ? natureLabel(selectedBusiness.businessNature)
                      : "Not set"}
                  </p>
                  <p className="text-[11px] text-[#3B6CB7]">
                    Date Registered: {selectedBusiness.dateRegistered || "Not set"}
                  </p>

                  {!selectedBusiness.businessNature && (
                    <div className="flex items-start gap-1.5 mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                      <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-amber-700">
                        This business has no Business Nature set. Go to Businesses and set it before an
                        assessment can be generated.
                      </p>
                    </div>
                  )}

                  {registrationYearBlocked && (
                    <div className="flex items-start gap-1.5 mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                      <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-amber-700">
                        Registered in {registrationYear} — owes no Business Tax for its registration
                        year. Choose {registrationYear + 1} or later as the assessment year.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                  Year *
                </label>
                <select
                  value={form.year}
                  onChange={(e) => handleYearChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
                {registrationYear !== null && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    {selectedBusiness.name} registered in {registrationYear} — earliest assessable
                    year is {registrationYear + 1}.
                  </p>
                )}
                {form.year !== yearFilter && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    You're viewing year {yearFilter} but generating for {form.year} — the table will switch to {form.year} after this is created.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                  Tax Type *
                </label>
                <select
                  value={form.taxType}
                  onChange={(e) =>
                    setForm({ ...form, taxType: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                >
                  <option>Business Tax</option>
                  {/* Mayor's Permit removed — no computation logic built yet */}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                  Payment Frequency *
                </label>
                <select
                  value={form.paymentFrequency}
                  onChange={(e) => handlePaymentFrequencyChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                >
                  <option value="Annual">Annual (Full Payment)</option>
                  <option value="Quarterly">Quarterly (4 installments)</option>
                  <option value="Semi-Annual">Semi-Annual (2 installments)</option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  Determines how the owner pays this assessment in the Payments module — locked
                  once selected here and cannot be changed per-payment afterward.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                  Gross Sales (Preceding Calendar Year) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  disabled={!selectedBusiness?.businessNature}
                  value={form.grossSales}
                  onChange={(e) =>
                    setForm({ ...form, grossSales: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30 disabled:bg-gray-100"
                  placeholder="0.00"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Per Section 2A.02 of the Local Revenue Code — tax bracket is computed automatically.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                  Due Date (First Installment)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    readOnly
                    value={form.dueDate}
                    className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-md text-[13px] text-gray-700 cursor-not-allowed"
                  />
                  <Lock size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Computed automatically from Year and Payment Frequency — cannot be edited
                  manually.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">
                  Remarks
                </label>
                <textarea
                  value={form.remarks}
                  onChange={(e) =>
                    setForm({ ...form, remarks: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
                  placeholder="Optional notes..."
                />
              </div>

              <div className="bg-gray-50 rounded-md px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">Computed Tax</span>
                  <span className="font-mono text-[16px] font-bold text-[#1E4E9D]">
                    {preview.loading
                      ? "Computing..."
                      : preview.tax !== null
                      ? formatPeso(preview.tax)
                      : "—"}
                  </span>
                </div>
                {preview.section && (
                  <p className="text-[10px] text-gray-400">
                    Section applied: {natureLabel(preview.section)}
                  </p>
                )}
                {preview.error && (
                  <p className="text-[10px] text-red-500">{preview.error}</p>
                )}
              </div>
              </div>

              <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-[12px] hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !canGenerate}
                  className="px-4 py-2 bg-[#1E4E9D] text-white rounded-md text-[12px] font-semibold hover:bg-[#163d7a] disabled:opacity-50"
                >
                  {saving ? "Generating..." : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

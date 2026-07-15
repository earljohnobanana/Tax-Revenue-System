import { AlertTriangle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/shared/PageHeader";
import useDelinquentAccounts from "../../hooks/useDelinquentAccounts";
import { formatPeso } from "../../utils/taxUtils";
import usePolling from "../../hooks/usePolling";

export default function DelinquentPage() {
  const { delinquentAccounts, summary, loading, error, refetch } = useDelinquentAccounts();
  const navigate = useNavigate();

  // No modal exists on this page (the only action — "Pay Now" — just
  // navigates away to /payments), so there's no "is a modal open" state
  // to pause for here, unlike the other pages' equivalent wiring.
  // Polling can simply run unconditionally.
  usePolling(refetch, { intervalMs: 15000 });

  const handlePayNow = (d) => {
    navigate("/payments", {
      state: {
        prefillOwnerId: d.ownerId,
        prefillBusinessId: d.businessId,
        prefillTaxType: d.taxType,
        prefillAmount: d.amountDue,
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Delinquent Accounts"
        subtitle="Automatically identified overdue business tax accounts — 25% interest applied"
      >
        <div className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-red-700 text-[12px] font-semibold">
          <AlertTriangle size={13} />
          {summary.count} overdue accounts
        </div>
      </PageHeader>

      {/* Alert Banner */}
      <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
        <AlertTriangle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-red-700">
          The following businesses have unpaid taxes beyond their due dates.
          <strong> {Math.round(summary.interestRate * 100)}% interest</strong> has been automatically computed and added to the total amount due.
          Please contact the business owners immediately.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Total Overdue Accounts", value: summary.count, color: "text-red-600" },
          { label: "Total Base Tax Due", value: formatPeso(summary.totalBaseTaxDue), color: "text-gray-800", sm: true },
          { label: "Total w/ Interest", value: formatPeso(summary.totalWithInterest), color: "text-red-700", sm: true },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{c.label}</p>
            <p className={`font-bold ${c.sm ? "text-[16px]" : "text-[22px]"} ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-red-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-600" />
          <p className="text-[12px] font-semibold text-red-700">
            Delinquent Account Report — {new Date().getFullYear()}
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 text-red-700 text-[12px] border-b border-red-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-[12px]">
            <Loader2 size={16} className="animate-spin" />
            Loading delinquent accounts...
          </div>
        ) : delinquentAccounts.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-[12px]">
            No delinquent accounts found. All businesses are up to date.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="gov-table">
              <thead>
                <tr>
                  <th>Business Name</th>
                  <th>Owner Name</th>
                  <th>Contact</th>
                  <th>Address</th>
                  <th>Tax Type</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: "right" }}>Days Overdue</th>
                  <th style={{ textAlign: "right" }}>Base Tax</th>
                  <th style={{ textAlign: "right" }}>Interest ({Math.round(summary.interestRate * 100)}%)</th>
                  <th style={{ textAlign: "right" }}>Total Due</th>
                  <th style={{ textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {delinquentAccounts.map((d) => (
                  <tr key={d.assessmentId}>
                    <td className="font-semibold text-[12px]">{d.businessName}</td>
                    <td className="text-[11px]">{d.ownerName}</td>
                    <td className="font-mono text-[11px]">{d.contact}</td>
                    <td className="text-[11px] text-gray-500">{d.address}</td>
                    <td className="text-[11px]">{d.taxType}</td>
                    <td className="text-[11px] text-red-600 font-semibold">{d.dueDate}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                        {d.daysOverdue} days
                      </span>
                    </td>
                    <td className="text-right font-mono text-[11px]">{formatPeso(d.amountDue)}</td>
                    <td className="text-right font-mono text-[11px] text-red-600 font-semibold">
                      {formatPeso(d.interest)}
                    </td>
                    <td className="text-right font-mono text-[12px] font-bold text-red-700">
                      {formatPeso(d.totalDue)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        onClick={() => handlePayNow(d)}
                        className="px-2.5 py-1 bg-[#1E4E9D] text-white text-[10px] font-semibold rounded hover:bg-[#163d7a] transition-colors"
                      >
                        Pay Now
                      </button>
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-red-50">
                  <td colSpan={9} className="text-right font-bold text-[12px] text-red-700 px-3 py-2">
                    TOTAL OUTSTANDING:
                  </td>
                  <td className="text-right font-mono font-bold text-[14px] text-red-700 px-3 py-2">
                    {formatPeso(summary.totalWithInterest)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
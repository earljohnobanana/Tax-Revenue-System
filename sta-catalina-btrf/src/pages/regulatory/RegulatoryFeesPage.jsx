// ============================================================
// RegulatoryFeesPage.jsx
// Location: src/pages/regulatory/RegulatoryFeesPage.jsx
// ============================================================
import PageHeader from "../../components/shared/PageHeader";
import StatusBadge from "../../components/shared/StatusBadge";
import useRegulatoryFees from "../../hooks/useRegulatoryFees";
import { formatPeso } from "../../utils/taxUtils";
import { AlertCircle } from "lucide-react";

export default function RegulatoryFeesPage() {
  const { fees, loading, error } = useRegulatoryFees();

  return (
    <div>
      <PageHeader
        title="Regulatory Fees"
        subtitle="Sanitary, health, PESO, and other regulatory fee catalog"
      />

      {/* Add/Edit/Delete are intentionally not offered here yet — the
          backend (server/controllers/regulatoryFees.controller.js)
          currently only exposes GET. Catalog changes must be made
          directly against the regulatory_fees table until create/update/
          delete endpoints exist. Showing non-functional buttons here
          would be worse than showing none, since staff would believe an
          edit succeeded when nothing was actually persisted. */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-[11px] text-blue-800 mb-4">
        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
        <span>
          This catalog is read-only in the app. To add, edit, or deactivate a
          fee, contact your system administrator to update it directly in
          the database.
        </span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="gov-table">
          <thead>
            <tr>
              <th>Fee ID</th>
              <th>Fee Name</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th>Description</th>
              <th style={{ textAlign: "center" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400 text-[12px]">
                  Loading regulatory fees...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-red-500 text-[12px]">
                  {error}
                </td>
              </tr>
            ) : fees.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400 text-[12px]">
                  No regulatory fees found.
                </td>
              </tr>
            ) : (
              fees.map((f) => (
                <tr key={f.id}>
                  <td><span className="font-mono text-[11px] font-bold text-[#1E4E9D]">{f.id}</span></td>
                  <td className="font-semibold text-[12px]">{f.name}</td>
                  <td className="text-right font-mono font-bold text-green-700">{formatPeso(f.amount)}</td>
                  <td className="text-[11px] text-gray-500">{f.description}</td>
                  <td style={{ textAlign: "center" }}><StatusBadge status={f.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
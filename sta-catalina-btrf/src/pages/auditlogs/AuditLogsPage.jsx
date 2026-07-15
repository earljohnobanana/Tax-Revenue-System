import { useState, useEffect, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import PageHeader from "../../components/shared/PageHeader";
import api from "../../services/api";
import { toast } from "sonner";

// Colors keyed by the REAL action strings every controller in this
// codebase actually writes (CREATE_PAYMENT, UPDATE_ASSESSMENT, etc.),
// not the old mock data's short generic labels (PAYMENT, ADD, EDIT).
// Falls back to a neutral gray badge for any action not explicitly
// listed here, so a future controller adding a new action type never
// renders as visually broken — just unstyled-but-correct.
const ACTION_COLORS = {
  LOGIN: "bg-blue-100 text-blue-700 border border-blue-200",
  LOGOUT: "bg-blue-100 text-blue-700 border border-blue-200",
  CREATE_PAYMENT: "bg-green-100 text-green-700 border border-green-200",
  UPDATE_PAYMENT: "bg-orange-100 text-orange-700 border border-orange-200",
  DELETE_PAYMENT: "bg-red-100 text-red-700 border border-red-200",
  CREATE_ASSESSMENT: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  UPDATE_ASSESSMENT: "bg-orange-100 text-orange-700 border border-orange-200",
  DELETE_ASSESSMENT: "bg-red-100 text-red-700 border border-red-200",
  CREATE_BUSINESS: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  UPDATE_BUSINESS: "bg-orange-100 text-orange-700 border border-orange-200",
  DELETE_BUSINESS: "bg-red-100 text-red-700 border border-red-200",
  UPDATE_SETTINGS: "bg-purple-100 text-purple-700 border border-purple-200",
};

function actionBadgeClass(action) {
  return ACTION_COLORS[action] || "bg-gray-100 text-gray-600 border border-gray-200";
}

function formatDetails(details) {
  if (!details) return "—";
  if (typeof details === "string") return details;
  try {
    return Object.entries(details)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  } catch {
    return JSON.stringify(details);
  }
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [filterOptions, setFilterOptions] = useState({ actions: [], modules: [] });

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get("/audit-logs", {
        params: {
          page,
          limit: 50,
          search: search.trim() || undefined,
          action: actionFilter || undefined,
          module: moduleFilter || undefined,
        },
      });
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, moduleFilter]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const { data } = await api.get("/audit-logs/filter-options");
      setFilterOptions(data);
    } catch {
      // Non-critical — filters just stay empty if this fails; the page
      // itself still works without them.
    }
  }, []);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // Re-fetches from page 1 whenever a filter changes, since the
  // previous page number may no longer be valid against the new
  // filtered result set.
  useEffect(() => {
    fetchLogs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, actionFilter, moduleFilter]);

  const goToPage = (page) => {
    if (page < 1 || page > pagination.totalPages) return;
    fetchLogs(page);
  };

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Track all system activity — logins, edits, payments, assessments, and more"
      />

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <p className="text-[12px] font-semibold text-gray-700 mr-auto">System Activity Log</p>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-md text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
          >
            <option value="">All Actions</option>
            {filterOptions.actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-md text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
          >
            <option value="">All Modules</option>
            {filterOptions.modules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, action, module..."
              className="pl-7 pr-3 py-1.5 text-[11px] border border-gray-200 rounded-md w-[220px] focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30"
            />
          </div>

          <p className="text-[11px] text-gray-400 whitespace-nowrap">{pagination.total} entries</p>
        </div>

        <div className="overflow-x-auto">
          <table className="gov-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Timestamp</th>
                <th>User</th>
                <th style={{ textAlign: "center" }}>Action</th>
                <th>Module</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-10 text-[12px]">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Loading audit logs...
                    </span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-10 text-[12px]">
                    {search || actionFilter || moduleFilter
                      ? "No log entries match your filters."
                      : "No log entries yet."}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="font-mono text-[10px] font-bold text-[#1E4E9D]">#{log.id}</span>
                    </td>
                    <td className="font-mono text-[10px] text-gray-500">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString("en-PH") : "—"}
                    </td>
                    <td className="font-semibold text-[11px]">{log.user}</td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${actionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="text-[11px]">{log.module}</td>
                    <td className="text-[11px] text-gray-500 max-w-xs truncate" title={formatDetails(log.details)}>
                      {formatDetails(log.details)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-[11px] text-gray-400">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
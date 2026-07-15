const VARIANTS = {
  Active: "bg-green-100 text-green-800 border border-green-200",
  Inactive: "bg-gray-100 text-gray-600 border border-gray-200",

  Paid: "bg-green-100 text-green-800 border border-green-200",
  Unpaid: "bg-red-100 text-red-700 border border-red-200",
  Partial: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  Overdue: "bg-red-100 text-red-800 border border-red-300",

  "No Assessment": "bg-slate-100 text-slate-700 border border-slate-200",

  Exempt: "bg-blue-100 text-blue-700 border border-blue-200",
  Pending: "bg-orange-100 text-orange-700 border border-orange-200",
};

export default function StatusBadge({ status }) {
  const safeStatus = status || "No Assessment";
  const cls =
    VARIANTS[safeStatus] ||
    "bg-gray-100 text-gray-600 border border-gray-200";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${cls}`}
    >
      {safeStatus}
    </span>
  );
}
export default function KpiCard({
  title,
  value,
  icon: Icon,
  color = "#22C55E",
  sub,
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs text-slate-500 font-medium">
            {title}
          </p>

          <h3 className="text-3xl font-bold text-slate-900 mt-2">
            {value}
          </h3>

          {sub && (
            <p className="text-xs text-slate-400 mt-2">
              {sub}
            </p>
          )}
        </div>

        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            backgroundColor: `${color}15`,
          }}
        >
          <Icon size={22} color={color} />
        </div>
      </div>
    </div>
  );
}
export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="text-[18px] font-bold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-[12px] text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {children}
        </div>
      )}
    </div>
  );
}

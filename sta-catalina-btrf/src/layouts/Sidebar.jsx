import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  ClipboardList,
  AlertTriangle,
  Receipt,
  BarChart3,
  ScrollText,
  UserCog,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import sealImg from "../assets/seal.jpg";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Business & Owners", icon: Users, path: "/owners" },
  { label: "Tax Assessment", icon: ClipboardList, path: "/assessment" },
  { label: "Payments", icon: CreditCard, path: "/payments" },
  { label: "Delinquent Accounts", icon: AlertTriangle, path: "/delinquent" },
  { label: "Official Receipts", icon: Receipt, path: "/receipts" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Audit Logs", icon: ScrollText, path: "/audit-logs" },
  { label: "User Management", icon: UserCog, path: "/user-management" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully.");
    navigate("/login");
  };

  return (
    <aside
      className="relative flex flex-col h-screen bg-[#0F2D5A] text-white transition-all duration-300 flex-shrink-0"
      style={{ width: collapsed ? "64px" : "220px" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-4 border-b border-white/10">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-white">
          <img
            src={sealImg}
            alt="Sta. Catalina Seal"
            className="w-8 h-8 object-cover rounded-full"
          />
        </div>

        {!collapsed && (
          <div>
            <p className="text-[#D4AF37] font-black text-[11px] leading-tight">
              TAX SYSTEM
            </p>
            <p className="text-white/40 text-[9px]">
              Treasurer&apos;s Office Sta. Catalina · Neg. Or.
            </p>
          </div>
        )}
      </div>

      {/* User info */}
      {!collapsed && (
        <div className="px-3 py-3 border-b border-white/10">
          <p className="text-[9px] text-white/35 uppercase tracking-wider mb-1">
            Logged in as
          </p>
          <p className="text-white font-bold text-[11px] truncate">
            {user?.name}
          </p>
          <span className="inline-block mt-1 px-2 py-0.5 bg-[#D4AF37] text-[#0F2D5A] text-[9px] font-black rounded-md">
            {user?.role?.toUpperCase()}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5">
        {!collapsed && (
          <p className="text-[9px] text-white/25 uppercase tracking-widest px-2 py-2">
            Main Menu
          </p>
        )}

        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2 py-2 rounded-lg text-[11px] transition-all duration-150 ${
                    isActive
                      ? "bg-[#1E4E9D] text-[#D4AF37] font-bold shadow-sm"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <item.icon size={14} className="flex-shrink-0" />

                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <span className="truncate block">{item.label}</span>

                    {item.note && (
                      <span className="text-[8px] text-white/30 block leading-none mt-0.5">
                        {item.note}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout */}
      <div className="px-1.5 py-2 border-t border-white/10">
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-[11px] text-white/55 hover:bg-red-600/60 hover:text-white transition-colors"
        >
          <LogOut size={14} className="flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>

        {!collapsed && (
          <p className="text-center text-white/15 text-[9px] mt-2">
            BTRF v1.0.0
          </p>
        )}
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[72px] w-6 h-6 rounded-full bg-[#1E4E9D] border-2 border-[#0F2D5A] flex items-center justify-center hover:bg-[#D4AF37] hover:text-[#0F2D5A] transition-colors z-10 text-white shadow-md"
      >
        {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
      </button>
    </aside>
  );
}
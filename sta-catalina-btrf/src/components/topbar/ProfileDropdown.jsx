import { useNavigate } from "react-router-dom";
import { User, LogOut, ChevronRight } from "lucide-react";

export default function ProfileDropdown({ user, logout, onClose }) {
  const navigate = useNavigate();

  const goTo = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#1E4E9D] flex items-center justify-center">
            <User className="text-white" size={22} />
          </div>
          <div>
            <h3 className="font-semibold">{user?.name}</h3>
            <p className="text-sm text-gray-500">{user?.role}</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => goTo("/settings")}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <User size={18} />
          My Profile
        </div>
        <ChevronRight size={16} />
      </button>

      <button
        onClick={() => goTo("/settings")}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <User size={18} />
          Account Settings
        </div>
        <ChevronRight size={16} />
      </button>

      <hr />

      <button
        onClick={() => {
          logout();
          onClose();
        }}
        className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50"
      >
        <LogOut size={18} />
        Logout
      </button>
    </div>
  );
}
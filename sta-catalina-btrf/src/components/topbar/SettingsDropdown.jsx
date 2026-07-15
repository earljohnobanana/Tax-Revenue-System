import { useNavigate } from "react-router-dom";
import { Moon, Sun, Globe, Lock } from "lucide-react";

export default function SettingsDropdown({ onClose }) {
  const navigate = useNavigate();

  const goTo = () => {
    navigate("/settings");
    onClose();
  };

  return (
    <div className="absolute right-0 mt-2 w-64 bg-white border rounded-xl shadow-lg z-50">
      <div className="p-4 font-semibold border-b">Settings</div>

      <button onClick={goTo} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
        <Sun size={18} />
        Light Mode
      </button>

      <button onClick={goTo} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
        <Moon size={18} />
        Dark Mode
      </button>

      <button onClick={goTo} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
        <Globe size={18} />
        Language
      </button>

      <button onClick={goTo} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
        <Lock size={18} />
        Security
      </button>
    </div>
  );
}
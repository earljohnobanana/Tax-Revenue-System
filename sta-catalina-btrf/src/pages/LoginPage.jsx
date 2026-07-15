import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, User, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import sealImg from "../assets/seal.jpg";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const ok = await login(username, password);
    if (ok) {
      toast.success("Login successful. Welcome!");
      navigate("/dashboard");
    } else {
      toast.error("Invalid username or password.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT PANEL */}
      <div
        className="hidden lg:flex flex-col items-center justify-center flex-1 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(150deg, #0F2D5A 0%, #1E4E9D 55%, #2563EB 100%)",
        }}
      >
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 0,transparent 40px), repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 0,transparent 40px)",
          }}
        />

        <div className="relative z-10 text-center text-white px-12 max-w-sm">
          {/* Seal */}
          <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-white/10 border-4 border-[#D4AF37]/40 flex items-center justify-center shadow-2xl overflow-hidden">
            <img
              src={sealImg}
              alt="Bayan ng Santa Catalina Seal"
              className="w-28 h-28 object-cover rounded-full"
            />
          </div>

          <div className="w-16 h-0.5 bg-[#D4AF37] mx-auto mb-5" />

          <h1 className="text-3xl font-black tracking-widest mb-1 text-white">
            STA. CATALINA
          </h1>
          <p className="text-[11px] text-white/50 uppercase tracking-[0.2em] mb-6">
            Negros Oriental
          </p>

          <p className="text-[13px] font-semibold text-[#D4AF37] leading-relaxed">
            Business Tax &amp; Regulatory Fees<br />
            Management System
          </p>

          <div className="w-16 h-0.5 bg-[#D4AF37] mx-auto mt-6 mb-5" />

          <p className="text-[10px] text-white/35 leading-relaxed">
            Municipal Treasurer's Office<br />
            Business Permit &amp; Licensing Office<br />
            Accounting Office
          </p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex flex-col justify-center items-center w-full lg:w-[420px] bg-white px-10 py-12 shadow-2xl">
        <div className="w-full max-w-[320px]">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[#0F2D5A] mx-auto flex items-center justify-center mb-3">
              <Shield size={28} className="text-[#D4AF37]" />
            </div>
            <h1 className="text-base font-bold text-[#0F2D5A]">
              BTRF Management System
            </h1>
            <p className="text-[11px] text-gray-400">
              Municipality of Sta. Catalina
            </p>
          </div>

          <h2 className="text-[22px] font-bold text-gray-900 mb-1">
            Sign In
          </h2>
          <p className="text-[12px] text-gray-400 mb-7">
            Enter your credentials to access the system.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                Username
              </label>
              <div className="relative">
                <User
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Enter username"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-md text-[13px]
                    focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30 focus:border-[#1E4E9D]
                    transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPw ? "text" : "password"}
                  required
                  placeholder="Enter password"
                  className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-md text-[13px]
                    focus:outline-none focus:ring-2 focus:ring-[#1E4E9D]/30 focus:border-[#1E4E9D]
                    transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Remember / Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[12px] text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#1E4E9D]"
                />
                Remember me
              </label>
              <button
                type="button"
                className="text-[12px] text-[#1E4E9D] hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#1E4E9D] text-white text-[13px] font-bold rounded-md
                hover:bg-[#163d7a] transition-colors disabled:opacity-60 mt-1"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <div className="mt-auto pt-8 text-center">
          <p className="text-[10px] text-gray-400">
            Municipality of Sta. Catalina · Negros Oriental
          </p>
          <p className="text-[10px] text-gray-300">
            © 2025 BTRF Management System
          </p>
        </div>
      </div>
    </div>
  );
}
import { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("bpls_user");
      const savedToken = localStorage.getItem("bpls_token");
      // Only restore `user` if a token also exists. A user object with
      // no token is a desynced/stale session and must be treated as
      // logged out, otherwise every protected request will 401 on
      // mount before the user ever does anything.
      if (savedUser && savedToken) {
        return JSON.parse(savedUser);
      }
      localStorage.removeItem("bpls_user");
      return null;
    } catch {
      return null;
    }
  });

  const login = async (username, password) => {
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("bpls_token", data.token);
      localStorage.setItem("bpls_user", JSON.stringify(data.user));
      setUser(data.user);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("bpls_token");
    localStorage.removeItem("bpls_user");
  };

  // Listen for the event api.js dispatches on any 401. This keeps
  // in-memory `user` state in sync with localStorage immediately,
  // instead of relying on the full page reload to clear it.
  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener("bpls:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("bpls:unauthorized", handleUnauthorized);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
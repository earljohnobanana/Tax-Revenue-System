// sta-catalina-btrf/src/service/api.js

import axios from "axios";

// Single machine, no server/client mode: the API always lives at
// http://localhost:5000, started by this same Electron app (see
// electron/main.js). No LAN address to resolve, so this is fixed.
const api = axios.create({
  baseURL: "http://localhost:5000/api",
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bpls_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRedirecting = false;

api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error("[API ERROR]", {
      message: err.message,
      status: err.response?.status,
      url: err.config?.url,
      baseURL: err.config?.baseURL,
      fullUrl: `${err.config?.baseURL || ""}${err.config?.url || ""}`,
    });

    if (err.response?.status === 401) {
      const onLoginPage = window.location.pathname === "/login";
      localStorage.removeItem("bpls_token");
      localStorage.removeItem("bpls_user");
      window.dispatchEvent(new Event("bpls:unauthorized"));
      if (!onLoginPage && !isRedirecting) {
        isRedirecting = true;
        window.location.href = "/login";
      }
    }

    return Promise.reject(err);
  }
);

export default api;
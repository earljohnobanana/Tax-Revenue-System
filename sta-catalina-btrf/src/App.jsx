import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import AppRoutes from "./routes/AppRoutes";

const queryClient = new QueryClient();

export default function App() {
  // Single machine, no server/client mode: the app always loads via
  // http://localhost:5000 in production (electron/main.js) or
  // http://localhost:5173 in dev — both real http:// origins, so
  // HashRouter isn't strictly required anymore, but it's kept as-is
  // since it works fine for both and there's no reason to touch routing
  // that already works.
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </HashRouter>
    </QueryClientProvider>
  );
}
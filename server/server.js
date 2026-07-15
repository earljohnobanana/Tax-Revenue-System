require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const { testConnection } = require("./config/db");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth.routes");
const notificationRoutes = require("./routes/notifications.routes");

const usersRoutes = require("./routes/users.routes");
const ownersRoutes = require("./routes/owners.routes");
const businessesRoutes = require("./routes/businesses.routes");
const paymentsRoutes = require("./routes/payments.routes");
const assessmentsRoutes = require("./routes/assessments.routes");
const delinquentRoutes = require("./routes/delinquent.routes");
const regulatoryFeesRoutes = require("./routes/regulatoryFees.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const settingsRoutes = require("./routes/settings.routes");
const auditLogsRoutes = require("./routes/auditLogs.routes");


const app = express();
const PORT = process.env.PORT || 5000;

// Single machine, no LAN clients: this server only needs to answer this
// same PC's own Electron window, so it binds to loopback only. Nothing
// outside this machine can reach it, regardless of firewall state.
const BIND_HOST = process.env.BIND_HOST || "127.0.0.1";

const isDev = process.env.NODE_ENV === "development";

// NOTE: Content-Security-Policy is intentionally NOT set here. It's set
// in electron/main.js instead, via session.webRequest.onHeadersReceived —
// the main process is what actually renders the page, so that's the
// right place to attach response headers for it. See main.js for the
// actual policy (a fixed connect-src of http://localhost:5000, since
// this app is single-machine only).
app.use(helmet({
  contentSecurityPolicy: false,
}));

// CORS origin handling, explained:
//
// Browser-based requests (Vite dev server on :5173, or this same Express
// process serving the built SPA on :5000) send a real `Origin` header
// like "http://localhost:5173" — those two are kept for local development
// and for the packaged app's own window (which loads http://localhost:5000).
//
// Origin `undefined` covers same-machine/non-browser clients (curl,
// Postman), and "file://" is kept for safety in case any window ever
// loads a local file directly. A request from a real, unexpected web
// origin still gets rejected by the `else` branch below — this is
// deliberately a short, explicit allow-list, not `origin: true`.
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5000",
  "file://",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin "${origin}" is not allowed by CORS.`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));
app.use("/api/users", usersRoutes);
app.use("/api/owners", ownersRoutes);
app.use("/api/businesses", businessesRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/assessments", assessmentsRoutes);
app.use("/api/delinquent", delinquentRoutes);
app.use("/api/regulatory-fees", regulatoryFeesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/audit-logs", auditLogsRoutes);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});

app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);

// Note: "sta-catalina-btrf" here because that's your frontend's actual
// subfolder name — the build output lands inside it, not at root.
const clientDist = path.join(__dirname, "..", "sta-catalina-btrf", "dist");
app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(clientDist, "index.html"));
});

app.use((req, res) => res.status(404).json({ message: "Not found" }));
app.use(errorHandler);

testConnection();

app.listen(PORT, BIND_HOST, () => {
  console.log(`BPLS API server running on http://localhost:${PORT}`);
});

module.exports = app;
// backend/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");

const db = require("./db"); // đồng nhất theo backend/db.js

const app = express();

// Render / reverse proxy
app.set("trust proxy", 1);

// ================= Middleware =================
/**
 * FRONTEND_URL:
 * - Có thể set 1 hoặc NHIỀU domain, cách nhau dấu phẩy
 *   Ví dụ:
 *   FRONTEND_URL=https://webgis-ninh-thuan-1.onrender.com,http://localhost:3000
 */
const FRONTEND_URL_RAW = (process.env.FRONTEND_URL || "").trim();
const ALLOWED_ORIGINS = FRONTEND_URL_RAW
  ? FRONTEND_URL_RAW.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

/**
 * CORS:
 * - Nếu có ALLOWED_ORIGINS => chỉ cho phép các origin đó
 * - Nếu không set => cho phép tất cả (dev/test)
 */
app.use(
  cors({
    origin: (origin, cb) => {
      // origin = undefined khi gọi từ Postman/curl/server-to-server
      if (!origin) return cb(null, true);

      if (!ALLOWED_ORIGINS) return cb(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);

      return cb(new Error(`CORS blocked: ${origin}`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Preflight
app.options("*", cors());

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Log request
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Fix lỗi favicon.ico
app.get("/favicon.ico", (_req, res) => res.status(204).end());

// ================= Health check (Render) =================
app.get("/_health", async (_req, res) => {
  try {
    const r = await db.query("SELECT 1 AS ok");
    res.json({ ok: true, db: r.rows?.[0]?.ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "DB error" });
  }
});

// ================= Routes =================
// API Ninh Thuận
const ninhthuanRoutes = require("./routes/ninhthuan");
app.use("/api/ninhthuan", ninhthuanRoutes);

// API AHP
const ahpRoutes = require("./routes/ahpRoutes");
app.use("/api/ahp", ahpRoutes);

// API Admin
const adminRoutes = require("./routes/adminRoutes");
app.use("/api/admin", adminRoutes);

// ================= Root test =================
app.get("/", (_req, res) => {
  res.json({
    status: "✅ WebGIS Backend Ninh Thuận đang hoạt động",
    allowed_origins: ALLOWED_ORIGINS || "ALL (dev/test)",
    health: "/_health",
    api_available: {
      ninhthuan: {
        "Bách Hóa Xanh": "/api/ninhthuan/bhx-ninhthuan",
        "Chợ": "/api/ninhthuan/cho-ninhthuan",
        "Đối thủ cạnh tranh": "/api/ninhthuan/doithu-ninhthuan",
        "Trường học": "/api/ninhthuan/truong-ninhthuan",
        "Giao thông": "/api/ninhthuan/giaothong-ninhthuan",
        "Ranh giới": "/api/ninhthuan/ranhgioi-ninhthuan",
        "Bản đồ vị trí AHP": "/api/ninhthuan/bandovitri-ninhthuan",
        "Buffer BHX": "/api/ninhthuan/buffer-bhx-ninhthuan",
        "Buffer Chợ": "/api/ninhthuan/buffer-cho-ninhthuan",
        "Buffer Đối thủ": "/api/ninhthuan/buffer-doithu-ninhthuan",
        "Buffer Trường": "/api/ninhthuan/buffer-truong-ninhthuan",
        "Buffer Giao thông": "/api/ninhthuan/buffer-giaothong-ninhthuan",
        "Buffer Ranh giới / MDDS": "/api/ninhthuan/buffer-ranhgioi-ninhthuan",
      },
      ahp: {
        criteria: "/api/ahp/criteria",
        calc: "/api/ahp/calc (POST)",
        save: "/api/ahp/save (POST)",
        latest: "/api/ahp/latest",
      },
      admin: {
        login: "/api/admin/login (POST)",
        me: "/api/admin/me (GET - Bearer)",
        bhx: "/api/admin/bhx",
        cho: "/api/admin/cho",
        truong: "/api/admin/truong",
        doithu: "/api/admin/doithu",
        giaothong: "/api/admin/giaothong",
      },
    },
  });
});

// ================= 404 Handler =================
app.use((req, res) => {
  res.status(404).json({
    error: `🔍 Không tìm thấy API: ${req.originalUrl}`,
    hint:
      "Nếu bạn đang gọi từ FRONTEND, hãy chắc chắn frontend gọi đúng domain BACKEND (REACT_APP_API_URL).",
  });
});

// ================= Global Error Handler =================
app.use((err, req, res, _next) => {
  console.error("❌ Server error:", err?.message || err);
  res.status(500).json({
    error: "❌ Server error",
    message: err?.message || "Unknown error",
    path: req.originalUrl,
  });
});

// ================= Start Server =================
const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, async () => {
  console.log(`🚀 Backend Ninh Thuận đang chạy tại: http://localhost:${PORT}`);

  // Test DB connect lúc start
  try {
    if (typeof db.testDbConnection === "function") {
      await db.testDbConnection();
    } else {
      // fallback nếu db.js không có testDbConnection
      await db.query("SELECT 1");
    }
    console.log("✅ DB connection: OK");
  } catch (e) {
    console.error("❌ DB test on start failed:", e?.message || e);
  }

  console.log("📌 Health check: /_health");
});

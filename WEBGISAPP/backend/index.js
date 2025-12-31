// backend/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");

const db = require("./db"); // ✅ đồng nhất theo backend/db.js

const app = express();

// Render / reverse proxy
app.set("trust proxy", 1);

// ================= Middleware =================
const FRONTEND_URL = (process.env.FRONTEND_URL || "").trim();

/**
 * CORS:
 * - Nếu bạn set FRONTEND_URL (vd: https://your-frontend.netlify.app) => chỉ cho domain đó
 * - Nếu chưa set => cho phép tất cả (để dev/test)
 */
app.use(
  cors({
    origin: FRONTEND_URL ? [FRONTEND_URL] : true,
    credentials: true,
  })
);

app.use(express.json({ limit: "20mb" }));
app.use(compression());

// Log request
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Fix lỗi favicon.ico
app.get("/favicon.ico", (_req, res) => res.status(204).end());

// Health check (Render)
app.get("/_health", async (_req, res) => {
  try {
    const r = await db.query("SELECT 1 AS ok");
    res.json({ ok: true, db: r.rows?.[0]?.ok === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "DB error" });
  }
});

// ================= Routes =================
// ✅ API cho Ninh Thuận
const ninhthuanRoutes = require("./routes/ninhthuan");
app.use("/api/ninhthuan", ninhthuanRoutes);

// ✅ API AHP (criteria / calc / save / latest)
const ahpRoutes = require("./routes/ahpRoutes");
app.use("/api/ahp", ahpRoutes);

// ✅ API Admin (login + CRUD 5 lớp)
const adminRoutes = require("./routes/adminRoutes");
app.use("/api/admin", adminRoutes);

// ================= Root test =================
app.get("/", (_req, res) => {
  res.json({
    status: "✅ WebGIS Backend Ninh Thuận đang hoạt động",
    api_available: {
      // ================= NINH THUẬN =================
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

      // ================= AHP =================
      ahp: {
        "Danh sách tiêu chí (DB ahp_criteria)": "/api/ahp/criteria",
        "Tính AHP (λmax, CI, CR, weights)": "/api/ahp/calc (POST)",
        "Lưu trọng số theo session (DB ahp_weights)": "/api/ahp/save (POST)",
        "Lấy session mới nhất": "/api/ahp/latest",
      },

      // ================= ADMIN =================
      admin: {
        "Đăng nhập": "/api/admin/login (POST)",
        "Thông tin admin": "/api/admin/me (GET - Bearer)",
        "CRUD lớp BHX": "/api/admin/bhx (GET/POST), /api/admin/bhx/:id (GET/PUT/DELETE)",
        "CRUD lớp Chợ": "/api/admin/cho (GET/POST), /api/admin/cho/:id (GET/PUT/DELETE)",
        "CRUD lớp Trường": "/api/admin/truong (GET/POST), /api/admin/truong/:id (GET/PUT/DELETE)",
        "CRUD lớp Đối thủ": "/api/admin/doithu (GET/POST), /api/admin/doithu/:id (GET/PUT/DELETE)",
        "CRUD lớp Giao thông": "/api/admin/giaothong (GET/POST), /api/admin/giaothong/:id (GET/PUT/DELETE)",
      },
    },
    note: {
      ahp: {
        calc_body_example: {
          matrix: "number[][] (n×n) theo thang Saaty 1..9 và nghịch đảo",
          enforceSaaty: true,
          requireCR: false,
        },
        save_body_example: {
          session_id: "optional (nếu không có sẽ tự sinh)",
          weights: "number[] (độ dài = số tiêu chí trong ahp_criteria)",
        },
      },
      admin: {
        login_body_example: { username: "quiloc", password: "1234" },
        bearer: "Authorization: Bearer <token>",
      },
    },
  });
});

// ================= 404 Handler =================
app.use((req, res) => {
  res.status(404).json({
    error: `🔍 Không tìm thấy API: ${req.originalUrl}`,
  });
});

// ================= Start Server =================
const PORT = Number(process.env.PORT || 5000);

app.listen(PORT, async () => {
  console.log(`🚀 Backend Ninh Thuận đang chạy tại: http://localhost:${PORT}`);

  // ✅ Test DB connect lúc start (rất cần khi deploy Render/Neon)
  try {
    await db.testDbConnection();
  } catch (e) {
    console.error("❌ DB test on start failed:", e?.message || e);
  }

  console.log("📌 Các API lớp hiện trạng:");
  console.log(`👉 /api/ninhthuan/bhx-ninhthuan`);
  console.log(`👉 /api/ninhthuan/cho-ninhthuan`);
  console.log(`👉 /api/ninhthuan/doithu-ninhthuan`);
  console.log(`👉 /api/ninhthuan/truong-ninhthuan`);
  console.log(`👉 /api/ninhthuan/giaothong-ninhthuan`);
  console.log(`👉 /api/ninhthuan/ranhgioi-ninhthuan`);

  console.log("📌 Các API bản đồ vị trí & buffer AHP:");
  console.log(`👉 /api/ninhthuan/bandovitri-ninhthuan`);
  console.log(`👉 /api/ninhthuan/buffer-bhx-ninhthuan`);
  console.log(`👉 /api/ninhthuan/buffer-cho-ninhthuan`);
  console.log(`👉 /api/ninhthuan/buffer-doithu-ninhthuan`);
  console.log(`👉 /api/ninhthuan/buffer-truong-ninhthuan`);
  console.log(`👉 /api/ninhthuan/buffer-giaothong-ninhthuan`);
  console.log(`👉 /api/ninhthuan/buffer-ranhgioi-ninhthuan`);

  console.log("📌 Các API AHP:");
  console.log(`👉 GET  /api/ahp/criteria`);
  console.log(`👉 POST /api/ahp/calc`);
  console.log(`👉 POST /api/ahp/save`);
  console.log(`👉 GET  /api/ahp/latest`);

  console.log("📌 Các API Admin:");
  console.log(`👉 POST /api/admin/login`);
  console.log(`👉 GET  /api/admin/me`);
  console.log(`👉 CRUD /api/admin/bhx`);
  console.log(`👉 CRUD /api/admin/cho`);
  console.log(`👉 CRUD /api/admin/truong`);
  console.log(`👉 CRUD /api/admin/doithu`);
  console.log(`👉 CRUD /api/admin/giaothong`);

  console.log("📌 Health check:");
  console.log(`👉 /_health`);
});

// WEBGISAPP/backend/db.js
// =====================================================
// PostgreSQL Pool (Local + Neon + Render)
// - Ưu tiên DATABASE_URL (chuẩn khi deploy)
// - Nếu không có DATABASE_URL thì dùng DB_HOST/DB_USER/...
// - Tự bật SSL cho Neon/Render
// - Export: pool, query, testDbConnection
// =====================================================

require("dotenv").config();
const { Pool } = require("pg");

// parse boolean env: "true/1/yes/y" => true
function toBool(v) {
  if (typeof v === "boolean") return v;
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

const DATABASE_URL = (process.env.DATABASE_URL || "").trim();

// Neon/Render thường bắt SSL.
// Nếu bạn muốn tắt SSL ở local: DB_SSL=false
// Nếu có DATABASE_URL thì mặc định bật SSL (đúng khi deploy).
const useSSL = DATABASE_URL ? true : toBool(process.env.DB_SSL);

// config pool
const poolConfig = DATABASE_URL
  ? {
      connectionString: DATABASE_URL,
      ssl: useSSL ? { rejectUnauthorized: false } : undefined,
      keepAlive: true,
      // tăng ổn định khi Render/Neon có lúc "ngủ"
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 30000),
      connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT || 10000),
    }
  : {
      host: (process.env.DB_HOST || "").trim(),
      user: (process.env.DB_USER || "").trim(),
      password: process.env.DB_PASSWORD || "",
      database: (process.env.DB_NAME || "").trim(),
      port: Number(process.env.DB_PORT || 5432),
      ssl: useSSL ? { rejectUnauthorized: false } : undefined,
      keepAlive: true,
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 30000),
      connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT || 10000),
    };

const pool = new Pool(poolConfig);

// log lỗi pool (giúp debug deploy)
pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error:", err?.message || err);
});

// query helper (để các controller dùng db.query)
function query(text, params) {
  return pool.query(text, params);
}

// test kết nối DB (gọi trong index.js khi start server)
async function testDbConnection() {
  try {
    const res = await pool.query("SELECT NOW() AS now");
    console.log("✅ DB connected:", res.rows?.[0]?.now);
    console.log(
      `✅ DB mode: ${DATABASE_URL ? "DATABASE_URL" : "HOST/USER/DB"} | SSL: ${
        useSSL ? "ON" : "OFF"
      }`
    );
    return true;
  } catch (err) {
    console.error("❌ DB connection failed:", err?.message || err);

    // In thêm gợi ý nếu hay gặp ENOTFOUND HOST
    if (String(err?.message || "").includes("ENOTFOUND")) {
      console.error(
        "👉 Gợi ý: Render chưa có DATABASE_URL đúng hoặc bạn đang để DB_HOST='HOST' (placeholder). Hãy set DATABASE_URL trên Render rồi Save, rebuild, deploy."
      );
    }
    return false;
  }
}

module.exports = {
  pool,
  query,
  testDbConnection,
};

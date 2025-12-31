// backend/db.js
// ===============================================
// ✅ PostgreSQL Pool (Local + Neon + Render)
// ✅ Hỗ trợ 2 cách cấu hình:
//    1) DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
//    2) DATABASE_URL (nếu bạn muốn dùng connection string)
// ✅ Neon bắt SSL -> tự bật SSL khi DB_SSL=true hoặc có DATABASE_URL
// ===============================================

require("dotenv").config();
const { Pool } = require("pg");

// Ép kiểu boolean từ env (DB_SSL=true/false)
function toBool(v) {
  if (typeof v === "boolean") return v;
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

const DATABASE_URL = process.env.DATABASE_URL;

// Neon/Render thường cần SSL
const useSSL = toBool(process.env.DB_SSL) || Boolean(DATABASE_URL);

// Tạo Pool (ưu tiên DATABASE_URL nếu có)
const pool = new Pool(
  DATABASE_URL
    ? {
        connectionString: DATABASE_URL,
        ssl: useSSL ? { rejectUnauthorized: false } : undefined,
        keepAlive: true,
      }
    : {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT || 5432),
        ssl: useSSL ? { rejectUnauthorized: false } : undefined,
        keepAlive: true,
      }
);

// Log lỗi pool (đỡ bị “im lặng” khi deploy)
pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error:", err?.message || err);
});

// Test nhanh kết nối DB (gọi trong index.js khi start server)
async function testDbConnection() {
  try {
    const res = await pool.query("SELECT NOW() AS now");
    console.log("✅ DB connected:", res.rows?.[0]?.now);
    return true;
  } catch (err) {
    console.error("❌ DB connection failed:", err?.message || err);
    return false;
  }
}

// Export đồng nhất
module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  testDbConnection,
};

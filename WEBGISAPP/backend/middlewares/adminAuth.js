// backend/middlewares/adminAuth.js
const jwt = require("jsonwebtoken");

function extractToken(req) {
  // 1) Authorization: Bearer <token>
  const auth = req.headers?.authorization || req.headers?.Authorization || "";
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }

  // 2) Một số client hay gửi dạng header khác
  const xToken = req.headers?.["x-access-token"];
  if (typeof xToken === "string" && xToken.trim()) return xToken.trim();

  const tokenHeader = req.headers?.token;
  if (typeof tokenHeader === "string" && tokenHeader.trim()) return tokenHeader.trim();

  // 3) fallback: query (chỉ nên dùng khi test, không khuyến khích)
  const q = req.query?.token;
  if (typeof q === "string" && q.trim()) return q.trim();

  return null;
}

module.exports = function adminAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        error: "Thiếu token",
        hint: "Gửi header Authorization: Bearer <token>",
      });
    }

    const secret = process.env.JWT_SECRET || "dev_secret_change_me";

    // Nếu bạn muốn siết chặt hơn khi deploy, có thể set thêm:
    // JWT_ISSUER, JWT_AUDIENCE (không bắt buộc)
    const verifyOptions = {};
    if (process.env.JWT_ISSUER) verifyOptions.issuer = process.env.JWT_ISSUER;
    if (process.env.JWT_AUDIENCE) verifyOptions.audience = process.env.JWT_AUDIENCE;

    const payload = jwt.verify(token, secret, verifyOptions);

    // payload kỳ vọng: { id, username, role, iat, exp }
    if (!payload || !payload.id || !payload.username) {
      return res.status(401).json({ error: "Token không đúng định dạng" });
    }

    req.admin = {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      iat: payload.iat,
      exp: payload.exp,
    };

    return next();
  } catch (e) {
    const msg =
      e?.name === "TokenExpiredError"
        ? "Token đã hết hạn"
        : "Token không hợp lệ";

    return res.status(401).json({
      error: msg,
    });
  }
};

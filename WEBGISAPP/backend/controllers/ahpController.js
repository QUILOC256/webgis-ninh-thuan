// backend/controllers/ahpController.js
const db = require("../db");
const crypto = require("crypto");

/**
 * Saaty RI (Random Index) chuẩn theo n
 */
const RI_TABLE = {
  1: 0.0,
  2: 0.0,
  3: 0.58,
  4: 0.90,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
};

/**
 * Thang đo Saaty 1..9 và nghịch đảo
 */
const SAATY_ALLOWED = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9,
  1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 6, 1 / 7, 1 / 8, 1 / 9,
]);

function isFiniteNumber(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function round6(x) {
  return Math.round(x * 1e6) / 1e6;
}

function genSessionId() {
  // session_id varchar(50) -> tạo gọn: yyyymmddHHMMSS + random
  const t = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp =
    `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}` +
    `${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}`;
  const rnd = crypto.randomBytes(4).toString("hex"); // 8 ký tự
  return `S${stamp}_${rnd}`;
}

async function getCriteriaFromDB(client) {
  // nếu có client (transaction) thì dùng client.query
  if (client) {
    const { rows } = await client.query(
      `SELECT id, code, name, description
       FROM public.ahp_criteria
       ORDER BY id ASC`
    );
    return rows;
  }

  // còn lại dùng db.query
  const { rows } = await db.query(
    `SELECT id, code, name, description
     FROM public.ahp_criteria
     ORDER BY id ASC`
  );
  return rows;
}

/**
 * Validate ma trận AHP:
 * - n x n
 * - đường chéo = 1
 * - a_ij > 0
 * - reciprocal: a_ij * a_ji = 1 (sai số)
 * - (tuỳ chọn) kiểm theo thang Saaty (1..9 và nghịch đảo)
 */
function validateMatrix(matrix, { enforceSaaty = true } = {}) {
  if (!Array.isArray(matrix) || matrix.length < 1) return "Matrix rỗng";
  const n = matrix.length;

  for (let i = 0; i < n; i++) {
    if (!Array.isArray(matrix[i]) || matrix[i].length !== n)
      return "Matrix phải là n×n";

    for (let j = 0; j < n; j++) {
      const v = matrix[i][j];
      if (!isFiniteNumber(v) || v <= 0) return "Mọi phần tử phải là số > 0";
      if (enforceSaaty && !SAATY_ALLOWED.has(v)) {
        return "Giá trị chỉ được theo thang Saaty 1–9 (và nghịch đảo 1/2..1/9)";
      }
    }

    if (Math.abs(matrix[i][i] - 1) > 1e-9) return "Đường chéo chính phải = 1";
  }

  // reciprocal check
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const prod = matrix[i][j] * matrix[j][i];
      if (Math.abs(prod - 1) > 1e-3) {
        return "Matrix phải có a_ji = 1 / a_ij (tính đối xứng nghịch đảo)";
      }
    }
  }
  return null;
}

function normalizeByColumns(A) {
  const n = A.length;
  const colSums = Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += A[i][j];
    colSums[j] = s;
  }

  const N = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      N[i][j] = colSums[j] === 0 ? 0 : A[i][j] / colSums[j];
    }
  }
  return N;
}

function weightsByRowAverage(N) {
  const n = N.length;
  const w = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += N[i][j];
    w[i] = s / n;
  }
  const sum = w.reduce((a, b) => a + b, 0);
  return sum === 0 ? w : w.map((x) => x / sum);
}

function matVec(A, w) {
  const n = A.length;
  const out = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += A[i][j] * w[j];
    out[i] = s;
  }
  return out;
}

function lambdaMax(A, w) {
  const n = A.length;
  const Aw = matVec(A, w);
  let sum = 0;
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    if (w[i] > 0) {
      sum += Aw[i] / w[i];
      cnt++;
    }
  }
  return cnt === 0 ? 0 : sum / cnt;
}

/**
 * GET /api/ahp/criteria
 * trả danh sách tiêu chí lớn để frontend render đúng thứ tự
 */
exports.getCriteria = async (req, res) => {
  try {
    const rows = await getCriteriaFromDB();
    return res.json({ criteria: rows });
  } catch (e) {
    console.error("getCriteria error:", e);
    return res.status(500).json({ error: "Lỗi lấy danh sách tiêu chí" });
  }
};

/**
 * POST /api/ahp/calc
 */
exports.calcAHP = async (req, res) => {
  try {
    const { matrix, enforceSaaty = true, requireCR = false } = req.body || {};

    // Lấy tiêu chí từ DB để đồng nhất số lượng & thứ tự
    const criteria = await getCriteriaFromDB();
    const n = criteria.length;

    if (!Array.isArray(matrix) || matrix.length !== n) {
      return res.status(400).json({
        error: `Matrix phải có kích thước ${n}×${n} theo bảng ahp_criteria`,
      });
    }

    const err = validateMatrix(matrix, { enforceSaaty });
    if (err) return res.status(400).json({ error: err });

    const N = normalizeByColumns(matrix);
    const weights = weightsByRowAverage(N);
    const lam = lambdaMax(matrix, weights);

    const CI = n <= 2 ? 0 : (lam - n) / (n - 1);
    const RI = RI_TABLE[n] ?? null;
    const CR = !RI || RI === 0 ? 0 : CI / RI;

    if (requireCR && CR >= 0.1) {
      return res.status(400).json({
        error: `CR = ${(CR * 100).toFixed(2)}% không đạt yêu cầu < 10%`,
        lambda_max: round6(lam),
        CI: round6(CI),
        CR: round6(CR),
        RI,
      });
    }

    const items = criteria.map((c, idx) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      description: c.description,
      weight: round6(weights[idx]),
    }));

    return res.json({
      n,
      lambda_max: round6(lam),
      CI: round6(CI),
      CR: round6(CR),
      RI,
      weights: weights.map(round6),
      items,
      ok: CR < 0.1,
    });
  } catch (e) {
    console.error("calcAHP error:", e);
    return res.status(500).json({ error: "Lỗi server khi tính AHP" });
  }
};

/**
 * POST /api/ahp/save
 * Lưu vào public.ahp_weights(session_id, criterion_id, weight)
 */
exports.saveWeights = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { weights, session_id } = req.body || {};
    const criteria = await getCriteriaFromDB(client);
    const n = criteria.length;

    if (!Array.isArray(weights) || weights.length !== n) {
      return res.status(400).json({
        error: `weights phải là mảng độ dài ${n} theo ahp_criteria`,
      });
    }
    for (const w of weights) {
      if (!isFiniteNumber(w) || w < 0) {
        return res.status(400).json({ error: "Mỗi weight phải là số >= 0" });
      }
    }

    const sid = (session_id && String(session_id).trim()) || genSessionId();

    await client.query("BEGIN");

    // (tuỳ chọn) nếu muốn 1 session chỉ lưu 1 lần thì mở comment:
    // await client.query("DELETE FROM public.ahp_weights WHERE session_id=$1", [sid]);

    const insertSQL = `
      INSERT INTO public.ahp_weights(session_id, criterion_id, weight)
      VALUES ($1, $2, $3)
      RETURNING id, session_id, criterion_id, weight, created_at
    `;

    const inserted = [];
    for (let i = 0; i < n; i++) {
      const c = criteria[i];
      const w = weights[i];
      const r = await client.query(insertSQL, [sid, c.id, w]);
      inserted.push(r.rows[0]);
    }

    await client.query("COMMIT");

    return res.json({
      ok: true,
      session_id: sid,
      saved: inserted.length,
      rows: inserted,
    });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("saveWeights error:", e);
    return res.status(500).json({ error: "Lỗi lưu trọng số AHP" });
  } finally {
    client.release();
  }
};

/**
 * GET /api/ahp/latest
 * Lấy session_id mới nhất + weights theo thứ tự ahp_criteria
 */
exports.getLatestSession = async (req, res) => {
  try {
    const criteria = await getCriteriaFromDB();

    const latest = await db.query(`
      SELECT session_id
      FROM public.ahp_weights
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `);

    if (!latest.rows.length) {
      return res.json({ ok: true, session_id: null, items: [] });
    }

    const sid = latest.rows[0].session_id;

    const wRows = await db.query(
      `SELECT criterion_id, weight, created_at
       FROM public.ahp_weights
       WHERE session_id = $1`,
      [sid]
    );

    const mapW = new Map(
      wRows.rows.map((r) => [r.criterion_id, Number(r.weight)])
    );

    const items = criteria.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      weight: round6(mapW.get(c.id) ?? 0),
    }));

    return res.json({ ok: true, session_id: sid, items });
  } catch (e) {
    console.error("getLatestSession error:", e);
    return res.status(500).json({ error: "Lỗi lấy session AHP mới nhất" });
  }
};

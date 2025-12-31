// backend/controllers/adminController.js
const db = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

/* =========================
   JWT helpers
   ========================= */
function isBcryptHash(s) {
  return typeof s === "string" && /^\$2[aby]\$/.test(s);
}

function signToken(user) {
  const secret = process.env.JWT_SECRET || "dev_secret_change_me";
  const expiresIn = process.env.JWT_EXPIRES || "7d";
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    secret,
    { expiresIn }
  );
}

/* =========================
   Geo helpers (ĐỒNG NHẤT với ninhthuanController)
   ========================= */
const geomWGS84Default = `
  CASE 
    WHEN ST_SRID(geom) = 0 THEN ST_SetSRID(geom, 4326)
    ELSE ST_Transform(geom, 4326)
  END
`;

const fcSql = (table, props, geomExpr = geomWGS84Default) => `
  SELECT jsonb_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'properties', jsonb_build_object(${props}),
        'geometry', ST_AsGeoJSON(${geomExpr})::jsonb
      )
    ), '[]'::jsonb)
  ) AS geojson
  FROM ${table}
  WHERE geom IS NOT NULL;
`;

const featureByIdSql = (table, idCol, props, geomExpr = geomWGS84Default) => `
  SELECT jsonb_build_object(
    'type', 'Feature',
    'properties', jsonb_build_object(${props}),
    'geometry', ST_AsGeoJSON(${geomExpr})::jsonb
  ) AS geojson
  FROM ${table}
  WHERE ${idCol} = $1
  LIMIT 1;
`;

/* =========================
   CONFIG bảng theo đúng CSDL bạn
   - table: đúng tên bảng
   - idCol: PK (bạn đang dùng gid)
   - mode:
      - point_latlong: CRUD theo lat/long và cập nhật geom
      - line_geojson: CRUD line theo geometry GeoJSON
   - fields: whitelist cột được phép ghi
   ========================= */
const LAYERS = {
  bhx: {
    table: "public.bachhoaxanhninhthuan",
    idCol: "gid",
    mode: "point_latlong",
    fields: [
      "id",
      "ten_bach_h",
      "dia_chi",
      "dia_chi_1",
      `"xa/phuong"`,
      "huyen",
      "tinh",
      "trang_thai",
      "quy_mo",
      "radius_m",
      "lat",
      "long",
    ],
    props: `
      'gid', gid,
      'id', id,
      'name', ten_bach_h,
      'ten_bach_h', ten_bach_h,
      'dia_chi', dia_chi,
      'dia_chi_1', dia_chi_1,
      'xa_phuong', "xa/phuong",
      'huyen', huyen,
      'tinh', tinh,
      'trang_thai', trang_thai,
      'quy_mo', quy_mo,
      'radius_m', radius_m,
      'lat', lat,
      'long', long
    `,
  },

  cho: {
    table: "public.choninhthuan",
    idCol: "gid",
    mode: "point_latlong",
    fields: [
      "id",
      "ten_cho",
      "dia_chi",
      "huyen",
      "loai",
      "quy_mo",
      "radius_m",
      "lat",
      "long",
    ],
    props: `
      'gid', gid,
      'id', id,
      'ten_cho', ten_cho,
      'dia_chi', dia_chi,
      'huyen', huyen,
      'loai', loai,
      'quy_mo', quy_mo,
      'radius_m', radius_m,
      'lat', lat,
      'long', long
    `,
  },

  truong: {
    table: "public.truongninhthuan",
    idCol: "gid",
    mode: "point_latlong",
    fields: [
      "id",
      "ten_truong",
      "dia_chi",
      "dia_chi_1",
      "huyen",
      "loai_truon",
      "cap_do",
      "quy_mo",
      "radius_m",
      "lat",
      "long",
    ],
    props: `
      'gid', gid,
      'id', id,
      'ten_truong', ten_truong,
      'dia_chi', dia_chi,
      'dia_chi_1', dia_chi_1,
      'huyen', huyen,
      'loai_truon', loai_truon,
      'cap_do', cap_do,
      'quy_mo', quy_mo,
      'radius_m', radius_m,
      'lat', lat,
      'long', long
    `,
  },

  doithu: {
    table: "public.doithucanhtranhninhthuan",
    idCol: "gid",
    mode: "point_latlong",
    fields: [
      "id",
      "ten",
      "dia_chi",
      `"huyen/than"`,
      "loai_hinh",
      "quy_mo",
      "radius_m",
      "doi_thu_ch",
      "lat",
      "long",
    ],
    props: `
      'gid', gid,
      'id', id,
      'ten', ten,
      'dia_chi', dia_chi,
      'huyen_than', "huyen/than",
      'loai_hinh', loai_hinh,
      'quy_mo', quy_mo,
      'radius_m', radius_m,
      'doi_thu_ch', doi_thu_ch,
      'lat', lat,
      'long', long
    `,
  },

  giaothong: {
    table: "public.giaothongninhthuan1",
    idCol: "gid",
    mode: "line_geojson",
    fields: ["id", "ten", "tc_duong", "chieudai", "chieurong", "capduong"],
    props: `
      'gid', gid,
      'id', id,
      'ten', ten,
      'tc_duong', tc_duong,
      'chieudai', chieudai,
      'chieurong', chieurong,
      'capduong', capduong
    `,
  },
};

function getCfg(layerKey) {
  const cfg = LAYERS[layerKey];
  if (!cfg) {
    const err = new Error("Layer không hợp lệ");
    err.status = 400;
    throw err;
  }
  return cfg;
}

/* =========================
   AUTH
   ========================= */
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Thiếu username/password" });
    }

    const q = `
      SELECT id, username, password_hash, full_name, role
      FROM public.admin_users
      WHERE username = $1
      LIMIT 1
    `;
    const r = await db.query(q, [String(username).trim()]);
    if (!r.rows.length) return res.status(401).json({ error: "Sai tài khoản" });

    const u = r.rows[0];
    const dbPass = u.password_hash || "";

    let ok = false;
    if (isBcryptHash(dbPass)) ok = await bcrypt.compare(String(password), dbPass);
    else ok = String(password) === String(dbPass);

    if (!ok) return res.status(401).json({ error: "Sai mật khẩu" });

    const token = signToken(u);
    return res.json({
      token,
      admin: {
        id: u.id,
        username: u.username,
        full_name: u.full_name,
        role: u.role,
      },
    });
  } catch (e) {
    console.error("admin login error:", e);
    return res.status(500).json({ error: "Không thể đăng nhập" });
  }
};

exports.me = async (req, res) => {
  return res.json({ admin: req.admin || null });
};

/* =========================
   LIST (GeoJSON)
   GET /api/admin/:layer
   ========================= */
exports.list = async (req, res) => {
  try {
    const layerKey = req.params.layer;
    const cfg = getCfg(layerKey);

    const sql = fcSql(cfg.table, cfg.props);
    const { rows } = await db.query(sql);
    return res.json(
      rows[0]?.geojson ?? { type: "FeatureCollection", features: [] }
    );
  } catch (e) {
    console.error("admin list error:", e);
    return res
      .status(e.status || 500)
      .json({ error: e.message || "List failed" });
  }
};

/* =========================
   GET ONE (GeoJSON Feature)
   GET /api/admin/:layer/:id
   ========================= */
exports.getOne = async (req, res) => {
  try {
    const layerKey = req.params.layer;
    const id = req.params.id;
    const cfg = getCfg(layerKey);

    const sql = featureByIdSql(cfg.table, cfg.idCol, cfg.props);
    const { rows } = await db.query(sql, [id]);

    if (!rows.length || !rows[0]?.geojson) {
      return res.status(404).json({ error: "Không tìm thấy" });
    }
    return res.json(rows[0].geojson);
  } catch (e) {
    console.error("admin getOne error:", e);
    return res
      .status(e.status || 500)
      .json({ error: e.message || "Get failed" });
  }
};

/* =========================
   CREATE
   POST /api/admin/:layer
   ========================= */
exports.create = async (req, res) => {
  try {
    const layerKey = req.params.layer;
    const cfg = getCfg(layerKey);
    const body = req.body || {};

    // whitelist field
    const data = {};
    for (const f of cfg.fields) {
      const cleanKey = f.replace(/"/g, "");
      if (body[cleanKey] !== undefined) data[f] = body[cleanKey];
      if (body[f] !== undefined) data[f] = body[f];
    }

    // build insert
    const cols = [];
    const vals = [];
    const params = [];

    let idx = 1;
    for (const [col, v] of Object.entries(data)) {
      cols.push(col);
      params.push(`$${idx++}`);
      vals.push(v);
    }

    // geometry
    if (cfg.mode === "point_latlong") {
      const lat = Number(body.lat);
      const lng = Number(body.long); // bạn dùng 'long'
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: "Thiếu/ sai lat,long" });
      }

      cols.push("geom");
      params.push(`ST_SetSRID(ST_MakePoint($${idx++}, $${idx++}), 4326)`);
      vals.push(lng, lat);
    } else if (cfg.mode === "line_geojson") {
      const geom = body.geometry;
      if (!geom) return res.status(400).json({ error: "Thiếu geometry (GeoJSON)" });

      cols.push("geom");
      params.push(`ST_SetSRID(ST_GeomFromGeoJSON($${idx++}), 4326)`);
      vals.push(JSON.stringify(geom));
    }

    const q = `
      INSERT INTO ${cfg.table} (${cols.join(", ")})
      VALUES (${params.join(", ")})
      RETURNING ${cfg.idCol} AS id
    `;
    const r = await db.query(q, vals);

    return res.json({ ok: true, id: r.rows[0]?.id });
  } catch (e) {
    console.error("admin create error:", e);
    return res
      .status(e.status || 500)
      .json({ error: e.message || "Create failed" });
  }
};

/* =========================
   UPDATE
   PUT /api/admin/:layer/:id
   ========================= */
exports.update = async (req, res) => {
  try {
    const layerKey = req.params.layer;
    const id = req.params.id;
    const cfg = getCfg(layerKey);
    const body = req.body || {};

    const sets = [];
    const vals = [];
    let idx = 1;

    // update fields
    for (const f of cfg.fields) {
      const cleanKey = f.replace(/"/g, "");
      const v =
        body[f] !== undefined
          ? body[f]
          : body[cleanKey] !== undefined
          ? body[cleanKey]
          : undefined;

      if (v !== undefined) {
        sets.push(`${f} = $${idx++}`);
        vals.push(v);
      }
    }

    // update geom
    if (cfg.mode === "point_latlong" && (body.lat !== undefined || body.long !== undefined)) {
      const lat = Number(body.lat);
      const lng = Number(body.long);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: "Sai lat,long" });
      }
      sets.push(`geom = ST_SetSRID(ST_MakePoint($${idx++}, $${idx++}), 4326)`);
      vals.push(lng, lat);
    }

    if (cfg.mode === "line_geojson" && body.geometry) {
      sets.push(`geom = ST_SetSRID(ST_GeomFromGeoJSON($${idx++}), 4326)`);
      vals.push(JSON.stringify(body.geometry));
    }

    if (!sets.length)
      return res.status(400).json({ error: "Không có dữ liệu để cập nhật" });

    vals.push(id);
    const q = `
      UPDATE ${cfg.table}
      SET ${sets.join(", ")}
      WHERE ${cfg.idCol} = $${idx}
      RETURNING ${cfg.idCol} AS id
    `;
    const r = await db.query(q, vals);
    if (!r.rows.length) return res.status(404).json({ error: "Không tìm thấy" });

    return res.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    console.error("admin update error:", e);
    return res
      .status(e.status || 500)
      .json({ error: e.message || "Update failed" });
  }
};

/* =========================
   DELETE
   DELETE /api/admin/:layer/:id
   ========================= */
exports.remove = async (req, res) => {
  try {
    const layerKey = req.params.layer;
    const id = req.params.id;
    const cfg = getCfg(layerKey);

    const q = `
      DELETE FROM ${cfg.table}
      WHERE ${cfg.idCol} = $1
      RETURNING ${cfg.idCol} AS id
    `;
    const r = await db.query(q, [id]);
    if (!r.rows.length) return res.status(404).json({ error: "Không tìm thấy" });

    return res.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    console.error("admin delete error:", e);
    return res
      .status(e.status || 500)
      .json({ error: e.message || "Delete failed" });
  }
};

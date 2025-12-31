// backend/controllers/ninhthuanController.js
const db = require("../db");

/* ==================== HÀM DÙNG CHUNG TẠO GEOJSON ==================== */

/**
 * geomWGS84Default:
 *  - Dùng cho các bảng đã ở WGS84 (4326) hoặc SRID = 0 nhưng toạ độ kinh vĩ.
 * geomFrom32649:
 *  - Dùng cho các bảng AHP/buffer đang ở UTM 32649 (đơn vị mét),
 *    thường SRID = 0, cần set SRID 32649 rồi transform sang 4326.
 */
const geomWGS84Default = `
  CASE
    WHEN geom IS NULL THEN NULL
    WHEN ST_SRID(geom) = 0 THEN ST_SetSRID(geom, 4326)
    WHEN ST_SRID(geom) = 4326 THEN geom
    ELSE ST_Transform(geom, 4326)
  END
`;

const geomFrom32649 = `
  CASE
    WHEN geom IS NULL THEN NULL
    WHEN ST_SRID(geom) = 0 THEN ST_Transform(ST_SetSRID(geom, 32649), 4326)
    WHEN ST_SRID(geom) = 32649 THEN ST_Transform(geom, 4326)
    WHEN ST_SRID(geom) = 4326 THEN geom
    ELSE ST_Transform(geom, 4326)
  END
`;

// FeatureCollection cho POINT
const fcPointSql = (table, props, geomExpr = geomWGS84Default) => `
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

// FeatureCollection cho LINESTRING
const fcLineSql = (table, props, geomExpr = geomWGS84Default) => `
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

// FeatureCollection cho POLYGON
const fcPolygonSql = (table, props, geomExpr = geomWGS84Default) => `
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

/* =========================== BHX – NINH THUẬN =========================== */

const bhxProps = `
  'gid', gid,
  'id', id,
  'name', ten_bach_h,
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
`;

exports.getBHXNinhThuan = async (_req, res) => {
  try {
    const sql = fcPointSql("public.bachhoaxanhninhthuan", bhxProps);
    const { rows } = await db.query(sql);
    res.json(rows[0]?.geojson ?? { type: "FeatureCollection", features: [] });
  } catch (err) {
    console.error("❌ Lỗi API BHX Ninh Thuận:", err);
    res.status(500).json({ error: "Không thể lấy dữ liệu BHX Ninh Thuận" });
  }
};

/* =========================== CHỢ – NINH THUẬN =========================== */

const choProps = `
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
`;

exports.getChoNinhThuan = async (_req, res) => {
  try {
    const sql = fcPointSql("public.choninhthuan", choProps);
    const { rows } = await db.query(sql);
    res.json(rows[0]?.geojson ?? { type: "FeatureCollection", features: [] });
  } catch (err) {
    console.error("❌ Lỗi API Chợ Ninh Thuận:", err);
    res.status(500).json({ error: "Không thể lấy dữ liệu Chợ Ninh Thuận" });
  }
};

/* ==================== ĐỐI THỦ CẠNH TRANH – NINH THUẬN =================== */

const doithuProps = `
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
`;

exports.getDoiThuCanhTranhNinhThuan = async (_req, res) => {
  try {
    const sql = fcPointSql("public.doithucanhtranhninhthuan", doithuProps);
    const { rows } = await db.query(sql);
    res.json(rows[0]?.geojson ?? { type: "FeatureCollection", features: [] });
  } catch (err) {
    console.error("❌ Lỗi API Đối thủ cạnh tranh Ninh Thuận:", err);
    res.status(500).json({
      error: "Không thể lấy dữ liệu Đối thủ cạnh tranh Ninh Thuận",
    });
  }
};

/* =========================== TRƯỜNG HỌC – NINH THUẬN =========================== */

const truongProps = `
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
`;

exports.getTruongNinhThuan = async (_req, res) => {
  try {
    const sql = fcPointSql("public.truongninhthuan", truongProps);
    const { rows } = await db.query(sql);
    res.json(rows[0]?.geojson ?? { type: "FeatureCollection", features: [] });
  } catch (err) {
    console.error("❌ Lỗi API Trường học Ninh Thuận:", err);
    res.status(500).json({ error: "Không thể lấy dữ liệu Trường học Ninh Thuận" });
  }
};

/* =========================== GIAO THÔNG – NINH THUẬN =========================== */

const giaothongProps = `
  'gid', gid,
  'id', id,
  'ten', ten,
  'tc_duong', tc_duong,
  'chieudai', chieudai,
  'chieurong', chieurong,
  'capduong', capduong
`;

exports.getGiaoThongNinhThuan = async (_req, res) => {
  try {
    const sql = fcLineSql("public.giaothongninhthuan1", giaothongProps);
    const { rows } = await db.query(sql);
    res.json(rows[0]?.geojson ?? { type: "FeatureCollection", features: [] });
  } catch (err) {
    console.error("❌ Lỗi API Giao thông Ninh Thuận:", err);
    res.status(500).json({ error: "Không thể lấy dữ liệu Giao thông Ninh Thuận" });
  }
};

/* =========================== RANH GIỚI – NINH THUẬN =========================== */

const ranhgioiProps = `
  'gid', gid,
  'fid', fid,
  'id_0', id_0,
  'name_1', name_1,
  'name_2', name_2,
  'id_3', id_3,
  'name_3', name_3,
  'type_3', type_3,
  'dansontt_t', dansontt_t,
  'area', area,
  'perimeter', perimeter,
  'dientich_k', dientich_k,
  'mat_do', mat_do
`;

exports.getRanhGioiNinhThuan = async (_req, res) => {
  try {
    const sql = fcPolygonSql("public.ranhgioininhthuan", ranhgioiProps);
    const { rows } = await db.query(sql);
    res.json(rows[0]?.geojson ?? { type: "FeatureCollection", features: [] });
  } catch (err) {
    console.error("❌ Lỗi API Ranh giới Ninh Thuận:", err);
    res.status(500).json({ error: "Không thể lấy dữ liệu Ranh giới Ninh Thuận" });
  }
};

/* =======================================================================
   CÁC BẢNG BUFFER & BẢN ĐỒ VỊ TRÍ – TOẠ ĐỘ UTM 32649 → WGS84
   ======================================================================= */

/* =================== BẢN ĐỒ VỊ TRÍ (bandovitri) =================== */

const bandovitriProps = `
  'gid', gid,
  'objectid', objectid,
  'ketqua', ketqua,
  'shape_leng', shape_leng,
  'shape_area', shape_area
`;

exports.getBanDoViTriNinhThuan = async (_req, res) => {
  try {
    const sql = fcPolygonSql("public.bandovitri", bandovitriProps, geomFrom32649);
    const { rows } = await db.query(sql);
    res.json(rows[0]?.geojson ?? { type: "FeatureCollection", features: [] });
  } catch (err) {
    console.error("❌ Lỗi API Bản đồ vị trí Ninh Thuận:", err);
    res.status(500).json({ error: "Không thể lấy dữ liệu bản đồ vị trí" });
  }
};

/* =================== BUFFER BHX (buffer_bachhoaxanh) =================== */

const bufferBachHoaProps = `
  'gid', gid,
  'objectid', objectid,
  'bhx_num', bhx_num,
  'shape_leng', shape_leng,
  'shape_area', shape_area,
  'bhx_chuthi', bhx_chuthi
`;

exports.getBufferBachHoaXanhNinhThuan = async (_req, res) => {
  try {
    const sql = fcPolygonSql(
      "public.buffer_bachhoaxanh",
      bufferBachHoaProps,
      geomFrom32649
    );
    const { rows } = await db.query(sql);
    res.json(rows[0]?.geojson ?? { type: "FeatureCollection", features: [] });
  } catch (err) {
    console.error("❌ Lỗi API Buffer BHX Ninh Thuận:", err);
    res.status(500).json({ error: "Không thể lấy dữ liệu buffer BHX" });
  }
};

/* =================== BUFFER CHỢ (buffer_cho) =================== */

const bufferChoProps = `
  'gid', gid,
  'objectid', objectid,
  'cho_num', cho_num,
  'shape_leng', shape_leng,
  'shape_area', shape_area,
  'cho_chuthi', cho_chuthi
`;

exports.getBufferChoNinhThuan = async (_req, res) => {
  try {
    const sql = fcPolygonSql("public.buffer_cho", bufferChoProps, geomFrom32649);
    const { rows } = await db.query(sql);
    res.json(rows[0]?.geojson ?? { type: "FeatureCollection", features: [] });
  } catch (err) {
    console.error("❌ Lỗi API Buffer Chợ Ninh Thuận:", err);
    res.status(500).json({ error: "Không thể lấy dữ liệu buffer Chợ" });
  }
};

/* =================== BUFFER ĐỐI THỦ (buffer_doithu) =================== */

const bufferDoiThuProps = `
  'gid', gid,
  'objectid', objectid,
  'doithu_num', doithu_num,
  'shape_leng', shape_leng,
  'shape_area', shape_area,
  'doithu_chu', doithu_chu
`;

exports.getBufferDoiThuNinhThuan = async (_req, res) => {
  try {
    const sql = fcPolygonSql("public.buffer_doithu", bufferDoiThuProps, geomFrom32649);
    const { rows } = await db.query(sql);
    res.json(rows[0]?.geojson ?? { type: "FeatureCollection", features: [] });
  } catch (err) {
    console.error("❌ Lỗi API Buffer Đối thủ Ninh Thuận:", err);
    res.status(500).json({ error: "Không thể lấy dữ liệu buffer Đối thủ" });
  }
};

/* =================== BUFFER TRƯỜNG (buffer_truong) =================== */

const bufferTruongProps = `
  'gid', gid,
  'objectid', objectid,
  'truong_num', truong_num,
  'shape_leng', shape_leng,
  'shape_area', shape_area,
  'truong_chu', truong_chu
`;

exports.getBufferTruongNinhThuan = async (_req, res) => {
  try {
    const sql = fcPolygonSql("public.buffer_truong", bufferTruongProps, geomFrom32649);
    const { rows } = await db.query(sql);
    res.json(rows[0]?.geojson ?? { type: "FeatureCollection", features: [] });
  } catch (err) {
    console.error("❌ Lỗi API Buffer Trường Ninh Thuận:", err);
    res.status(500).json({ error: "Không thể lấy dữ liệu buffer Trường" });
  }
};

/* =================== ✅ BUFFER GIAO THÔNG (buffer_giaothong) =================== */

const bufferGiaothongProps = `
  'gid', gid,
  'objectid', objectid,
  'id', id,
  'ten', ten,
  'tc_duong', tc_duong,
  'chieudai', chieudai,
  'chieurong', chieurong,
  'capduong', capduong,
  'giaothong_num', giaothong_num,
  'buff_dist', buff_dist,
  'orig_fid', orig_fid,
  'shape_leng', shape_leng,
  'shape_area', shape_area,
  'gt_chuthic', gt_chuthic
`;

exports.getBufferGiaoThongNinhThuan = async (_req, res) => {
  try {
    const sql = fcPolygonSql(
      "public.buffer_giaothong",
      bufferGiaothongProps,
      geomFrom32649
    );
    const { rows } = await db.query(sql);
    res.json(rows[0]?.geojson ?? { type: "FeatureCollection", features: [] });
  } catch (err) {
    console.error("❌ Lỗi API Buffer Giao thông Ninh Thuận:", err);
    res.status(500).json({ error: "Không thể lấy dữ liệu buffer Giao thông" });
  }
};

/* =================== BUFFER RANH GIỚI (buffer_ranhgioi) =================== */

const bufferRanhgioiProps = `
  'gid', gid,
  'fid_1', fid_1,
  'name_1', name_1,
  'name_2', name_2,
  'name_3', name_3,
  'type_3', type_3,
  'dansontt_t', dansontt_t,
  'area', area,
  'perimeter', perimeter,
  'dientich_k', dientich_k,
  'mat_do', mat_do,
  'mdds_num', mdds_num,
  'mdds_chuth', mdds_chuth
`;

exports.getBufferRanhGioiNinhThuan = async (_req, res) => {
  try {
    const sql = fcPolygonSql(
      "public.buffer_ranhgioi",
      bufferRanhgioiProps,
      geomFrom32649
    );
    const { rows } = await db.query(sql);
    res.json(rows[0]?.geojson ?? { type: "FeatureCollection", features: [] });
  } catch (err) {
    console.error("❌ Lỗi API Buffer Ranh giới Ninh Thuận:", err);
    res.status(500).json({ error: "Không thể lấy dữ liệu buffer Ranh giới" });
  }
};

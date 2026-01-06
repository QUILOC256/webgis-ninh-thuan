// src/components/MapComponent.jsx
// =============================================================
// =============  MAP COMPONENT FULL FEATURE (AHP + SUGGEST) ====
// =============  ✅ FIX 404: luôn gọi API qua BASE URL ==========
// =============  ✅ BASE lấy từ REACT_APP_API_URL ===============
// =============  ✅ Fallback BASE cho Production nếu thiếu .env ==
// =============================================================

import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import html2canvas from "html2canvas";

// =============================================================
// ✅ API BASE (QUAN TRỌNG: fix lỗi 404 khi deploy static site)
// - Render Static Site / Netlify chỉ host FE, không có /api
// - Phải gọi sang domain BE (Render Web Service)
// =============================================================
const DEFAULT_PROD_API = "https://webgis-ninh-thuan.onrender.com";

const isBrowser = typeof window !== "undefined";
const isLocalhost =
  isBrowser && /localhost|127\.0\.0\.1/i.test(window.location.hostname);

// Lấy base từ env (CRA). Nếu không có env mà đang production => fallback DEFAULT_PROD_API
const RAW_BASE =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL)) ||
  (!isLocalhost ? DEFAULT_PROD_API : "");

// Chuẩn hóa base (bỏ / cuối)
const API_BASE = String(RAW_BASE).trim().replace(/\/+$/, "");

// Ghép base + path. Nếu path đã là URL tuyệt đối thì giữ nguyên.
const withBase = (path) => {
  const p = String(path || "").trim();
  if (!p) return p;
  if (/^https?:\/\//i.test(p)) return p;
  if (!API_BASE) return p; // dev local có proxy vẫn chạy
  return `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;
};

// =============================================================
// API Backend (để dạng path, lúc fetch sẽ withBase())
// =============================================================
const API = {
  bhx: "/api/ninhthuan/bhx-ninhthuan",
  cho: "/api/ninhthuan/cho-ninhthuan",
  doithu: "/api/ninhthuan/doithu-ninhthuan",
  truong: "/api/ninhthuan/truong-ninhthuan",
  giaothong: "/api/ninhthuan/giaothong-ninhthuan",

  ranhgioi: "/api/ninhthuan/ranhgioi-ninhthuan",
  bandovitri: "/api/ninhthuan/bandovitri-ninhthuan",

  buffer_bhx: "/api/ninhthuan/buffer-bhx-ninhthuan",
  buffer_cho: "/api/ninhthuan/buffer-cho-ninhthuan",
  buffer_truong: "/api/ninhthuan/buffer-truong-ninhthuan",
  buffer_doithu: "/api/ninhthuan/buffer-doithu-ninhthuan",
  buffer_giaothong: "/api/ninhthuan/buffer-giaothong-ninhthuan",
  buffer_ranhgioi: "/api/ninhthuan/buffer-ranhgioi-ninhthuan",
};

// =============================================================
// ✅ Layer labels
// =============================================================
const LAYER_META = {
  bhx: { label: "BHX", hint: "Cửa hàng BHX hiện hữu" },
  cho: { label: "Chợ", hint: "Điểm chợ" },
  doithu: { label: "Đối thủ", hint: "Cửa hàng đối thủ" },
  truong: { label: "Trường", hint: "Điểm trường học" },
  giaothong: { label: "Giao thông", hint: "Tuyến đường" },

  ranhgioi: { label: "Ranh giới", hint: "Ranh giới hành chính" },
  bandovitri: { label: "Bản đồ vị trí", hint: "Ô đánh giá tổng hợp (AHP)" },

  buffer_bhx: { label: "buffer_bhx", hint: "Vùng ảnh hưởng BHX" },
  buffer_cho: { label: "buffer_cho", hint: "Vùng ảnh hưởng chợ" },
  buffer_truong: { label: "buffer_truong", hint: "Vùng ảnh hưởng trường" },
  buffer_doithu: { label: "buffer_doithu", hint: "Vùng ảnh hưởng đối thủ" },
  buffer_giaothong: {
    label: "buffer_giaothong",
    hint: "Vùng ảnh hưởng giao thông",
  },
  buffer_ranhgioi: { label: "buffer_ranhgioi", hint: "Dân số / MDDS" },
};

const LAYER_ORDER = [
  "bhx",
  "cho",
  "doithu",
  "truong",
  "giaothong",
  "ranhgioi",
  "bandovitri",
  "buffer_bhx",
  "buffer_cho",
  "buffer_truong",
  "buffer_doithu",
  "buffer_giaothong",
  "buffer_ranhgioi",
];

// =============================================================
// ✅ Basemap config
// =============================================================
const BASEMAPS = {
  osm: {
    label: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
  },
  satellite: {
    label: "Nền vệ tinh (Esri)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri",
  },
};

// =============================================================
// Colors & layer groups
// =============================================================
const COLORS = {
  bhx: "#059669",
  cho: "#22c55e",
  doithu: "#f97316",
  truong: "#eab308",
  giaothong: "#4f46e5",
  ranhgioi: "#ef4444",

  bandovitri: "#16a34a",
  buffer_bhx: "#0d9488",
  buffer_cho: "#16a34a",
  buffer_doithu: "#f97316",
  buffer_truong: "#eab308",
  buffer_giaothong: "#4c1d95",
  buffer_ranhgioi: "#b91c1c",
};

const POINT_LAYERS = ["bhx", "cho", "doithu", "truong"];
const LINE_LAYERS = ["giaothong"];
const POLYGON_LAYERS = [
  "ranhgioi",
  "bandovitri",
  "buffer_bhx",
  "buffer_cho",
  "buffer_doithu",
  "buffer_truong",
  "buffer_giaothong",
  "buffer_ranhgioi",
];

// =============================================================
// UI style helpers
// =============================================================
const CARD_SHADOW = "0 10px 25px rgba(15, 23, 42, 0.18)";
const BORDER_SUBTLE = "1px solid #e2e8f0";
const ACCENT = "#16a34a";

const baseInputStyle = {
  width: "100%",
  padding: "6px 8px",
  marginTop: 4,
  borderRadius: 10,
  border: BORDER_SUBTLE,
  fontSize: 12,
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "#ffffff",
};

const smallInputStyle = {
  ...baseInputStyle,
  padding: "4px 6px",
  borderRadius: 8,
};

const primaryButtonStyle = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "none",
  background: ACCENT,
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(22,163,74,0.35)",
};

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: "#dcfce7",
  color: "#166534",
  border: `1px solid ${ACCENT}`,
  boxShadow: "none",
};

const highlightButtonStyle = {
  ...primaryButtonStyle,
  background: "#15803d",
  boxShadow: "0 4px 12px rgba(21,128,61,0.45)",
};

const ahpButtonStyle = {
  ...primaryButtonStyle,
  background: "#0f766e",
  boxShadow: "0 4px 12px rgba(15,118,110,0.35)",
};

const dangerButtonStyle = {
  ...primaryButtonStyle,
  background: "#b91c1c",
  boxShadow: "0 4px 12px rgba(185,28,28,0.35)",
};

// =============================================================
// Helpers
// =============================================================
const pick = (...vals) =>
  vals.find((v) => v !== undefined && v !== null && String(v).trim() !== "");

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const field = (label, value) =>
  value !== undefined && value !== null && value !== ""
    ? `<div style="margin-bottom:2px"><b>${label}:</b> ${value}</div>`
    : "";

// ✅ FIX chắc lỗi: txt không phải string
const getColorByRatingText = (txt) => {
  const t = String(txt ?? "").toLowerCase();

  if (t.includes("rất tốt")) return "#16a34a";
  if (t.includes("tốt")) return "#22c55e";
  if (t.includes("trung bình")) return "#facc15";
  if (t.includes("rất kém")) return "#b91c1c";
  if (t.includes("kém")) return "#f97316";

  if (t.includes("thưa")) return "#f97316";
  if (t.includes("dày")) return "#16a34a";

  return "#9ca3af";
};

const getRatingTextForPolygon = (layerId, p) => {
  switch (layerId) {
    case "bandovitri":
      return p.ketqua;
    case "buffer_bhx":
      return p.bhx_chuthi;
    case "buffer_cho":
      return p.cho_chuthi;
    case "buffer_doithu":
      return p.doithu_chu;
    case "buffer_truong":
      return p.truong_chu;
    case "buffer_giaothong":
      return p.gt_chuthic;
    case "buffer_ranhgioi":
      return p.mdds_chuth;
    default:
      return "";
  }
};

const stylePolygonFeature = (layerId, p) => {
  if (layerId === "ranhgioi") {
    return {
      color: COLORS.ranhgioi,
      weight: 1.8,
      fillColor: "transparent",
      fillOpacity: 0,
      dashArray: "3",
    };
  }

  const ratingText = getRatingTextForPolygon(layerId, p);
  const fillColor = getColorByRatingText(ratingText);

  return {
    color: "#0f172a",
    weight: layerId === "bandovitri" ? 1.6 : 1.0,
    fillColor,
    fillOpacity: layerId === "bandovitri" ? 0.65 : 0.55,
  };
};

// =============================================================
// Popup helpers
// =============================================================
const popupBandovitri = (p) => `
  <div style="min-width:220px">
    <b>Ô đánh giá AHP</b>
    ${field("Kết quả tổng hợp", p.ketqua)}
    ${field("ID ô (objectid)", p.objectid)}
    ${field("Diện tích (m²)", p.shape_area)}
  </div>
`;

const popupPointByLayer = (layerId, p) => {
  if (layerId === "bhx") {
    const title = pick(p.ten_bhx, p.ten, p.name, "Bách Hóa Xanh");
    const tenCapNhat = pick(p.ten_bach_h, p.ten_bhx, p.ten, p.name);

    return `
      <div style="min-width:220px">
        <b>${title}</b>
        ${field("Tên BHX (cập nhật)", tenCapNhat)}
        ${field("Địa chỉ", p.dia_chi || p.diachi)}
        ${field("Huyện", p.huyen)}
        ${field("Quy mô", p.quy_mo)}
        ${field("Ghi chú", p.ghichu)}
      </div>
    `;
  }

  if (layerId === "cho") {
    return `
      <div style="min-width:220px">
        <b>${p.ten || p.ten_cho || "Chợ"}</b>
        ${field("Loại chợ", p.loai || p.loai_cho)}
        ${field("Địa chỉ", p.dia_chi || p.diachi)}
        ${field("Huyện", p.huyen)}
      </div>
    `;
  }

  if (layerId === "truong") {
    return `
      <div style="min-width:220px">
        <b>${p.ten || p.ten_truong || "Trường học"}</b>
        ${field("Cấp trường", p.cap_truong || p.captruong)}
        ${field("Địa chỉ", p.dia_chi || p.diachi)}
        ${field("Huyện", p.huyen)}
      </div>
    `;
  }

  if (layerId === "doithu") {
    return `
      <div style="min-width:220px">
        <b>${p.ten || p.ten_cuahang || "Đối thủ"}</b>
        ${field("Hệ thống", p.he_thong || p.hethong)}
        ${field("Địa chỉ", p.dia_chi || p.diachi)}
        ${field("Huyện", p.huyen)}
      </div>
    `;
  }

  return `
    <div style="min-width:220px">
      <b>${p.ten || p.name || "Điểm dữ liệu"}</b>
      ${field("Địa chỉ", p.dia_chi || p.diachi)}
      ${field("Huyện", p.huyen)}
    </div>
  `;
};

const popupBuffer = (layerId, p) => {
  if (layerId === "buffer_bhx") {
    return `
      <div style="min-width:220px">
        <b>Buffer Bách Hóa Xanh</b>
        ${field("Mức BHX (1–3–5)", p.bhx_num)}
        ${field("Chú thích", p.bhx_chuthi)}
      </div>
    `;
  }
  if (layerId === "buffer_cho") {
    return `
      <div style="min-width:220px">
        <b>Buffer Chợ</b>
        ${field("Mức Chợ (1–3–5)", p.cho_num)}
        ${field("Chú thích", p.cho_chuthi)}
      </div>
    `;
  }
  if (layerId === "buffer_doithu") {
    return `
      <div style="min-width:220px">
        <b>Buffer Đối thủ</b>
        ${field("Mức Đối thủ (1–3–5)", p.doithu_num)}
        ${field("Chú thích", p.doithu_chu)}
      </div>
    `;
  }
  if (layerId === "buffer_truong") {
    return `
      <div style="min-width:220px">
        <b>Buffer Trường học</b>
        ${field("Mức Trường (1–3–5)", p.truong_num)}
        ${field("Chú thích", p.truong_chu)}
      </div>
    `;
  }
  if (layerId === "buffer_giaothong") {
    return `
      <div style="min-width:220px">
        <b>Buffer Giao thông</b>
        ${field("Tên đường", p.ten)}
        ${field("Cấp đường", p.capduong)}
        ${field("Chiều rộng (m)", p.chieurong)}
        ${field("Mức GT (1–3–5)", p.giaothong_num)}
        ${field("Chú thích", p.gt_chuthic)}
      </div>
    `;
  }
  if (layerId === "buffer_ranhgioi") {
    return `
      <div style="min-width:220px">
        <b>Buffer dân số / MDDS</b>
        ${field("Xã/Phường", p.name_3 || p.ten_xa)}
        ${field("Mật độ dân số", p.mat_do)}
        ${field("Mức MDDS (1–3–5)", p.mdds_num)}
        ${field("Chú thích", p.mdds_chuth)}
      </div>
    `;
  }
  return "";
};

const popupRanhGioi = (p) => `
  <div style="min-width:220px">
    <b>Ranh giới hành chính</b>
    ${field("Tỉnh", p.name_1 || p.tinh)}
    ${field("Huyện", p.name_2 || p.huyen)}
    ${field("Xã/Phường", p.name_3 || p.xa)}
  </div>
`;

// =============================================================
// AHP (backend)
// =============================================================
const SAATY_OPTIONS = [
  { token: "1/9", value: 1 / 9, label: "1/9" },
  { token: "1/7", value: 1 / 7, label: "1/7" },
  { token: "1/5", value: 1 / 5, label: "1/5" },
  { token: "1/3", value: 1 / 3, label: "1/3" },
  { token: "1", value: 1, label: "1" },
  { token: "3", value: 3, label: "3" },
  { token: "5", value: 5, label: "5" },
  { token: "7", value: 7, label: "7" },
  { token: "9", value: 9, label: "9" },
];

function valueToToken(v) {
  const eps = 1e-10;
  for (const opt of SAATY_OPTIONS) {
    if (Math.abs(v - opt.value) < eps) return opt.token;
  }
  return "1";
}
function tokenToValue(t) {
  const opt = SAATY_OPTIONS.find((x) => x.token === t);
  return opt ? opt.value : 1;
}

async function apiGet(url) {
  const res = await fetch(withBase(url), {
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `GET failed: ${res.status}`);
  return data;
}

async function apiPost(url, body) {
  const res = await fetch(withBase(url), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `POST failed: ${res.status}`);
  return data;
}

// ✅ default ma trận 1 (đúng để bắt đầu AHP)
function makeOnes(n) {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => 1));
}

// =============================================================
// ✅ AHP MODAL styles
// =============================================================
const ahpStyles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background:
      "radial-gradient(1200px 600px at 10% 10%, rgba(22,163,74,0.18), transparent 55%), rgba(2,6,23,0.55)",
    backdropFilter: "blur(6px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    zIndex: 10000,
  },
  modal: {
    width: "min(1120px, 96vw)",
    maxHeight: "92vh",
    background: "linear-gradient(180deg, #ffffff 0%, #fbfffd 100%)",
    borderRadius: 18,
    boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.25)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 16px",
    borderBottom: "1px solid #e5e7eb",
    background:
      "linear-gradient(90deg, rgba(22,163,74,0.12), rgba(15,118,110,0.10), rgba(59,130,246,0.08))",
  },
  titleWrap: { display: "flex", flexDirection: "column" },
  title: { fontSize: 18, fontWeight: 950, color: "#064e3b", letterSpacing: 0.2 },
  sub: { marginTop: 4, fontSize: 12.5, color: "#475569", lineHeight: 1.4 },
  close: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: 22,
    lineHeight: "34px",
    boxShadow: "0 6px 18px rgba(2,6,23,0.08)",
  },
  body: { padding: 16, overflow: "auto", maxHeight: "calc(92vh - 64px)" },
  toolbar: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 12,
  },
  btn: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    color: "#0f172a",
    boxShadow: "0 6px 16px rgba(2,6,23,0.06)",
  },
  btnGreen: {
    background: "linear-gradient(180deg, #16a34a, #15803d)",
    borderColor: "#16a34a",
    color: "#fff",
    boxShadow: "0 10px 24px rgba(22,163,74,0.25)",
  },
  err: {
    color: "#b42318",
    marginBottom: 10,
    fontWeight: 900,
    background: "#fff1f2",
    border: "1px solid #ffe4e6",
    padding: "10px 12px",
    borderRadius: 12,
  },
  tableWrap: {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    overflow: "auto",
    background: "#fff",
    boxShadow: "0 10px 26px rgba(2,6,23,0.06)",
  },
  table: {
    borderCollapse: "separate",
    borderSpacing: 0,
    width: "100%",
    minWidth: 980,
    fontSize: 13,
  },
  th: {
    position: "sticky",
    top: 0,
    zIndex: 5,
    background: "linear-gradient(180deg, #f8fafc, #f1f5f9)",
    padding: 12,
    borderBottom: "1px solid #e5e7eb",
    textAlign: "center",
    fontWeight: 950,
    color: "#0f172a",
    whiteSpace: "nowrap",
  },
  rowHead: {
    position: "sticky",
    left: 0,
    zIndex: 6,
    background: "linear-gradient(180deg, #f8fafc, #f1f5f9)",
    padding: 12,
    borderRight: "1px solid #e5e7eb",
    borderBottom: "1px solid #eef2f7",
    textAlign: "left",
    fontWeight: 950,
    color: "#0f172a",
    whiteSpace: "nowrap",
  },
  tdCenter: {
    padding: 10,
    borderBottom: "1px solid #eef2f7",
    textAlign: "center",
    background: "#ffffff",
  },
  tdRight: {
    padding: 10,
    borderBottom: "1px solid #eef2f7",
    textAlign: "center",
    fontWeight: 900,
    color: "#334155",
    background: "#ffffff",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "linear-gradient(180deg, #ffffff, #f8fafc)",
    fontWeight: 900,
    cursor: "pointer",
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
  },
  resultBox: {
    marginTop: 14,
    background:
      "linear-gradient(180deg, rgba(240,253,244,1) 0%, rgba(236,252,203,0.65) 100%)",
    border: "1px solid #bbf7d0",
    borderRadius: 16,
    padding: 14,
    boxShadow: "0 10px 28px rgba(22,163,74,0.10)",
  },
  resultTitle: { fontWeight: 950, marginBottom: 10, color: "#064e3b" },
  metrics: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.10)",
    background: "rgba(255,255,255,0.75)",
    fontWeight: 950,
    color: "#0f172a",
  },
  badgeOk: {
    border: "1px solid rgba(22,163,74,0.25)",
    background: "rgba(220,252,231,0.75)",
    color: "#14532d",
  },
  badgeBad: {
    border: "1px solid rgba(185,28,28,0.25)",
    background: "rgba(254,226,226,0.85)",
    color: "#7f1d1d",
  },
};

function AhpModal({ open, onClose }) {
  const [criteria, setCriteria] = useState([]);
  const labels = useMemo(() => criteria.map((c) => c.name), [criteria]);
  const n = labels.length;

  const [matrix, setMatrix] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        setErr("");
        const data = await apiGet("/api/ahp/criteria");
        const rows = data?.criteria || [];
        setCriteria(rows);
        setMatrix(makeOnes(rows.length));
        setResult(null);
      } catch (e) {
        setErr(e?.message || "Lỗi tải tiêu chí AHP");
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!n || !matrix?.length) return;

    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const r = await apiPost("/api/ahp/calc", {
          matrix,
          enforceSaaty: true,
          requireCR: false,
        });
        if (alive) setResult(r);
      } catch (e) {
        if (alive) setErr(e?.message || "Lỗi tính AHP");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, matrix, n]);

  function setPair(i, j, v) {
    setMatrix((prev) => {
      const m = prev.map((row) => row.slice());
      m[i][j] = v;
      m[j][i] = 1 / v;
      return m;
    });
  }

  function resetMatrix() {
    if (!n) return;
    setMatrix(makeOnes(n));
    setResult(null);
    setErr("");
  }

  async function loadLatest() {
    try {
      setErr("");
      const data = await apiGet("/api/ahp/latest");
      const items = data?.items || [];
      setResult((prev) => ({
        ...(prev || {}),
        items: items.map((it) => ({ ...it, weight: it.weight })),
      }));
      alert(`✅ Đã tải session mới nhất: ${data.session_id || "(trống)"}`);
    } catch (e) {
      setErr(e?.message || "Lỗi tải session");
    }
  }

  async function saveWeights() {
    try {
      setErr("");
      if (!result?.weights || result.weights.length !== n) {
        throw new Error("Chưa có weights để lưu (hãy nhập ma trận trước)");
      }
      const data = await apiPost("/api/ahp/save", { weights: result.weights });
      alert(`✅ Đã lưu trọng số AHP. session_id = ${data.session_id}`);
    } catch (e) {
      setErr(e?.message || "Lỗi lưu trọng số");
    }
  }

  if (!open) return null;

  const cr = typeof result?.CR === "number" ? result.CR : null;

  return (
    <div style={ahpStyles.overlay}>
      <div style={ahpStyles.modal}>
        <div style={ahpStyles.header}>
          <div style={ahpStyles.titleWrap}>
            <div style={ahpStyles.title}>Bảng AHP tiêu chí lớn</div>
            <div style={ahpStyles.sub}>
              Nhập ma trận so sánh cặp theo thang Saaty — tính AHP bằng backend (
              <code>/api/ahp/calc</code>) — yêu cầu CR &lt; 10%
            </div>
          </div>
          <button style={ahpStyles.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div style={ahpStyles.body}>
          <div style={ahpStyles.toolbar}>
            <button style={ahpStyles.btn} onClick={loadLatest}>
              Tải session mới nhất
            </button>
            <button style={ahpStyles.btn} onClick={resetMatrix}>
              Reset ma trận
            </button>
            <button
              style={{ ...ahpStyles.btn, ...ahpStyles.btnGreen }}
              onClick={saveWeights}
            >
              Lưu trọng số AHP
            </button>
          </div>

          {err && <div style={ahpStyles.err}>❌ {err}</div>}

          <div style={ahpStyles.tableWrap}>
            <table style={ahpStyles.table}>
              <thead>
                <tr>
                  <th style={ahpStyles.th}></th>
                  {labels.map((c) => (
                    <th key={c} style={ahpStyles.th}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {labels.map((rowName, i) => (
                  <tr
                    key={rowName}
                    style={{ background: i % 2 === 0 ? "#ffffff" : "#fbfdff" }}
                  >
                    <th style={ahpStyles.rowHead}>{rowName}</th>

                    {labels.map((_, j) => {
                      if (i === j) {
                        return (
                          <td key={j} style={ahpStyles.tdCenter}>
                            <b>1</b>
                          </td>
                        );
                      }

                      if (j > i) {
                        const curVal = matrix?.[i]?.[j] ?? 1;
                        const curToken = valueToToken(curVal);

                        return (
                          <td key={j} style={ahpStyles.tdCenter}>
                            <select
                              style={ahpStyles.select}
                              value={curToken}
                              onChange={(e) =>
                                setPair(i, j, tokenToValue(e.target.value))
                              }
                            >
                              {SAATY_OPTIONS.map((opt) => (
                                <option key={opt.token} value={opt.token}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }

                      return (
                        <td key={j} style={ahpStyles.tdRight}>
                          {valueToToken(matrix?.[i]?.[j] ?? 1)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={ahpStyles.resultBox}>
            <div style={ahpStyles.resultTitle}>Kết quả kiểm tra (backend)</div>

            {result ? (
              <>
                <div style={ahpStyles.metrics}>
                  <span style={ahpStyles.badge}>
                    λmax: <b>{Number(result.lambda_max).toFixed(4)}</b>
                  </span>

                  <span style={ahpStyles.badge}>
                    CI: <b>{Number(result.CI).toFixed(6)}</b>
                  </span>

                  <span
                    style={{
                      ...ahpStyles.badge,
                      ...(cr !== null && cr < 0.1
                        ? ahpStyles.badgeOk
                        : ahpStyles.badgeBad),
                    }}
                  >
                    CR:{" "}
                    <b>{cr === null ? "—" : `${(cr * 100).toFixed(2)}%`}</b>{" "}
                    <span style={{ opacity: 0.8 }}>( &lt; 10% )</span>
                  </span>

                  {loading && (
                    <span style={{ opacity: 0.7, fontWeight: 800 }}>
                      Đang tính...
                    </span>
                  )}
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 950, marginBottom: 6 }}>
                    Trọng số:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {(result.items || []).map((it) => (
                      <li key={it.id || it.code || it.name}>
                        {it.name}: <b>{Number(it.weight).toFixed(4)}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div style={{ opacity: 0.7 }}>Chưa có kết quả.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// MAIN COMPONENT
// =============================================================
const MapComponent = () => {
  const mapRef = useRef(null);
  const mapElRef = useRef(null);
  const tileLayerRef = useRef(null);
  const layerRef = useRef({});
  const cache = useRef({});
  const firstFitRef = useRef({});
  const suggestLayerRef = useRef(null);

  const [openAhpModal, setOpenAhpModal] = useState(false);

  const [visible, setVisible] = useState(() => ({
    bhx: true,
    bandovitri: true,
    ranhgioi: true,
  }));

  const [pointFilters, setPointFilters] = useState({
    bhx: "",
    cho: "",
    doithu: "",
    truong: "",
  });

  const [ahpFilter, setAHPFilter] = useState("all");
  const [bufferFilterLayer, setBufferFilterLayer] = useState("none");
  const [bufferFilterRating, setBufferFilterRating] = useState("all");

  const [baseLayer, setBaseLayer] = useState("osm");
  const [suggestLevel, setSuggestLevel] = useState("Rất tốt");

  const defaultCenter = useMemo(() => [11.56, 108.99], []);
  const defaultZoom = 11.5;

  // INIT MAP
  useEffect(() => {
    const container = mapElRef.current;
    if (!container) return;
    if (mapRef.current) return;

    // ✅ tránh lỗi "Map container is already initialized"
    if (container._leaflet_id) container._leaflet_id = null;

    const map = L.map(container, {
      zoomControl: false,
      scrollWheelZoom: true,
      doubleClickZoom: true,
    }).setView(defaultCenter, defaultZoom);

    const cfg = BASEMAPS.osm;
    const base = L.tileLayer(cfg.url, {
      maxZoom: 20,
      attribution: cfg.attribution,
    }).addTo(map);
    tileLayerRef.current = base;

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      try {
        map.remove();
      } catch (_) {}
      mapRef.current = null;
    };
  }, [defaultCenter, defaultZoom]);

  // BASEMAP SWITCH
  const handleBasemapChange = (e) => {
    const id = e.target.value;
    setBaseLayer(id);
    const map = mapRef.current;
    if (!map) return;

    const cfg = BASEMAPS[id];
    if (!cfg) return;

    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);

    const tile = L.tileLayer(cfg.url, {
      maxZoom: 20,
      attribution: cfg.attribution,
    }).addTo(map);

    tileLayerRef.current = tile;
  };

  // LOAD & DRAW LAYER
  const loadLayer = async (id, url) => {
    try {
      if (cache.current[id]) return drawLayer(id, cache.current[id]);

      const fullUrl = withBase(url);
      const res = await fetch(fullUrl, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        console.error("Fetch error", id, res.status, fullUrl);
        return;
      }

      const geo = await res.json().catch(() => null);
      if (!geo) return;

      cache.current[id] = geo;
      drawLayer(id, geo);
    } catch (e) {
      console.error("Fetch exception", id, e?.message || e);
    }
  };

  const drawLayer = (id, geo) => {
    const map = mapRef.current;
    if (!map || !geo) return;

    if (layerRef.current[id]) {
      map.removeLayer(layerRef.current[id]);
      delete layerRef.current[id];
    }

    let layer;

    if (POINT_LAYERS.includes(id)) {
      layer = L.geoJSON(geo, {
        pointToLayer: (_f, latlng) =>
          L.circleMarker(latlng, {
            radius: 6,
            fillColor: COLORS[id],
            color: "#064e3b",
            weight: 1,
            fillOpacity: 0.9,
          }),
        filter: (f) => {
          const search = norm(pointFilters[id] || "");
          if (!search) return true;

          const props = f.properties || {};
          const nameCandidate = pick(
            props.ten_bach_h,
            props.ten_bhx,
            props.ten,
            props.name,
            props.ten_cho,
            props.ten_truong,
            props.ten_cuahang
          );

          return norm(nameCandidate || "").includes(search);
        },
        onEachFeature: (f, lyr) => {
          lyr.bindPopup(popupPointByLayer(id, f.properties || {}), {
            maxWidth: 260,
          });
        },
      });
    } else if (LINE_LAYERS.includes(id)) {
      layer = L.geoJSON(geo, {
        style: { color: COLORS[id], weight: 2 },
      });
    } else if (POLYGON_LAYERS.includes(id)) {
      layer = L.geoJSON(geo, {
        style: (feat) => stylePolygonFeature(id, feat.properties || {}),
        filter: (f) => {
          const props = f.properties || {};

          if (id === "bandovitri") {
            if (ahpFilter === "all") return true;
            return norm(props.ketqua) === norm(ahpFilter);
          }

          const isBufferLayer = [
            "buffer_bhx",
            "buffer_cho",
            "buffer_doithu",
            "buffer_truong",
            "buffer_giaothong",
            "buffer_ranhgioi",
          ].includes(id);

          if (
            isBufferLayer &&
            bufferFilterLayer === id &&
            bufferFilterRating !== "all"
          ) {
            const ratingText = getRatingTextForPolygon(id, props);
            return norm(ratingText).includes(norm(bufferFilterRating));
          }

          return true;
        },
        onEachFeature: (f, lyr) => {
          const p = f.properties || {};
          let html = "";

          if (id === "bandovitri") html = popupBandovitri(p);
          else if (
            [
              "buffer_bhx",
              "buffer_cho",
              "buffer_doithu",
              "buffer_truong",
              "buffer_giaothong",
              "buffer_ranhgioi",
            ].includes(id)
          ) {
            html = popupBuffer(id, p);
          } else if (id === "ranhgioi") {
            html = popupRanhGioi(p);
          }

          if (html) lyr.bindPopup(html, { maxWidth: 260 });
        },
      });
    } else {
      return;
    }

    layer.addTo(map);
    if (id === "bandovitri") layer.bringToFront();

    if (
      ["bandovitri", "ranhgioi"].includes(id) &&
      !firstFitRef.current[id] &&
      layer.getLayers().length > 0
    ) {
      try {
        map.fitBounds(layer.getBounds());
        firstFitRef.current[id] = true;
      } catch (e) {
        console.warn("fitBounds error", e);
      }
    }

    layerRef.current[id] = layer;
  };

  // UPDATE LAYERS
  useEffect(() => {
    if (!mapRef.current) return;

    Object.entries(visible).forEach(([id, isOn]) => {
      if (!API[id]) return;

      if (isOn) loadLayer(id, API[id]);
      else if (layerRef.current[id]) {
        mapRef.current.removeLayer(layerRef.current[id]);
        delete layerRef.current[id];
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, pointFilters, ahpFilter, bufferFilterLayer, bufferFilterRating]);

  // THỐNG KÊ AHP
  const stats = useMemo(() => {
    const fs = cache.current.bandovitri?.features || [];
    const out = { total: 0, ratTot: 0, tot: 0, tb: 0, kem: 0, ratKem: 0 };
    const targetFilter = norm(ahpFilter);

    fs.forEach((f) => {
      const raw = f.properties?.ketqua;
      const kq = norm(raw);

      if (ahpFilter !== "all" && kq !== targetFilter) return;

      if (kq === norm("Rất tốt")) out.ratTot++;
      else if (kq === norm("Tốt")) out.tot++;
      else if (kq === norm("Trung bình")) out.tb++;
      else if (kq === norm("Kém")) out.kem++;
      else if (kq === norm("Rất kém")) out.ratKem++;

      out.total++;
    });

    return out;
  }, [ahpFilter]);

  // MAP ACTIONS
  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const resetView = () => mapRef.current?.setView(defaultCenter, defaultZoom);

  const fitAllLayers = () => {
    const map = mapRef.current;
    if (!map) return;
    let bounds = null;

    Object.values(layerRef.current).forEach((lyr) => {
      if (lyr && typeof lyr.getBounds === "function") {
        try {
          const b = lyr.getBounds();
          if (b && b.isValid()) bounds = bounds ? bounds.extend(b) : b;
        } catch (_) {}
      }
    });

    if (suggestLayerRef.current && typeof suggestLayerRef.current.getBounds === "function") {
      try {
        const b2 = suggestLayerRef.current.getBounds();
        if (b2 && b2.isValid()) bounds = bounds ? bounds.extend(b2) : b2;
      } catch (_) {}
    }

    if (bounds && bounds.isValid()) map.fitBounds(bounds);
  };

  const exportMap = async () => {
    const mapDiv = mapElRef.current;
    if (!mapDiv) return;

    const canvas = await html2canvas(mapDiv, {
      useCORS: true,
      backgroundColor: null,
      scale: 2,
    });

    const a = document.createElement("a");
    a.download = "webgis_ninhthuan.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  const exportPDF = () => {
    alert(
      "Demo xuất PNG đã hoạt động. Trong luận văn bạn có thể mô tả thêm ý tưởng xuất PDF từ bản đồ."
    );
  };

  const shareLink = () => {
    const m = mapRef.current;
    if (!m) return;
    const c = m.getCenter();
    const z = m.getZoom();
    const url = `${window.location.origin}${window.location.pathname}?lat=${c.lat.toFixed(
      6
    )}&lng=${c.lng.toFixed(6)}&z=${z}`;
    navigator.clipboard
      .writeText(url)
      .then(() => alert("Đã copy liên kết bản đồ vào clipboard!"))
      .catch(() => alert("Không copy được link, hãy thử lại."));
  };

  const clearSuggest = () => {
    const map = mapRef.current;
    if (!map) return;

    if (suggestLayerRef.current) {
      map.removeLayer(suggestLayerRef.current);
      suggestLayerRef.current = null;
      alert("✅ Đã xóa vùng gợi ý trên bản đồ.");
    } else {
      alert("ℹ️ Hiện chưa có vùng gợi ý nào để xóa.");
    }
  };

  const suggestBHX = () => {
    const map = mapRef.current;
    if (!map) return;

    const fs = cache.current.bandovitri?.features || [];
    if (!fs.length) {
      alert(
        'Chưa có dữ liệu lớp "bandovitri". Hãy bật lớp "Bản đồ vị trí" trong mục Lớp dữ liệu trước khi gợi ý.'
      );
      return;
    }

    const target = norm(suggestLevel);
    const matched = fs.filter((f) => norm(f?.properties?.ketqua) === target);

    if (!matched.length) {
      alert(`Hiện không có ô nào thuộc mức "${suggestLevel}" trong lớp bandovitri.`);
      return;
    }

    if (suggestLayerRef.current) {
      map.removeLayer(suggestLayerRef.current);
      suggestLayerRef.current = null;
    }

    const highlightGeo = { type: "FeatureCollection", features: matched };

    const highlightLayer = L.geoJSON(highlightGeo, {
      style: () => {
        const isRatTot = norm(suggestLevel) === norm("Rất tốt");
        return isRatTot
          ? { color: "#14532d", weight: 3.0, fillColor: "#22c55e", fillOpacity: 0.48 }
          : { color: "#166534", weight: 2.6, fillColor: "#86efac", fillOpacity: 0.4 };
      },
      onEachFeature: (f, lyr) => {
        const p = f?.properties || {};
        lyr.bindPopup(popupBandovitri(p), { maxWidth: 260 });
      },
    }).addTo(map);

    highlightLayer.bringToFront();

    try {
      const b = highlightLayer.getBounds();
      if (b && b.isValid()) map.fitBounds(b);
    } catch (e) {
      console.warn("fitBounds suggestBHX error", e);
    }

    suggestLayerRef.current = highlightLayer;
    alert(`✅ Đã gợi ý vùng mở BHX mức "${suggestLevel}" — ${matched.length} ô.`);
  };

  const openAHP = () => setOpenAhpModal(true);

  // =============================================================
  // RENDER
  // =============================================================
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: 0,
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 13,
        background: "#ecfdf5",
      }}
    >
      {/* CỘT TRÁI */}
      <aside
        style={{
          width: 240,
          borderRight: "1px solid #bbf7d0",
          padding: 12,
          background:
            "linear-gradient(180deg, #166534 0%, #15803d 40%, #047857 100%)",
          color: "#fefce8",
          boxShadow: CARD_SHADOW,
          zIndex: 800,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            Điều khiển bản đồ
          </div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>
            Zoom, thiết lập nền và xuất bản đồ phục vụ báo cáo.
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 12 }}>Nền bản đồ</div>
          <select
            value={baseLayer}
            onChange={handleBasemapChange}
            style={{
              ...baseInputStyle,
              marginTop: 6,
              borderRadius: 999,
              border: "none",
              padding: "6px 10px",
              fontSize: 12,
            }}
          >
            {Object.entries(BASEMAPS).map(([id, cfg]) => (
              <option key={id} value={id}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
            Hành động nhanh
          </div>

          <div
            style={{
              marginBottom: 8,
              padding: 8,
              borderRadius: 12,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
              Gợi ý mở BHX theo mức:
            </div>
            <select
              value={suggestLevel}
              onChange={(e) => setSuggestLevel(e.target.value)}
              style={{
                ...baseInputStyle,
                marginTop: 0,
                borderRadius: 999,
                border: "none",
                padding: "6px 10px",
              }}
            >
              <option value="Rất tốt">Rất tốt</option>
              <option value="Tốt">Tốt</option>
            </select>
            <div style={{ fontSize: 11, opacity: 0.9, marginTop: 6, lineHeight: 1.35 }}>
              * Chọn <b>Rất tốt</b> (ưu tiên cao nhất) hoặc <b>Tốt</b> (ưu tiên cao).
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button onClick={zoomIn} style={primaryButtonStyle}>
              Zoom In
            </button>
            <button onClick={zoomOut} style={primaryButtonStyle}>
              Zoom Out
            </button>
            <button onClick={resetView} style={primaryButtonStyle}>
              Đặt lại góc nhìn
            </button>
            <button onClick={fitAllLayers} style={primaryButtonStyle}>
              Fit tất cả lớp
            </button>

            <button onClick={exportMap} style={primaryButtonStyle}>
              Xuất PNG
            </button>
            <button onClick={exportPDF} style={secondaryButtonStyle}>
              Xuất PDF
            </button>

            <button onClick={shareLink} style={secondaryButtonStyle}>
              Chia sẻ link
            </button>

            <button onClick={openAHP} style={ahpButtonStyle}>
              Tính AHP
            </button>
            <button onClick={suggestBHX} style={highlightButtonStyle}>
              Gợi ý mở BHX
            </button>

            <button onClick={clearSuggest} style={dangerButtonStyle}>
              Xóa gợi ý
            </button>
          </div>

          <p style={{ fontSize: 11, marginTop: 10, opacity: 0.9, lineHeight: 1.4 }}>
            * “Tính AHP” dùng ma trận Saaty để ra trọng số. “Gợi ý mở BHX” tô nổi bật
            các ô theo mức bạn chọn trên lớp <code>bandovitri</code>.
          </p>
        </div>
      </aside>

      {/* GIỮA: BẢN ĐỒ + PANEL */}
      <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
        <div id="map" ref={mapElRef} style={{ position: "absolute", inset: 0 }} />

        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            zIndex: 999,
            width: 360,
            background: "#fefce8",
            padding: 12,
            borderRadius: 14,
            boxShadow: CARD_SHADOW,
            maxHeight: "90%",
            overflowY: "auto",
            borderLeft: "4px solid " + ACCENT,
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 4, fontSize: 15, fontWeight: 700, color: "#14532d" }}>
            WebGIS Ninh Thuận – Phân tích vị trí mở Bách Hóa Xanh
          </h3>

          <p style={{ marginTop: 0, marginBottom: 10, fontSize: 12, color: "#4b5563" }}>
            Ứng dụng AHP kết hợp GIS (buffer và chồng lớp) để xác định vùng ưu tiên mở rộng
            mạng lưới cửa hàng Bách Hóa Xanh tại tỉnh Ninh Thuận.
          </p>

          <div style={{ marginBottom: 10, padding: 8, borderRadius: 10, background: "#ffffff", border: BORDER_SUBTLE }}>
            <b style={{ fontSize: 12 }}>Lọc theo tên từng lớp điểm</b>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
              <div>
                <span style={{ fontSize: 11, color: "#6b7280" }}>BHX:</span>
                <input
                  type="text"
                  value={pointFilters.bhx}
                  onChange={(e) => setPointFilters((pf) => ({ ...pf, bhx: e.target.value }))}
                  placeholder="Tên BHX..."
                  style={smallInputStyle}
                />
              </div>

              <div>
                <span style={{ fontSize: 11, color: "#6b7280" }}>Chợ:</span>
                <input
                  type="text"
                  value={pointFilters.cho}
                  onChange={(e) => setPointFilters((pf) => ({ ...pf, cho: e.target.value }))}
                  placeholder="Tên chợ..."
                  style={smallInputStyle}
                />
              </div>

              <div>
                <span style={{ fontSize: 11, color: "#6b7280" }}>Đối thủ:</span>
                <input
                  type="text"
                  value={pointFilters.doithu}
                  onChange={(e) => setPointFilters((pf) => ({ ...pf, doithu: e.target.value }))}
                  placeholder="Tên cửa hàng..."
                  style={smallInputStyle}
                />
              </div>

              <div>
                <span style={{ fontSize: 11, color: "#6b7280" }}>Trường:</span>
                <input
                  type="text"
                  value={pointFilters.truong}
                  onChange={(e) => setPointFilters((pf) => ({ ...pf, truong: e.target.value }))}
                  placeholder="Tên trường..."
                  style={smallInputStyle}
                />
              </div>
            </div>

            <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.35 }}>
              * Nếu ô riêng cho lớp nào có giá trị thì ưu tiên lọc lớp đó.
            </p>
          </div>

          <div style={{ marginBottom: 10, padding: 8, borderRadius: 10, background: "#ffffff", border: BORDER_SUBTLE }}>
            <b style={{ fontSize: 12 }}>Lọc theo mức bản đồ vị trí</b>
            <select value={ahpFilter} onChange={(e) => setAHPFilter(e.target.value)} style={baseInputStyle}>
              <option value="all">Tất cả</option>
              <option value="Rất tốt">Rất tốt</option>
              <option value="Tốt">Tốt</option>
              <option value="Trung bình">Trung bình</option>
              <option value="Kém">Kém</option>
              <option value="Rất kém">Rất kém</option>
            </select>
          </div>

          <div style={{ marginBottom: 10, padding: 8, borderRadius: 10, background: "#ffffff", border: BORDER_SUBTLE }}>
            <b style={{ fontSize: 12 }}>Lọc riêng cho các lớp buffer</b>

            <div style={{ marginTop: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "#6b7280" }}>Chọn lớp buffer:</span>
              <select
                value={bufferFilterLayer}
                onChange={(e) => setBufferFilterLayer(e.target.value)}
                style={baseInputStyle}
              >
                <option value="none">Không lọc (tất cả)</option>
                <option value="buffer_bhx">Buffer BHX</option>
                <option value="buffer_cho">Buffer Chợ</option>
                <option value="buffer_doithu">Buffer Đối thủ</option>
                <option value="buffer_truong">Buffer Trường học</option>
                <option value="buffer_giaothong">Buffer Giao thông</option>
                <option value="buffer_ranhgioi">Buffer Dân số (MDDS)</option>
              </select>
            </div>

            <div>
              <span style={{ fontSize: 11, color: "#6b7280" }}>Mức đánh giá trong lớp buffer:</span>
              <select
                value={bufferFilterRating}
                onChange={(e) => setBufferFilterRating(e.target.value)}
                style={baseInputStyle}
              >
                <option value="all">Tất cả</option>
                <option value="Tốt">Tốt</option>
                <option value="Trung bình">Trung bình</option>
                <option value="Kém">Kém</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 10, padding: 8, borderRadius: 10, background: "#ffffff", border: BORDER_SUBTLE }}>
            <b style={{ fontSize: 12 }}>Lớp dữ liệu</b>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                columnGap: 12,
                rowGap: 2,
                marginTop: 4,
                fontSize: 12,
              }}
            >
              {LAYER_ORDER.filter((id) => !!API[id]).map((id) => {
                const meta = LAYER_META[id] || {};
                const label = meta.label || id;

                return (
                  <label
                    key={id}
                    title={meta.hint || id}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <input
                      type="checkbox"
                      checked={!!visible[id]}
                      onChange={(e) => setVisible((s) => ({ ...s, [id]: e.target.checked }))}
                    />
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 4, padding: 8, borderRadius: 10, background: "#ecfccb", border: BORDER_SUBTLE }}>
            <b style={{ fontSize: 12 }}>Thống kê nhanh bản đồ vị trí</b>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <div>Tổng số ô: {stats.total}</div>
              <div>Rất tốt: {stats.ratTot}</div>
              <div>Tốt: {stats.tot}</div>
              <div>Trung bình: {stats.tb}</div>
              <div>Kém: {stats.kem}</div>
              <div>Rất kém: {stats.ratKem}</div>
            </div>
          </div>
        </div>

        <AhpModal open={openAhpModal} onClose={() => setOpenAhpModal(false)} />
      </div>

      {/* CỘT PHẢI: CHÚ GIẢI */}
      <aside
        style={{
          width: 240,
          borderLeft: "1px solid #bbf7d0",
          padding: 12,
          background: "#fefce8",
          boxShadow: CARD_SHADOW,
          zIndex: 800,
        }}
      >
        <div style={{ marginBottom: 10 }}>
          <b style={{ fontSize: 13 }}>Chú giải lớp hiện trạng</b>
        </div>

        <ul style={{ listStyle: "none", paddingLeft: 0, marginTop: 4 }}>
          <li style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: COLORS.bhx,
                display: "inline-block",
                marginRight: 6,
                border: "1px solid #064e3b",
              }}
            />
            BHX hiện hữu
          </li>

          <li style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: COLORS.cho,
                display: "inline-block",
                marginRight: 6,
                border: "1px solid #064e3b",
              }}
            />
            Chợ
          </li>

          <li style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: COLORS.truong,
                display: "inline-block",
                marginRight: 6,
                border: "1px solid #064e3b",
              }}
            />
            Trường học
          </li>

          <li style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: COLORS.doithu,
                display: "inline-block",
                marginRight: 6,
                border: "1px solid #064e3b",
              }}
            />
            Đối thủ
          </li>

          <li style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <span
              style={{
                width: 18,
                height: 2,
                background: COLORS.giaothong,
                display: "inline-block",
                marginRight: 6,
              }}
            />
            Giao thông
          </li>

          <li style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <span
              style={{
                width: 14,
                height: 14,
                background: "transparent",
                border: `2px solid ${COLORS.ranhgioi}`,
                display: "inline-block",
                marginRight: 6,
              }}
            />
            Ranh giới hành chính
          </li>
        </ul>

        <div style={{ marginTop: 10 }}>
          <b style={{ fontSize: 13 }}>Mức đánh giá bản đồ vị trí</b>
        </div>

        <ul style={{ listStyle: "none", paddingLeft: 0, marginTop: 6 }}>
          {[
            ["Rất tốt", getColorByRatingText("Rất tốt")],
            ["Tốt", getColorByRatingText("Tốt")],
            ["Trung bình", getColorByRatingText("Trung bình")],
            ["Kém", getColorByRatingText("Kém")],
            ["Rất kém", getColorByRatingText("Rất kém")],
          ].map(([label, color]) => (
            <li key={label} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
              <span
                style={{
                  width: 20,
                  height: 12,
                  background: color,
                  border: "1px solid #064e3b",
                  display: "inline-block",
                  marginRight: 6,
                }}
              />
              {label}
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 10 }}>
          <b style={{ fontSize: 13 }}>Chú giải gợi ý mở BHX</b>
        </div>

        <ul style={{ listStyle: "none", paddingLeft: 0, marginTop: 6 }}>
          <li style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <span
              style={{
                width: 20,
                height: 12,
                background: "#22c55e",
                border: "1px solid #14532d",
                display: "inline-block",
                marginRight: 6,
              }}
            />
            Gợi ý: Rất tốt
          </li>

          <li style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <span
              style={{
                width: 20,
                height: 12,
                background: "#86efac",
                border: "1px solid #166534",
                display: "inline-block",
                marginRight: 6,
              }}
            />
            Gợi ý: Tốt
          </li>
        </ul>

        {/* debug nhỏ để bạn kiểm tra nhanh base */}
        <div style={{ marginTop: 10, fontSize: 11, opacity: 0.85 }}>
          <b>API Base:</b> {API_BASE || "(đang dùng relative/proxy)"}
        </div>
      </aside>
    </div>
  );
};

export default MapComponent;

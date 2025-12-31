// src/components/AdminPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete, clearToken } from "../api/apiClient";

const TABS = [
  { key: "bhx", label: "BHX", icon: "🛒", fields: ["ten_bach_h", "dia_chi", "huyen", "lat", "long"] },
  { key: "cho", label: "Chợ", icon: "🏪", fields: ["ten_cho", "dia_chi", "huyen", "loai", "quy_mo", "lat", "long"] },
  { key: "truong", label: "Trường", icon: "🏫", fields: ["ten_truong", "dia_chi", "huyen", "cap_do", "quy_mo", "lat", "long"] },
  { key: "doithu", label: "Đối thủ", icon: "⚔️", fields: ["ten", "dia_chi", "loai_hinh", "quy_mo", "doi_thu_ch", "lat", "long"] },
  { key: "giaothong", label: "Giao thông", icon: "🛣️", fields: ["ten", "capduong", "chieurong", "tc_duong", "chieudai"] },
];

function emptyForm(fields) {
  const o = {};
  fields.forEach((f) => (o[f] = ""));
  return o;
}

function pickId(obj = {}, fallback = null) {
  const raw =
    obj.id ??
    obj.gid ??
    obj.objectid ??
    obj.OBJECTID ??
    obj.ID ??
    obj.Id ??
    fallback;

  if (raw === null || raw === undefined || raw === "") return null;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function toNumberIfNeeded(obj, keys) {
  const out = { ...obj };
  keys.forEach((k) => {
    if (out[k] === "") {
      // để backend tự xử lý null/default
      delete out[k];
      return;
    }
    if (out[k] !== undefined && out[k] !== null) {
      const n = Number(out[k]);
      if (Number.isFinite(n)) out[k] = n;
    }
  });
  return out;
}

export default function AdminPage({ onLogout }) {
  const [tab, setTab] = useState("bhx");
  const cur = useMemo(() => TABS.find((t) => t.key === tab) || TABS[0], [tab]);

  const [items, setItems] = useState([]);
  const [form, setForm] = useState(() => emptyForm(cur.fields));
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");

  useEffect(() => {
    setForm(emptyForm(cur.fields));
    setEditingId(null);
    setMsg("");
    setErr("");
    setQ("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const load = async () => {
    try {
      setLoading(true);
      setErr("");
      setMsg("");

      const data = await apiGet(`/api/admin/${tab}`);

      // CASE 1: GeoJSON FeatureCollection
      if (data?.type === "FeatureCollection" && Array.isArray(data?.features)) {
        const list = data.features.map((f, idx) => {
          const p = f?.properties || {};
          const safeId = pickId(p, idx + 1);

          // QUAN TRỌNG: spread trước, set id sau để không bị overwrite
          return {
            ...p,
            id: safeId,
            _rid: safeId ?? `row-${idx}`,
          };
        });

        setItems(list);
        return;
      }

      // CASE 2: backend trả {items: [...]}
      if (Array.isArray(data?.items)) {
        const list = data.items.map((p, idx) => {
          const safeId = pickId(p, idx + 1);
          return { ...p, id: safeId, _rid: safeId ?? `row-${idx}` };
        });
        setItems(list);
        return;
      }

      // CASE 3: backend trả trực tiếp array
      if (Array.isArray(data)) {
        const list = data.map((p, idx) => {
          const safeId = pickId(p, idx + 1);
          return { ...p, id: safeId, _rid: safeId ?? `row-${idx}` };
        });
        setItems(list);
        return;
      }

      setItems([]);
    } catch (ex) {
      setErr(ex?.message || "Lỗi tải dữ liệu");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const submit = async () => {
    try {
      setLoading(true);
      setErr("");
      setMsg("");

      let payload = { ...form };
      payload = toNumberIfNeeded(payload, ["lat", "long", "chieudai", "chieurong"]);

      if (editingId) {
        await apiPut(`/api/admin/${tab}/${editingId}`, payload);
        setMsg(`✅ Đã cập nhật id=${editingId}`);
      } else {
        const created = await apiPost(`/api/admin/${tab}`, payload);
        setMsg(`✅ Đã thêm mới! id=${created?.id ?? "(không rõ)"}`);
      }

      setForm(emptyForm(cur.fields));
      setEditingId(null);
      await load();
    } catch (ex) {
      setErr(ex?.message || "Lỗi lưu dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (row) => {
    const id = row?.id ?? null;
    if (!Number.isFinite(Number(id))) {
      setErr("❌ Không xác định được id hợp lệ để sửa (id đang null).");
      return;
    }

    setEditingId(Number(id));

    const next = emptyForm(cur.fields);
    cur.fields.forEach((k) => {
      next[k] = row?.[k] ?? "";
    });
    setForm(next);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (row) => {
    const id = row?.id ?? null;

    if (!Number.isFinite(Number(id))) {
      setErr("❌ Không xác định được id hợp lệ để xóa (id đang null).");
      return;
    }

    const ok = window.confirm(`Bạn chắc chắn muốn xóa id=${id}?`);
    if (!ok) return;

    try {
      setLoading(true);
      setErr("");
      setMsg("");

      await apiDelete(`/api/admin/${tab}/${Number(id)}`);

      setMsg(`✅ Đã xóa id=${id}`);
      await load();
    } catch (ex) {
      setErr(ex?.message || "Lỗi xóa");
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm(cur.fields));
  };

  const logout = () => {
    clearToken();
    onLogout?.();
  };

  const filtered = useMemo(() => {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return items;
    return items.filter((row) => JSON.stringify(row || {}).toLowerCase().includes(s));
  }, [items, q]);

  return (
    <div style={styles.page}>
      {/* TOP BAR */}
      <div style={styles.topbar}>
        <div style={styles.topbarLeft}>
          <div style={styles.badge}>ADMIN</div>
          <div>
            <div style={styles.title}>Admin CRUD – Ninh Thuận</div>
            <div style={styles.subtitle}>
              Quản trị dữ liệu phục vụ WebGIS (BHX/Chợ/Trường/Đối thủ/Giao thông)
            </div>
          </div>
        </div>

        <div style={styles.topbarRight}>
          <button disabled={loading} onClick={load} style={styles.btnGhost}>
            ⟳ Reload
          </button>
          <button onClick={logout} style={styles.btnWarn}>
            ⎋ Đăng xuất
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={styles.wrap}>
        {/* SIDEBAR */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <div style={{ fontWeight: 1000, color: "#0f172a" }}>Danh mục</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>Chọn lớp cần CRUD</div>
          </div>

          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  ...styles.tabBtn,
                  background: tab === t.key ? "linear-gradient(180deg,#dcfce7,#ecfdf5)" : "#fff",
                  borderColor: tab === t.key ? "rgba(22,163,74,0.35)" : "rgba(15,23,42,0.10)",
                }}
              >
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <span style={{ fontWeight: 1000, color: tab === t.key ? "#14532d" : "#0f172a" }}>
                  {t.label}
                </span>
                <span style={styles.smallPill}>{t.key}</span>
              </button>
            ))}
          </div>

          {/* FORM CARD */}
          <div style={styles.formCard}>
            <div style={styles.formTitleRow}>
              <div style={{ fontWeight: 1000, color: "#0f172a" }}>
                {editingId ? `✏️ Sửa id=${editingId}` : "➕ Thêm mới"}
              </div>
              {editingId && (
                <button onClick={cancelEdit} style={styles.btnMini}>
                  Hủy
                </button>
              )}
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {cur.fields.map((k) => (
                <div key={k}>
                  <div style={styles.label}>{k}</div>
                  <input
                    value={form[k]}
                    onChange={(e) => setForm((s) => ({ ...s, [k]: e.target.value }))}
                    placeholder={`Nhập ${k}...`}
                    style={styles.input}
                  />
                </div>
              ))}
            </div>

            {err && <Alert type="error" text={err} />}
            {msg && <Alert type="ok" text={msg} />}

            <button
              disabled={loading}
              onClick={submit}
              style={{
                ...styles.btnPrimary,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Đang xử lý..." : editingId ? "Cập nhật" : "Thêm"}
            </button>

            <div style={styles.helperText}>
              
            </div>
          </div>
        </aside>

        {/* CONTENT */}
        <main style={styles.content}>
          <div style={styles.contentHeader}>
            <div>
              <div style={styles.contentTitle}>
                Danh sách: {cur.icon} {cur.label}
              </div>
              <div style={styles.contentSub}>
                Tổng: <b>{filtered.length}</b> bản ghi
              </div>
            </div>

            <div style={styles.searchWrap}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="🔎 Tìm nhanh (gõ tên/địa chỉ/huyện...)"
                style={styles.search}
              />
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: 90 }}>id</th>
                  {cur.fields.map((k) => (
                    <th key={k} style={styles.th}>
                      {k}
                    </th>
                  ))}
                  <th style={{ ...styles.th, width: 170, textAlign: "center" }}>Hành động</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((row, idx) => (
                  <tr key={row?._rid ?? row?.id ?? idx} style={{ background: idx % 2 ? "#fff" : "#fbfdff" }}>
                    <td style={styles.tdId}>{row?.id ?? "?"}</td>

                    {cur.fields.map((k) => (
                      <td key={k} style={styles.td}>
                        <span style={styles.cellClamp}>{String(row?.[k] ?? "")}</span>
                      </td>
                    ))}

                    <td style={{ ...styles.td, textAlign: "center", whiteSpace: "nowrap" }}>
                      <button onClick={() => startEdit(row)} style={styles.btnEdit}>
                        Sửa
                      </button>
                      <button onClick={() => remove(row)} style={styles.btnDel}>
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}

                {!filtered.length && (
                  <tr>
                    <td colSpan={cur.fields.length + 2} style={styles.empty}>
                      Không có dữ liệu (hoặc API chưa trả đúng format).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

function Alert({ type, text }) {
  const isOk = type === "ok";
  return (
    <div
      style={{
        marginTop: 12,
        padding: 10,
        borderRadius: 14,
        border: `1px solid ${isOk ? "rgba(34,197,94,0.25)" : "rgba(244,63,94,0.25)"}`,
        background: isOk
          ? "linear-gradient(180deg,#ecfdf5,#f0fdf4)"
          : "linear-gradient(180deg,#fff1f2,#ffe4e6)",
        color: isOk ? "#14532d" : "#b91c1c",
        fontWeight: 900,
        fontSize: 12,
        lineHeight: "16px",
      }}
    >
      {isOk ? "✅ " : "❌ "}
      {text}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "calc(100vh - 60px)",
    background:
      "radial-gradient(1200px 500px at 15% 0%, rgba(34,197,94,0.18), transparent 60%)," +
      "linear-gradient(180deg, #f8fafc, #f1f5f9)",
  },

  topbar: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    color: "#fff",
    background: "linear-gradient(90deg,#16a34a,#0f766e)",
    boxShadow: "0 12px 36px rgba(2,6,23,0.16)",
  },
  topbarLeft: { display: "flex", alignItems: "center", gap: 12 },
  badge: {
    fontWeight: 1000,
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.18)",
    border: "1px solid rgba(255,255,255,0.25)",
    letterSpacing: 1,
  },
  title: { fontWeight: 1000, fontSize: 16 },
  subtitle: { fontSize: 12, opacity: 0.9 },

  topbarRight: { display: "flex", alignItems: "center", gap: 10 },
  btnGhost: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.30)",
    background: "rgba(255,255,255,0.14)",
    color: "#fff",
    fontWeight: 1000,
    cursor: "pointer",
  },
  btnWarn: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "linear-gradient(180deg,#fde047,#facc15)",
    color: "#0f172a",
    fontWeight: 1000,
    cursor: "pointer",
  },

  wrap: {
    width: "min(1280px, 100%)",
    margin: "0 auto",
    padding: 14,
    display: "grid",
    gridTemplateColumns: "340px 1fr",
    gap: 14,
    alignItems: "start",
  },

  sidebar: {
    position: "sticky",
    top: 74,
    alignSelf: "start",
    borderRadius: 18,
    background: "#fff",
    border: "1px solid rgba(15,23,42,0.10)",
    boxShadow: "0 18px 60px rgba(2,6,23,0.06)",
    overflow: "hidden",
  },
  sidebarHeader: { padding: 14, borderBottom: "1px solid rgba(15,23,42,0.08)" },

  tabBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px",
    margin: "0 12px",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.10)",
    cursor: "pointer",
    textAlign: "left",
  },
  smallPill: {
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.05)",
    border: "1px solid rgba(15,23,42,0.08)",
    color: "#334155",
    fontWeight: 900,
  },

  formCard: {
    marginTop: 12,
    padding: 14,
    borderTop: "1px solid rgba(15,23,42,0.08)",
    background: "linear-gradient(180deg,#ffffff,#fbfdff)",
  },
  formTitleRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  btnMini: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 1000,
  },

  label: { fontSize: 12, fontWeight: 1000, color: "#334155", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.12)",
    outline: "none",
    fontSize: 13,
    background: "linear-gradient(180deg,#ffffff,#f8fafc)",
  },

  btnPrimary: {
    width: "100%",
    marginTop: 12,
    padding: "11px 12px",
    borderRadius: 999,
    border: "none",
    background: "linear-gradient(180deg,#16a34a,#15803d)",
    color: "#fff",
    fontWeight: 1000,
    boxShadow: "0 16px 40px rgba(22,163,74,0.22)",
  },
  helperText: { marginTop: 10, fontSize: 12, color: "#64748b" },

  content: {
    borderRadius: 18,
    background: "#fff",
    border: "1px solid rgba(15,23,42,0.10)",
    boxShadow: "0 18px 60px rgba(2,6,23,0.06)",
    overflow: "hidden",
  },
  contentHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    background: "linear-gradient(180deg,#ffffff,#fbfdff)",
    alignItems: "center",
  },
  contentTitle: { fontWeight: 1000, fontSize: 16, color: "#0f172a" },
  contentSub: { fontSize: 12, color: "#64748b", marginTop: 4 },

  searchWrap: { width: "min(420px, 100%)" },
  search: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.12)",
    outline: "none",
    background: "linear-gradient(180deg,#ffffff,#f8fafc)",
    fontSize: 13,
  },

  tableWrap: { overflow: "auto", maxHeight: "calc(100vh - 190px)" },
  table: { width: "100%", borderCollapse: "collapse" },

  th: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    textAlign: "left",
    padding: 12,
    fontSize: 12,
    color: "#0f172a",
    background: "#f1f5f9",
    borderBottom: "1px solid rgba(15,23,42,0.10)",
  },

  td: { padding: 12, borderBottom: "1px solid rgba(15,23,42,0.06)", fontSize: 13, color: "#0f172a" },
  tdId: { padding: 12, borderBottom: "1px solid rgba(15,23,42,0.06)", fontWeight: 1000, color: "#0f172a" },

  cellClamp: {
    display: "inline-block",
    maxWidth: 320,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    verticalAlign: "bottom",
  },

  btnEdit: {
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.12)",
    padding: "7px 10px",
    cursor: "pointer",
    fontWeight: 1000,
    background: "#fff",
    marginRight: 8,
  },
  btnDel: {
    borderRadius: 12,
    border: "1px solid rgba(244,63,94,0.25)",
    padding: "7px 10px",
    cursor: "pointer",
    fontWeight: 1000,
    background: "linear-gradient(180deg,#fff1f2,#ffe4e6)",
    color: "#b91c1c",
  },

  empty: { padding: 14, color: "#64748b", fontSize: 13 },
};

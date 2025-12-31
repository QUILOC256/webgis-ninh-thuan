// src/components/AdminLogin.jsx
import React, { useMemo, useState } from "react";
import { apiPost, setToken } from "../api/apiClient";

const HEADER_H = 60; // đúng với header App của bạn (nếu header cao hơn, tăng số này)

export default function AdminLogin({ onLoggedIn }) {
  const [username, setUsername] = useState("quiloc");
  const [password, setPassword] = useState("1234");
  const [showPw, setShowPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = useMemo(() => {
    return String(username).trim().length > 0 && String(password).trim().length > 0 && !loading;
  }, [username, password, loading]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setErr("");

      const data = await apiPost("/api/admin/login", {
        username: String(username).trim(),
        password: String(password).trim(),
      });

      if (!data?.token) throw new Error("Không nhận được token");
      setToken(data.token);
      onLoggedIn?.();
    } catch (ex) {
      setErr(ex?.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.card}>
          {/* Header mini */}
          <div style={styles.brandRow}>
            <div style={styles.logoDot}>NT</div>

            <div style={{ minWidth: 0 }}>
              <div style={styles.brandTitle}>Admin Panel</div>
              <div style={styles.brandSub}>WebGIS Ninh Thuận – Bách Hóa Xanh</div>
            </div>

            <span style={styles.badge}>Bảo mật JWT</span>
          </div>

          <h2 style={styles.h2}>Đăng nhập quản trị</h2>
          <p style={styles.p}>
            CRUD dữ liệu: <b>BHX</b>, <b>Chợ</b>, <b>Trường</b>, <b>Đối thủ</b>, <b>Giao thông</b>.
          </p>

          {err && (
            <div style={styles.errBox}>
              <div style={styles.errTitle}>Không đăng nhập được</div>
              <div style={styles.errText}>{err}</div>
            </div>
          )}

          <form onSubmit={submit} style={{ marginTop: 14 }}>
            <label style={styles.label}>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="Nhập username..."
              style={styles.input}
            />

            <div style={{ height: 12 }} />

            <label style={styles.label}>Password</label>
            <div style={styles.pwWrap}>
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu..."
                style={styles.pwInput}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                style={styles.pwBtn}
                title={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPw ? "Ẩn" : "Hiện"}
              </button>
            </div>

            <button
              disabled={!canSubmit}
              type="submit"
              style={{
                ...styles.btn,
                opacity: canSubmit ? 1 : 0.6,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            <div style={styles.note}>
              Tip: Nếu báo <b>Token hết hạn</b> → đăng nhập lại để lấy token mới.
            </div>
          </form>
        </div>

        <div style={styles.bottomHint}>© {new Date().getFullYear()} WebGIS Ninh Thuận – Admin</div>
      </div>
    </div>
  );
}

const styles = {
  // ✅ FIXED overlay dưới header -> không lệch bởi layout cha
  page: {
    position: "fixed",
    top: HEADER_H,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,

    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,

    background:
      "radial-gradient(1200px 500px at 20% 10%, rgba(34,197,94,0.25), transparent 60%)," +
      "radial-gradient(900px 400px at 90% 20%, rgba(16,185,129,0.18), transparent 60%)," +
      "linear-gradient(180deg, #ecfdf5, #f8fafc)",
  },

  shell: {
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
  },

  card: {
    width: "100%",
    borderRadius: 22,
    padding: 22,
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow: "0 22px 70px rgba(2,6,23,0.16)",
    background: "#fff",
  },

  brandRow: { display: "flex", gap: 12, alignItems: "center" },
  logoDot: {
    width: 42,
    height: 42,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    color: "#fff",
    background: "linear-gradient(180deg,#16a34a,#15803d)",
    boxShadow: "0 14px 30px rgba(22,163,74,0.35)",
    flex: "0 0 auto",
  },
  brandTitle: { fontWeight: 900, fontSize: 14, color: "#14532d" },
  brandSub: { fontSize: 12, color: "#64748b", marginTop: 2 },

  badge: {
    marginLeft: "auto",
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    background: "rgba(16,185,129,0.22)",
    border: "1px solid rgba(5,150,105,0.25)",
    color: "#065f46",
    whiteSpace: "nowrap",
  },

  h2: { margin: "14px 0 6px", fontSize: 22, letterSpacing: -0.2, color: "#0f172a" },
  p: { margin: 0, fontSize: 13, color: "#475569", lineHeight: "18px" },

  errBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    background: "linear-gradient(180deg, #fff1f2, #ffe4e6)",
    border: "1px solid rgba(244,63,94,0.25)",
  },
  errTitle: { fontWeight: 900, color: "#9f1239", fontSize: 13 },
  errText: { marginTop: 4, color: "#be123c", fontSize: 12, lineHeight: "16px" },

  label: { display: "block", fontSize: 12, fontWeight: 900, color: "#0f172a", marginTop: 12 },
  input: {
    width: "100%",
    marginTop: 6,
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.14)",
    outline: "none",
    fontSize: 13,
    background: "linear-gradient(180deg,#ffffff,#f8fafc)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  },

  pwWrap: {
    marginTop: 6,
    display: "flex",
    alignItems: "center",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.14)",
    background: "linear-gradient(180deg,#ffffff,#f8fafc)",
    paddingRight: 6,
  },
  pwInput: {
    width: "100%",
    padding: "12px 12px",
    border: "none",
    outline: "none",
    fontSize: 13,
    background: "transparent",
  },
  pwBtn: {
    border: "none",
    background: "transparent",
    fontWeight: 900,
    color: "#166534",
    padding: "8px 10px",
    borderRadius: 12,
    cursor: "pointer",
  },

  btn: {
    width: "100%",
    marginTop: 14,
    padding: "12px 12px",
    borderRadius: 999,
    border: "none",
    color: "#fff",
    fontWeight: 900,
    background: "linear-gradient(180deg,#16a34a,#15803d)",
    boxShadow: "0 16px 40px rgba(22,163,74,0.32)",
  },

  note: { marginTop: 10, fontSize: 12, color: "#64748b" },
  bottomHint: { marginTop: 10, textAlign: "center", fontSize: 12, color: "#64748b" },
};

import React, { useEffect, useMemo, useState } from "react";

/**
 * ✅ THANG SAATY ĐÚNG CHUẨN (có cả nghịch đảo)
 * Hình bạn gửi: 1/9 1/7 1/5 1/3 1 3 5 7 9
 * -> Mình cung cấp đầy đủ 1/9..1/2 và 1..9 để bạn chọn.
 * (Bạn có thể chỉ giữ đúng 9 mức theo hình nếu muốn)
 */
const SAATY_OPTIONS = [
  // nghịch đảo (khi tiêu chí hàng kém hơn tiêu chí cột)
  { value: 1 / 9, label: "1/9 - Tuyệt đối kém hơn" },
  { value: 1 / 8, label: "1/8 - Rất kém hơn" },
  { value: 1 / 7, label: "1/7 - Cực kỳ kém hơn" },
  { value: 1 / 6, label: "1/6 - Kém hơn mạnh" },
  { value: 1 / 5, label: "1/5 - Rất kém hơn" },
  { value: 1 / 4, label: "1/4 - Kém hơn" },
  { value: 1 / 3, label: "1/3 - Hơi kém hơn" },
  { value: 1 / 2, label: "1/2 - Kém hơn nhẹ" },

  // bằng nhau
  { value: 1, label: "1 - Ngang nhau" },

  // thuận (khi tiêu chí hàng quan trọng hơn tiêu chí cột)
  { value: 2, label: "2 - Hơi quan trọng" },
  { value: 3, label: "3 - Quan trọng" },
  { value: 4, label: "4 - Khá quan trọng" },
  { value: 5, label: "5 - Rất quan trọng" },
  { value: 6, label: "6 - Rất mạnh" },
  { value: 7, label: "7 - Cực kỳ quan trọng" },
  { value: 8, label: "8 - Gần tuyệt đối" },
  { value: 9, label: "9 - Tuyệt đối" },
];

async function apiGet(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "GET failed");
  return data;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "POST failed");
  return data;
}

function makeIdentity(n) {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 1))
  );
}

// hiển thị dạng phân số đẹp cho tam giác dưới
function formatSaaty(v) {
  const eps = 1e-10;
  // gần 1
  if (Math.abs(v - 1) < eps) return "1";

  // nếu là nghịch đảo số nguyên 2..9
  for (let k = 2; k <= 9; k++) {
    if (Math.abs(v - 1 / k) < eps) return `1/${k}`;
  }
  // nếu là số nguyên 2..9
  for (let k = 2; k <= 9; k++) {
    if (Math.abs(v - k) < eps) return String(k);
  }

  // fallback
  return Number(v).toFixed(3);
}

export default function AhpPanel({ onClose, onSaved }) {
  const [criteria, setCriteria] = useState([]); // [{id, code, name}]
  const labels = useMemo(() => criteria.map((c) => c.name), [criteria]);
  const n = labels.length;

  const [matrix, setMatrix] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Load criteria từ DB
  useEffect(() => {
    (async () => {
      try {
        setErr("");
        const data = await apiGet("/api/ahp/criteria");
        const rows = data?.criteria || [];
        setCriteria(rows);
        setMatrix(makeIdentity(rows.length));
      } catch (e) {
        setErr(e.message || "Lỗi tải tiêu chí AHP");
      }
    })();
  }, []);

  // Tính AHP mỗi khi matrix đổi
  useEffect(() => {
    if (!n) return;
    if (!matrix?.length) return;

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
        if (alive) setErr(e.message || "Lỗi tính AHP");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [matrix, n]);

  // set a_ij = v, a_ji = 1/v
  function setPair(i, j, v) {
    if (!v || Number.isNaN(v)) return;
    setMatrix((prev) => {
      const m = prev.map((row) => row.slice());
      m[i][j] = v;
      m[j][i] = 1 / v;
      return m;
    });
  }

  function resetMatrix() {
    setMatrix(makeIdentity(n));
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
      setErr(e.message || "Lỗi tải session");
    }
  }

  async function saveWeights() {
    try {
      setErr("");
      if (!result?.weights || result.weights.length !== n) {
        throw new Error("Chưa có weights để lưu (hãy nhập ma trận trước)");
      }
      const data = await apiPost("/api/ahp/save", { weights: result.weights });
      onSaved?.(data);
      alert(`✅ Đã lưu trọng số AHP. session_id = ${data.session_id}`);
    } catch (e) {
      setErr(e.message || "Lỗi lưu trọng số");
    }
  }

  const cr = result?.CR ?? null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Bảng AHP tiêu chí lớn</div>
            <div style={styles.sub}>
              Chọn đúng thang Saaty (có cả nghịch đảo 1/2…1/9) — tính bằng backend{" "}
              (<code>/api/ahp/calc</code>) — yêu cầu CR &lt; 10%
            </div>
          </div>
          <button style={styles.close} onClick={onClose}>
            ×
          </button>
        </div>

        <div style={styles.toolbar}>
          <button style={styles.btn} onClick={loadLatest}>
            Tải session mới nhất
          </button>
          <button style={styles.btn} onClick={resetMatrix}>
            Reset ma trận
          </button>
          <button style={{ ...styles.btn, ...styles.btnGreen }} onClick={saveWeights}>
            Lưu trọng số AHP
          </button>
        </div>

        {err && <div style={styles.err}>❌ {err}</div>}

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}></th>
                {labels.map((c) => (
                  <th key={c} style={styles.th}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {labels.map((rowName, i) => (
                <tr key={rowName}>
                  <th style={styles.rowHead}>{rowName}</th>

                  {labels.map((_, j) => {
                    if (i === j) {
                      return (
                        <td key={j} style={styles.tdCenter}>
                          <b>1</b>
                        </td>
                      );
                    }

                    // tam giác trên: dropdown
                    if (j > i) {
                      const cur = matrix?.[i]?.[j] ?? 1;
                      return (
                        <td key={j} style={styles.tdCenter}>
                          <select
                            style={styles.select}
                            value={cur}
                            onChange={(e) => setPair(i, j, Number(e.target.value))}
                          >
                            {SAATY_OPTIONS.map((opt) => (
                              <option key={opt.label} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    }

                    // tam giác dưới: hiển thị nghịch đảo (dạng phân số)
                    return (
                      <td key={j} style={styles.tdRight}>
                        {formatSaaty(matrix?.[i]?.[j] ?? 1)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={styles.resultBox}>
          <div style={styles.resultTitle}>Kết quả kiểm tra (backend)</div>

          {result ? (
            <>
              <div style={styles.metrics}>
                <div>
                  λmax: <b>{Number(result.lambda_max).toFixed(4)}</b>
                </div>
                <div>
                  CI: <b>{Number(result.CI).toFixed(6)}</b>
                </div>
                <div>
                  CR:{" "}
                  <b style={{ color: cr < 0.1 ? "#067647" : "#b42318" }}>
                    {(cr * 100).toFixed(2)}%
                  </b>{" "}
                  (yêu cầu &lt; 10%)
                </div>
                {loading && <div style={{ opacity: 0.7 }}>Đang tính...</div>}
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Trọng số:</div>
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
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    zIndex: 9999,
  },
  modal: {
    width: "min(1100px, 96vw)",
    maxHeight: "92vh",
    background: "#fff",
    borderRadius: 14,
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    overflow: "auto",
    padding: 16,
  },
  header: { display: "flex", justifyContent: "space-between", gap: 12 },
  title: { fontSize: 20, fontWeight: 900, color: "#14532d" },
  sub: { marginTop: 4, fontSize: 13, opacity: 0.75 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid #eee",
    background: "#fff",
    cursor: "pointer",
    fontSize: 22,
    lineHeight: "32px",
  },
  toolbar: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 12,
    marginBottom: 12,
  },
  btn: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 999,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 800,
  },
  btnGreen: {
    background: "#16a34a",
    borderColor: "#16a34a",
    color: "#fff",
  },
  err: { color: "#b42318", marginBottom: 10, fontWeight: 800 },
  tableWrap: { border: "1px solid #eee", borderRadius: 12, overflow: "auto" },
  table: { borderCollapse: "collapse", width: "100%", minWidth: 900 },
  th: {
    position: "sticky",
    top: 0,
    background: "#f8fafc",
    padding: 10,
    borderBottom: "1px solid #eee",
    textAlign: "center",
    fontWeight: 900,
  },
  rowHead: {
    background: "#f8fafc",
    padding: 10,
    borderRight: "1px solid #eee",
    textAlign: "left",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  tdCenter: { padding: 10, borderBottom: "1px solid #f1f5f9", textAlign: "center" },
  tdRight: { padding: 10, borderBottom: "1px solid #f1f5f9", textAlign: "right" },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontWeight: 800,
  },
  resultBox: {
    marginTop: 14,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: 12,
  },
  resultTitle: { fontWeight: 900, marginBottom: 8 },
  metrics: { display: "flex", gap: 18, flexWrap: "wrap" },
};

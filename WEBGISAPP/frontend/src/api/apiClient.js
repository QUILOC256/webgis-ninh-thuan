// frontend/src/api/apiClient.js
// =============================================================
// API CLIENT - READY FOR RENDER STATIC + RENDER BACKEND
// - Ưu tiên env: REACT_APP_API_URL hoặc REACT_APP_API_BASE_URL
// - Fallback: nếu chạy trên localhost -> http://localhost:5000
// - Fallback: nếu deploy -> dùng cùng origin (nếu bạn cấu hình proxy/rewrite)
// - Timeout + parse JSON safe + error message rõ
// - Token key: hỗ trợ cả key cũ và mới
// =============================================================

const ENV_BASE =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL)) ||
  "";

// Chuẩn hoá base url (bỏ dấu / cuối)
function normalizeBaseUrl(url) {
  return String(url || "")
    .trim()
    .replace(/^"+|"+$/g, "") // bỏ dấu " nếu có
    .replace(/\/+$/, ""); // bỏ / cuối
}

// Tự đoán base URL khi không có env
function guessBaseUrl() {
  // Nếu đang chạy trên browser
  if (typeof window !== "undefined" && window.location) {
    const host = window.location.hostname || "";
    // Local dev
    if (host === "localhost" || host === "127.0.0.1") return "http://localhost:5000";

    // Deploy static: khuyến nghị dùng env trỏ về backend.
    // Nếu bạn muốn "chung domain" (proxy/rewrite) thì dùng origin này.
    return window.location.origin;
  }
  // Node/test fallback
  return "http://localhost:5000";
}

export const BASE_URL = normalizeBaseUrl(ENV_BASE) || normalizeBaseUrl(guessBaseUrl());

// ================= Token =================
const ADMIN_TOKEN_KEY = "adminToken";
const ADMIN_TOKEN_KEY_LEGACY = "admin_token";

export function setToken(token) {
  if (!token) return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  // đồng bộ xoá key cũ tránh lẫn
  localStorage.removeItem(ADMIN_TOKEN_KEY_LEGACY);
}

export function getToken() {
  return (
    localStorage.getItem(ADMIN_TOKEN_KEY) ||
    localStorage.getItem(ADMIN_TOKEN_KEY_LEGACY) ||
    null
  );
}

export function clearToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_TOKEN_KEY_LEGACY);
}

// ================= Helpers =================
async function parseJsonSafe(res) {
  try {
    // có response nhưng không phải json cũng không crash
    return await res.json();
  } catch {
    return null;
  }
}

function buildUrl(path) {
  const p = String(path || "").trim();
  if (!p) return BASE_URL;
  // Nếu user truyền full URL thì dùng luôn
  if (/^https?:\/\//i.test(p)) return p;
  // đảm bảo path có /
  return `${BASE_URL}${p.startsWith("/") ? "" : "/"}${p}`;
}

// AbortController timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// Request chung
async function request(method, path, body, opts = {}) {
  const token = getToken();

  const headers = {
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // JSON body cho POST/PUT/PATCH
  const hasBody = body !== undefined && body !== null && method !== "GET" && method !== "DELETE";
  if (hasBody) headers["Content-Type"] = "application/json";

  const url = buildUrl(path);

  const res = await fetchWithTimeout(
    url,
    {
      method,
      headers,
      // Nếu backend bạn bật credentials/cookie thì giữ dòng này.
      // Nếu không dùng cookie, vẫn không sao.
      credentials: opts.credentials ?? "include",
      body: hasBody ? JSON.stringify(body) : undefined,
    },
    opts.timeoutMs ?? 30000
  );

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    const msg =
      data?.error ||
      data?.message ||
      `${method} ${path} failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

// ================= Public APIs =================
export function apiGet(path, opts) {
  return request("GET", path, undefined, opts);
}

export function apiPost(path, body, opts) {
  return request("POST", path, body ?? {}, opts);
}

export function apiPut(path, body, opts) {
  return request("PUT", path, body ?? {}, opts);
}

export function apiDelete(path, opts) {
  return request("DELETE", path, undefined, opts);
}

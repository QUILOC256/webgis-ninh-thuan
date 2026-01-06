// frontend/src/api/apiClient.js
// =============================================================
// API CLIENT - RENDER STATIC + RENDER BACKEND (STABLE)
// -------------------------------------------------------------
// ✅ Ưu tiên env: REACT_APP_API_URL hoặc REACT_APP_API_BASE_URL
// ✅ Local dev fallback: http://localhost:5000
// ✅ Production fallback: https://webgis-ninh-thuan.onrender.com (không bao giờ fallback localhost)
// ✅ Không dùng window.location.origin để tránh /api 404 trên static
// ✅ Timeout + parse JSON safe (kể cả text) + error rõ (status/url)
// ✅ Token: hỗ trợ key mới + legacy key
// =============================================================

const DEFAULT_LOCAL_API = "http://localhost:5000";
const DEFAULT_PROD_API = "https://webgis-ninh-thuan.onrender.com";

const ENV_BASE =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL)) ||
  "";

// Chuẩn hoá base url (bỏ dấu / cuối và bỏ dấu " nếu có)
function normalizeBaseUrl(url) {
  return String(url || "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/\/+$/, "");
}

// Tự đoán base URL khi không có env
function guessBaseUrl() {
  // Nếu chạy trên browser
  if (typeof window !== "undefined" && window.location) {
    const host = window.location.hostname || "";
    // Local dev
    if (host === "localhost" || host === "127.0.0.1") return DEFAULT_LOCAL_API;
    // Production: fallback đúng backend (tránh gọi nhầm static site origin)
    return DEFAULT_PROD_API;
  }
  // SSR/Node env: fallback production
  return DEFAULT_PROD_API;
}

export const BASE_URL =
  normalizeBaseUrl(ENV_BASE) || normalizeBaseUrl(guessBaseUrl());

// ================= Token =================
const ADMIN_TOKEN_KEY = "adminToken";
const ADMIN_TOKEN_KEY_LEGACY = "admin_token";

export function setToken(token) {
  if (!token) return;
  localStorage.setItem(ADMIN_TOKEN_KEY, String(token));
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
async function parseBodySafe(res) {
  // đọc text trước để không bị crash nếu không phải JSON
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text; // trả text thô nếu không parse được
  }
}

function buildUrl(path) {
  const p = String(path || "").trim();
  if (!p) return BASE_URL;

  // Nếu truyền full URL thì dùng luôn
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

function pickErrorMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  return data.error || data.message || fallback;
}

// Request chung
async function request(method, path, body, opts = {}) {
  const token = getToken();

  const headers = {
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const hasBody =
    body !== undefined &&
    body !== null &&
    method !== "GET" &&
    method !== "DELETE";

  if (hasBody) headers["Content-Type"] = "application/json";

  const url = buildUrl(path);

  let res;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method,
        headers,
        // JWT Bearer -> không cần cookie
        credentials: opts.credentials ?? "omit",
        body: hasBody ? JSON.stringify(body) : undefined,
      },
      opts.timeoutMs ?? 30000
    );
  } catch (e) {
    // timeout / network error
    const err = new Error(`Network error: ${method} ${url}`);
    err.cause = e;
    err.url = url;
    throw err;
  }

  const data = await parseBodySafe(res);

  if (!res.ok) {
    const fallback = `${method} ${path} failed (${res.status})`;
    const err = new Error(pickErrorMessage(data, fallback));
    err.status = res.status;
    err.url = url;
    err.data = data;
    throw err;
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

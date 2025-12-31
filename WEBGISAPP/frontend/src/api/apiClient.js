// src/api/apiClient.js
const RAW_BASE =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL)) ||
  "http://localhost:5000";

const BASE_URL = String(RAW_BASE).trim().replace(/\/+$/, "");

const TOKEN_KEY = "adminToken";

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiGet(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: {
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || "GET failed");
  return data;
}

export async function apiPost(path, body, opts = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || "POST failed");
  return data;
}

export async function apiPut(path, body, opts = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || "PUT failed");
  return data;
}

export async function apiDelete(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: {
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data?.error || "DELETE failed");
  return data;
}
